import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { TrainingSession } from '../../database/entities/training-session.entity';
import { TrainingSessionSeries } from '../../database/entities/training-session-series.entity';
import { SportBranch } from '../../database/entities/sport-branch.entity';
import { ClubGroup } from '../../database/entities/club-group.entity';
import { Team } from '../../database/entities/team.entity';
import { Athlete } from '../../database/entities/athlete.entity';
import { Attendance } from '../../database/entities/attendance.entity';
import { AthleteTeamMembership } from '../../database/entities/athlete-team-membership.entity';
import { TrainingSessionStatus } from '../../database/enums';
import { CreateTrainingSessionDto } from './dto/create-training-session.dto';
import { UpdateTrainingSessionDto } from './dto/update-training-session.dto';
import { ListTrainingSessionsQueryDto } from './dto/list-training-sessions-query.dto';
import { CreateTrainingSessionSeriesDto } from './dto/create-training-session-series.dto';
import {
  BulkUpdateTrainingSessionsDto,
  TrainingBulkAction,
} from './dto/bulk-update-training-sessions.dto';
import { BulkAttendanceDto } from './dto/bulk-attendance.dto';
import { PatchAttendanceDto } from './dto/patch-attendance.dto';

@Injectable()
export class TrainingService {
  constructor(
    @InjectRepository(TrainingSession)
    private readonly sessions: Repository<TrainingSession>,
    @InjectRepository(TrainingSessionSeries)
    private readonly sessionSeries: Repository<TrainingSessionSeries>,
    @InjectRepository(SportBranch)
    private readonly branches: Repository<SportBranch>,
    @InjectRepository(ClubGroup)
    private readonly groups: Repository<ClubGroup>,
    @InjectRepository(Team)
    private readonly teams: Repository<Team>,
    @InjectRepository(Athlete)
    private readonly athletes: Repository<Athlete>,
    @InjectRepository(Attendance)
    private readonly attendance: Repository<Attendance>,
    @InjectRepository(AthleteTeamMembership)
    private readonly teamMemberships: Repository<AthleteTeamMembership>,
  ) {}

  private parseDateOnly(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) {
      throw new BadRequestException('Invalid series date');
    }
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }

  private parseClock(value: string): { hours: number; minutes: number; totalMinutes: number } {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
    if (!match) {
      throw new BadRequestException('Time fields must use HH:mm format');
    }
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    return { hours, minutes, totalMinutes: hours * 60 + minutes };
  }

  private withClock(date: Date, time: string): Date {
    const { hours, minutes } = this.parseClock(time);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hours, minutes, 0, 0));
  }

  private appendNote(existing: string | null, suffix?: string): string | null {
    const trimmed = suffix?.trim();
    if (!trimmed) return existing;
    if (!existing?.trim()) return trimmed;
    return `${existing}\n${trimmed}`;
  }

  private buildSessionFingerprint(
    title: string,
    groupId: string,
    teamId: string | null,
    scheduledStart: Date,
    scheduledEnd: Date,
  ): string {
    return [
      title.trim().toLowerCase(),
      groupId,
      teamId ?? '',
      scheduledStart.toISOString(),
      scheduledEnd.toISOString(),
    ].join('::');
  }

  private async loadSession(tenantId: string, id: string): Promise<TrainingSession> {
    const s = await this.sessions.findOne({ where: { id, tenantId } });
    if (!s) throw new NotFoundException('Training session not found');
    return s;
  }

  private async validateSessionRefs(
    tenantId: string,
    sportBranchId: string,
    groupId: string,
    teamId: string | null | undefined,
  ): Promise<void> {
    const branch = await this.branches.findOne({ where: { id: sportBranchId, tenantId } });
    if (!branch) throw new BadRequestException('sportBranchId invalid for tenant');
    const group = await this.groups.findOne({ where: { id: groupId, tenantId } });
    if (!group) throw new BadRequestException('groupId invalid for tenant');
    if (group.sportBranchId !== sportBranchId) {
      throw new BadRequestException('groupId must belong to the same sport branch');
    }
    if (teamId) {
      const team = await this.teams.findOne({ where: { id: teamId, tenantId } });
      if (!team) throw new BadRequestException('teamId invalid for tenant');
      if (team.sportBranchId !== sportBranchId) {
        throw new BadRequestException('team must belong to the same sport branch');
      }
      if (team.groupId != null && team.groupId !== groupId) {
        throw new BadRequestException('team must be under the selected group (or ungrouped)');
      }
    }
  }

  /**
   * Athlete may attend if they are in the session's cohort (primary group) and,
   * when the session targets a team, have an active membership in that team.
   */
  private async assertAthleteEligibleForSession(session: TrainingSession, athlete: Athlete): Promise<void> {
    if (athlete.tenantId !== session.tenantId) {
      throw new BadRequestException('Athlete tenant mismatch');
    }
    if (athlete.primaryGroupId !== session.groupId) {
      throw new BadRequestException('Athlete primary group does not match this session');
    }
    if (session.teamId) {
      const open = await this.teamMemberships
        .createQueryBuilder('m')
        .where('m.tenantId = :tenantId', { tenantId: session.tenantId })
        .andWhere('m.athleteId = :athleteId', { athleteId: athlete.id })
        .andWhere('m.teamId = :teamId', { teamId: session.teamId })
        .andWhere('m.endedAt IS NULL')
        .getOne();
      if (!open) {
        throw new BadRequestException('Athlete is not an active member of the session team');
      }
    }
  }

  private async setDerivedSessionStatus(session: TrainingSession): Promise<TrainingSession> {
    return this.sessions.save(session);
  }

  private async createSessionsFromSeries(
    tenantId: string,
    dto: CreateTrainingSessionSeriesDto,
    seriesId: string,
  ): Promise<{ sessions: TrainingSession[]; skippedCount: number }> {
    const startsOn = this.parseDateOnly(dto.startsOn);
    const endsOn = this.parseDateOnly(dto.endsOn);
    if (endsOn < startsOn) {
      throw new BadRequestException('Series end date must be on or after the start date');
    }

    const startClock = this.parseClock(dto.sessionStartTime);
    const endClock = this.parseClock(dto.sessionEndTime);
    if (endClock.totalMinutes <= startClock.totalMinutes) {
      throw new BadRequestException('sessionEndTime must be after sessionStartTime');
    }

    const weekdays = Array.from(new Set(dto.weekdays)).sort((a, b) => a - b);
    const occurrences: Array<{ scheduledStart: Date; scheduledEnd: Date }> = [];
    for (const cursor = new Date(startsOn); cursor <= endsOn; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const isoWeekday = cursor.getUTCDay() === 0 ? 7 : cursor.getUTCDay();
      if (!weekdays.includes(isoWeekday)) continue;
      const sessionDay = new Date(cursor);
      occurrences.push({
        scheduledStart: this.withClock(sessionDay, dto.sessionStartTime),
        scheduledEnd: this.withClock(sessionDay, dto.sessionEndTime),
      });
    }

    if (occurrences.length === 0) {
      throw new BadRequestException('No sessions match the selected date range and weekdays');
    }
    if (occurrences.length > 180) {
      throw new BadRequestException('Series generation is limited to 180 sessions at a time');
    }

    const firstStart = occurrences[0].scheduledStart;
    const lastStart = occurrences[occurrences.length - 1].scheduledStart;
    const existingRows = await this.sessions
      .createQueryBuilder('s')
      .where('s.tenantId = :tenantId', { tenantId })
      .andWhere('s.groupId = :groupId', { groupId: dto.groupId })
      .andWhere(dto.teamId ? 's.teamId = :teamId' : 's.teamId IS NULL', dto.teamId ? { teamId: dto.teamId } : {})
      .andWhere('s.scheduledStart >= :from', { from: firstStart })
      .andWhere('s.scheduledStart <= :to', { to: lastStart })
      .getMany();

    const existingFingerprints = new Set(
      existingRows.map((row) =>
        this.buildSessionFingerprint(row.title, row.groupId, row.teamId, row.scheduledStart, row.scheduledEnd),
      ),
    );

    const newRows = occurrences
      .filter(
        ({ scheduledStart, scheduledEnd }) =>
          !existingFingerprints.has(
            this.buildSessionFingerprint(dto.title, dto.groupId, dto.teamId ?? null, scheduledStart, scheduledEnd),
          ),
      )
      .map(({ scheduledStart, scheduledEnd }) =>
        this.sessions.create({
          tenantId,
          seriesId,
          title: dto.title,
          sportBranchId: dto.sportBranchId,
          groupId: dto.groupId,
          teamId: dto.teamId ?? null,
          scheduledStart,
          scheduledEnd,
          location: dto.location ?? null,
          status: dto.status ?? TrainingSessionStatus.PLANNED,
          notes: dto.notes ?? null,
        }),
      );

    const sessions = newRows.length > 0 ? await this.sessions.save(newRows) : [];
    return {
      sessions,
      skippedCount: occurrences.length - sessions.length,
    };
  }

  async create(tenantId: string, dto: CreateTrainingSessionDto): Promise<TrainingSession> {
    const start = new Date(dto.scheduledStart);
    const end = new Date(dto.scheduledEnd);
    if (!(end > start)) {
      throw new BadRequestException('scheduledEnd must be after scheduledStart');
    }
    await this.validateSessionRefs(tenantId, dto.sportBranchId, dto.groupId, dto.teamId ?? null);

    const entity = this.sessions.create({
      tenantId,
      title: dto.title,
      sportBranchId: dto.sportBranchId,
      groupId: dto.groupId,
      teamId: dto.teamId ?? null,
      scheduledStart: start,
      scheduledEnd: end,
      location: dto.location ?? null,
      status: dto.status ?? TrainingSessionStatus.PLANNED,
      notes: dto.notes ?? null,
    });
    return this.sessions.save(entity);
  }

  async list(tenantId: string, query: ListTrainingSessionsQueryDto) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const qb = this.sessions.createQueryBuilder('s').where('s.tenantId = :tenantId', { tenantId });
    if (query.q?.trim()) {
      const term = `%${query.q.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('LOWER(s.title) LIKE :term', { term })
            .orWhere('LOWER(COALESCE(s.location, \'\')) LIKE :term', { term })
            .orWhere('LOWER(COALESCE(s.notes, \'\')) LIKE :term', { term });
        }),
      );
    }
    if (query.groupId) qb.andWhere('s.groupId = :groupId', { groupId: query.groupId });
    if (query.teamId) qb.andWhere('s.teamId = :teamId', { teamId: query.teamId });
    if (query.sportBranchId) qb.andWhere('s.sportBranchId = :sportBranchId', { sportBranchId: query.sportBranchId });
    if (query.status) qb.andWhere('s.status = :status', { status: query.status });
    if (query.from) qb.andWhere('s.scheduledStart >= :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('s.scheduledStart <= :to', { to: new Date(query.to) });

    const total = await qb.clone().getCount();
    const items = await qb
      .orderBy('s.scheduledStart', 'ASC')
      .skip(offset)
      .take(limit)
      .getMany();
    return { items, total };
  }

  async createSeries(tenantId: string, dto: CreateTrainingSessionSeriesDto) {
    await this.validateSessionRefs(tenantId, dto.sportBranchId, dto.groupId, dto.teamId ?? null);

    return this.sessions.manager.transaction(async (manager) => {
      const seriesRepo = manager.getRepository(TrainingSessionSeries);
      const series = await seriesRepo.save(
        seriesRepo.create({
          tenantId,
          title: dto.title,
          sportBranchId: dto.sportBranchId,
          groupId: dto.groupId,
          teamId: dto.teamId ?? null,
          startsOn: dto.startsOn,
          endsOn: dto.endsOn,
          weekdays: Array.from(new Set(dto.weekdays)).sort((a, b) => a - b),
          sessionStartTime: dto.sessionStartTime,
          sessionEndTime: dto.sessionEndTime,
          location: dto.location ?? null,
          status: dto.status ?? TrainingSessionStatus.PLANNED,
          notes: dto.notes ?? null,
        }),
      );

      const scopedService = new TrainingService(
        manager.getRepository(TrainingSession),
        manager.getRepository(TrainingSessionSeries),
        manager.getRepository(SportBranch),
        manager.getRepository(ClubGroup),
        manager.getRepository(Team),
        manager.getRepository(Athlete),
        manager.getRepository(Attendance),
        manager.getRepository(AthleteTeamMembership),
      );

      const result = await scopedService.createSessionsFromSeries(tenantId, dto, series.id);
      return {
        series,
        items: result.sessions,
        generatedCount: result.sessions.length,
        skippedCount: result.skippedCount,
      };
    });
  }

  async findOne(tenantId: string, id: string): Promise<TrainingSession> {
    return this.loadSession(tenantId, id);
  }

  async update(tenantId: string, id: string, dto: UpdateTrainingSessionDto): Promise<TrainingSession> {
    const existing = await this.loadSession(tenantId, id);
    const sportBranchId = dto.sportBranchId ?? existing.sportBranchId;
    const groupId = dto.groupId ?? existing.groupId;
    const teamId = dto.teamId !== undefined ? dto.teamId : existing.teamId;
    await this.validateSessionRefs(tenantId, sportBranchId, groupId, teamId);

    const start = dto.scheduledStart ? new Date(dto.scheduledStart) : existing.scheduledStart;
    const end = dto.scheduledEnd ? new Date(dto.scheduledEnd) : existing.scheduledEnd;
    if (!(end > start)) {
      throw new BadRequestException('scheduledEnd must be after scheduledStart');
    }

    Object.assign(existing, {
      ...dto,
      teamId: dto.teamId !== undefined ? dto.teamId : existing.teamId,
      location: dto.location !== undefined ? dto.location ?? null : existing.location,
      notes: dto.notes !== undefined ? dto.notes ?? null : existing.notes,
      scheduledStart: dto.scheduledStart ? new Date(dto.scheduledStart) : existing.scheduledStart,
      scheduledEnd: dto.scheduledEnd ? new Date(dto.scheduledEnd) : existing.scheduledEnd,
    });
    return this.sessions.save(existing);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const res = await this.sessions.delete({ id, tenantId });
    if (!res.affected) throw new NotFoundException('Training session not found');
  }

  async bulkUpdate(tenantId: string, dto: BulkUpdateTrainingSessionsDto): Promise<TrainingSession[]> {
    const uniqueIds = Array.from(new Set(dto.sessionIds));
    const items = await this.sessions.find({
      where: uniqueIds.map((id) => ({ id, tenantId })),
      order: { scheduledStart: 'ASC' },
    });
    if (items.length !== uniqueIds.length) {
      throw new NotFoundException('One or more training sessions were not found');
    }

    if (dto.action === TrainingBulkAction.SHIFT) {
      if (!dto.shiftDays) {
        throw new BadRequestException('shiftDays is required for bulk rescheduling');
      }
      const blocked = items.find((item) => item.status !== TrainingSessionStatus.PLANNED);
      if (blocked) {
        throw new BadRequestException('Only planned sessions can be bulk rescheduled');
      }

      for (const item of items) {
        item.scheduledStart = new Date(item.scheduledStart.getTime() + dto.shiftDays * 24 * 60 * 60 * 1000);
        item.scheduledEnd = new Date(item.scheduledEnd.getTime() + dto.shiftDays * 24 * 60 * 60 * 1000);
        item.notes = this.appendNote(item.notes, dto.noteAppend);
      }
      return this.sessions.save(items);
    }

    for (const item of items) {
      item.status = TrainingSessionStatus.CANCELLED;
      item.notes = this.appendNote(item.notes, dto.noteAppend);
    }
    return this.sessions.save(items);
  }

  async listAttendance(tenantId: string, sessionId: string): Promise<Attendance[]> {
    await this.loadSession(tenantId, sessionId);
    return this.attendance.find({
      where: { tenantId, trainingSessionId: sessionId },
      relations: ['athlete'],
      order: { updatedAt: 'DESC' },
    });
  }

  async bulkUpsertAttendance(tenantId: string, sessionId: string, dto: BulkAttendanceDto): Promise<Attendance[]> {
    const session = await this.loadSession(tenantId, sessionId);
    const out: Attendance[] = [];

    for (const row of dto.rows) {
      const athlete = await this.athletes.findOne({ where: { id: row.athleteId, tenantId } });
      if (!athlete) throw new BadRequestException(`Unknown athlete ${row.athleteId}`);
      await this.assertAthleteEligibleForSession(session, athlete);

      let rec = await this.attendance.findOne({
        where: { trainingSessionId: sessionId, athleteId: row.athleteId },
      });
      if (!rec) {
        rec = this.attendance.create({
          tenantId,
          trainingSessionId: sessionId,
          athleteId: row.athleteId,
          status: row.status,
          note: row.note ?? null,
          recordedAt: new Date(),
        });
      } else {
        rec.status = row.status;
        rec.note = row.note ?? null;
        rec.recordedAt = new Date();
      }
      out.push(await this.attendance.save(rec));
    }
    return out;
  }

  async patchAttendance(tenantId: string, attendanceId: string, dto: PatchAttendanceDto): Promise<Attendance> {
    const rec = await this.attendance.findOne({ where: { id: attendanceId, tenantId } });
    if (!rec) throw new NotFoundException('Attendance not found');
    const session = await this.loadSession(tenantId, rec.trainingSessionId);
    const athlete = await this.athletes.findOne({ where: { id: rec.athleteId, tenantId } });
    if (!athlete) throw new NotFoundException('Athlete not found');
    await this.assertAthleteEligibleForSession(session, athlete);
    if (dto.status !== undefined) rec.status = dto.status;
    if (dto.note !== undefined) rec.note = dto.note;
    rec.recordedAt = new Date();
    return this.attendance.save(rec);
  }
}
