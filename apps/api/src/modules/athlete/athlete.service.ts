import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, IsNull, Repository } from 'typeorm';
import { Athlete } from '../../database/entities/athlete.entity';
import { ClubGroup } from '../../database/entities/club-group.entity';
import { SportBranch } from '../../database/entities/sport-branch.entity';
import { AthleteStatus, FamilyReadinessStatus } from '../../database/enums';
import { CreateAthleteDto } from './dto/create-athlete.dto';
import { UpdateAthleteDto } from './dto/update-athlete.dto';
import { ListAthletesQueryDto } from './dto/list-athletes-query.dto';
import { AthleteGuardian } from '../../database/entities/athlete-guardian.entity';
import { AthleteTeamMembership } from '../../database/entities/athlete-team-membership.entity';
import { Team } from '../../database/entities/team.entity';
import { FamilyActionService } from '../family-action/family-action.service';
import { BulkUpdateAthletesDto } from './dto/bulk-update-athletes.dto';

@Injectable()
export class AthleteService {
  constructor(
    @InjectRepository(Athlete)
    private readonly athletes: Repository<Athlete>,
    @InjectRepository(SportBranch)
    private readonly branches: Repository<SportBranch>,
    @InjectRepository(ClubGroup)
    private readonly groups: Repository<ClubGroup>,
    @InjectRepository(Team)
    private readonly teams: Repository<Team>,
    @InjectRepository(AthleteGuardian)
    private readonly athleteGuardians: Repository<AthleteGuardian>,
    @InjectRepository(AthleteTeamMembership)
    private readonly teamMemberships: Repository<AthleteTeamMembership>,
    private readonly familyActions: FamilyActionService,
  ) {}

  private async assertBranch(tenantId: string, sportBranchId: string): Promise<void> {
    const b = await this.branches.findOne({ where: { id: sportBranchId, tenantId } });
    if (!b) throw new BadRequestException('sportBranchId does not belong to this tenant');
  }

  private async assertGroupForAthlete(
    tenantId: string,
    sportBranchId: string,
    groupId: string | null | undefined,
  ): Promise<void> {
    if (groupId === undefined || groupId === null) return;
    const g = await this.groups.findOne({ where: { id: groupId, tenantId } });
    if (!g) throw new BadRequestException('primaryGroupId does not belong to this tenant');
    if (g.sportBranchId !== sportBranchId) {
      throw new BadRequestException('primaryGroupId must be under the same sport branch as the athlete');
    }
  }

  private async endTeamMemberships(memberships: AthleteTeamMembership[]): Promise<number> {
    const openMemberships = memberships.filter((membership) => !membership.endedAt);
    if (openMemberships.length === 0) {
      return 0;
    }

    const endedAt = new Date();
    openMemberships.forEach((membership) => {
      membership.endedAt = endedAt;
    });
    await this.teamMemberships.save(openMemberships);
    return openMemberships.length;
  }

  private async endOpenTeamMembershipsForAthletes(tenantId: string, athleteIds: string[]): Promise<number> {
    if (athleteIds.length === 0) {
      return 0;
    }

    const memberships = await this.teamMemberships.find({
      where: {
        tenantId,
        athleteId: In(athleteIds),
        endedAt: IsNull(),
      },
    });
    return this.endTeamMemberships(memberships);
  }

  private async endConflictingGroupMemberships(
    tenantId: string,
    athleteIds: string[],
    primaryGroupId: string,
  ): Promise<number> {
    if (athleteIds.length === 0) {
      return 0;
    }

    const memberships = await this.teamMemberships.find({
      where: {
        tenantId,
        athleteId: In(athleteIds),
        endedAt: IsNull(),
      },
      relations: ['team'],
    });

    return this.endTeamMemberships(
      memberships.filter(
        (membership) => Boolean(membership.team?.groupId) && membership.team.groupId !== primaryGroupId,
      ),
    );
  }

  async create(tenantId: string, dto: CreateAthleteDto): Promise<Athlete> {
    await this.assertBranch(tenantId, dto.sportBranchId);
    await this.assertGroupForAthlete(tenantId, dto.sportBranchId, dto.primaryGroupId ?? null);

    const entity = this.athletes.create({
      tenantId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      preferredName: dto.preferredName ?? null,
      birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
      gender: dto.gender ?? null,
      sportBranchId: dto.sportBranchId,
      primaryGroupId: dto.primaryGroupId ?? null,
      status: dto.status ?? AthleteStatus.ACTIVE,
      jerseyNumber: dto.jerseyNumber ?? null,
      notes: dto.notes ?? null,
    });
    return this.athletes.save(entity);
  }

  async list(tenantId: string, query: ListAthletesQueryDto): Promise<{ items: Athlete[]; total: number }> {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const qb = this.athletes
      .createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId })
      .distinct(true);

    if (query.status) {
      qb.andWhere('a.status = :status', { status: query.status });
    }
    if (query.sportBranchId) {
      qb.andWhere('a.sportBranchId = :sportBranchId', { sportBranchId: query.sportBranchId });
    }
    if (query.primaryGroupId) {
      qb.andWhere('a.primaryGroupId = :primaryGroupId', { primaryGroupId: query.primaryGroupId });
    }
    if (query.teamId) {
      qb.innerJoin(
        AthleteTeamMembership,
        'tm',
        'tm.tenantId = a.tenantId AND tm.athleteId = a.id AND tm.teamId = :teamId AND tm.endedAt IS NULL',
        { teamId: query.teamId },
      );
    }
    if (query.q?.trim()) {
      const term = `%${query.q.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('LOWER(a.firstName) LIKE :term', { term })
            .orWhere('LOWER(a.lastName) LIKE :term', { term })
            .orWhere('LOWER(a.preferredName) LIKE :term', { term });
        }),
      );
    }

    let readinessIds: string[] | null = null;
    if (query.familyReadinessStatus) {
      const readinessMap = await this.familyActions.getReadinessMap(tenantId);
      readinessIds = Array.from(readinessMap.values())
        .filter((item) => item.status === query.familyReadinessStatus)
        .map((item) => item.athleteId);

      if (readinessIds.length === 0) {
        return { items: [], total: 0 };
      }

      qb.andWhere('a.id IN (:...readinessIds)', { readinessIds });
    }
    if (query.needsFamilyFollowUp) {
      const readinessMap = await this.familyActions.getReadinessMap(tenantId);
      const followUpIds = Array.from(readinessMap.values())
        .filter((item) => item.status !== FamilyReadinessStatus.COMPLETE)
        .map((item) => item.athleteId);

      if (followUpIds.length === 0) {
        return { items: [], total: 0 };
      }

      qb.andWhere('a.id IN (:...followUpIds)', { followUpIds });
    }

    const total = await qb.clone().getCount();
    const items = await qb.orderBy('a.lastName', 'ASC').addOrderBy('a.firstName', 'ASC').skip(offset).take(limit).getMany();

    return { items, total };
  }

  async findOne(tenantId: string, id: string): Promise<Athlete> {
    const a = await this.athletes.findOne({
      where: { id, tenantId },
      relations: ['sportBranch', 'primaryGroup'],
    });
    if (!a) throw new NotFoundException('Athlete not found');
    return a;
  }

  async update(tenantId: string, id: string, dto: UpdateAthleteDto): Promise<Athlete> {
    const existing = await this.findOne(tenantId, id);
    const previousPrimaryGroupId = existing.primaryGroupId;
    const sportBranchId = dto.sportBranchId ?? existing.sportBranchId;
    if (dto.sportBranchId) {
      await this.assertBranch(tenantId, dto.sportBranchId);
    }
    const nextGroup = dto.primaryGroupId !== undefined ? dto.primaryGroupId : existing.primaryGroupId;
    await this.assertGroupForAthlete(tenantId, sportBranchId, nextGroup);

    Object.assign(existing, {
      ...dto,
      birthDate:
        dto.birthDate !== undefined
          ? dto.birthDate
            ? new Date(dto.birthDate)
            : null
          : existing.birthDate,
      preferredName: dto.preferredName !== undefined ? dto.preferredName ?? null : existing.preferredName,
      gender: dto.gender !== undefined ? dto.gender ?? null : existing.gender,
      primaryGroupId: dto.primaryGroupId !== undefined ? dto.primaryGroupId ?? null : existing.primaryGroupId,
      jerseyNumber: dto.jerseyNumber !== undefined ? dto.jerseyNumber ?? null : existing.jerseyNumber,
      notes: dto.notes !== undefined ? dto.notes ?? null : existing.notes,
    });

    const saved = await this.athletes.save(existing);
    if (saved.status === AthleteStatus.INACTIVE || saved.status === AthleteStatus.ARCHIVED) {
      await this.endOpenTeamMembershipsForAthletes(tenantId, [saved.id]);
    } else if (dto.primaryGroupId === null && previousPrimaryGroupId) {
      await this.endOpenTeamMembershipsForAthletes(tenantId, [saved.id]);
    } else if (dto.primaryGroupId && dto.primaryGroupId !== previousPrimaryGroupId) {
      await this.endConflictingGroupMemberships(tenantId, [saved.id], dto.primaryGroupId);
    }

    return saved;
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const res = await this.athletes.delete({ id, tenantId });
    if (!res.affected) throw new NotFoundException('Athlete not found');
  }

  async listGuardiansForAthlete(tenantId: string, athleteId: string) {
    await this.findOne(tenantId, athleteId);
    return this.athleteGuardians.find({
      where: { tenantId, athleteId },
      relations: ['guardian'],
      order: { isPrimaryContact: 'DESC', createdAt: 'ASC' },
    });
  }

  async listTeamsForAthlete(tenantId: string, athleteId: string) {
    await this.findOne(tenantId, athleteId);
    return this.teamMemberships.find({
      where: { tenantId, athleteId },
      relations: ['team'],
      order: { createdAt: 'DESC' },
    });
  }

  async addTeamMembership(tenantId: string, athleteId: string, teamId: string) {
    const athlete = await this.findOne(tenantId, athleteId);
    const team = await this.teams.findOne({ where: { id: teamId, tenantId } });
    if (!team) throw new BadRequestException('Team not found for tenant');
    if (team.sportBranchId !== athlete.sportBranchId) {
      throw new BadRequestException('Team must belong to the same sport branch as the athlete');
    }
    if (team.groupId) {
      if (!athlete.primaryGroupId) {
        throw new BadRequestException('Assign a primary group before adding a team membership');
      }
      if (athlete.primaryGroupId !== team.groupId) {
        throw new BadRequestException('Team must belong to the athlete primary group');
      }
    }
    const open = await this.teamMemberships
      .createQueryBuilder('m')
      .where('m.tenantId = :tenantId', { tenantId })
      .andWhere('m.athleteId = :athleteId', { athleteId })
      .andWhere('m.teamId = :teamId', { teamId })
      .andWhere('m.endedAt IS NULL')
      .getOne();
    if (open) return open;

    const m = this.teamMemberships.create({
      tenantId,
      athleteId,
      teamId,
      startedAt: new Date(),
      endedAt: null,
    });
    return this.teamMemberships.save(m);
  }

  async bulkUpdate(tenantId: string, dto: BulkUpdateAthletesDto) {
    if (dto.status === undefined && dto.primaryGroupId === undefined) {
      throw new BadRequestException('Choose a status or a primary group before applying a bulk update');
    }

    const athleteIds = Array.from(new Set(dto.athleteIds));
    const athletes = await this.athletes.find({
      where: athleteIds.map((id) => ({ id, tenantId })),
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
    if (athletes.length !== athleteIds.length) {
      throw new BadRequestException('One or more athletes were not found for this tenant');
    }

    if (dto.primaryGroupId) {
      const targetGroup = await this.groups.findOne({ where: { id: dto.primaryGroupId, tenantId } });
      if (!targetGroup) {
        throw new BadRequestException('primaryGroupId does not belong to this tenant');
      }
      const branchMismatch = athletes.some((athlete) => athlete.sportBranchId !== targetGroup.sportBranchId);
      if (branchMismatch) {
        throw new BadRequestException(
          'Selected athletes must share the same sport branch as the destination group',
        );
      }
    }

    const nextRows = athletes.map((athlete) =>
      this.athletes.create({
        ...athlete,
        status: dto.status ?? athlete.status,
        primaryGroupId: dto.primaryGroupId ?? athlete.primaryGroupId,
      }),
    );
    await this.athletes.save(nextRows);

    const endedTeamMemberships =
      dto.status === AthleteStatus.INACTIVE || dto.status === AthleteStatus.ARCHIVED
        ? await this.endOpenTeamMembershipsForAthletes(tenantId, athleteIds)
        : dto.primaryGroupId
          ? await this.endConflictingGroupMemberships(tenantId, athleteIds, dto.primaryGroupId)
          : 0;

    return {
      updatedCount: nextRows.length,
      endedTeamMemberships,
      affectedAthleteIds: athleteIds,
      status: dto.status ?? null,
      primaryGroupId: dto.primaryGroupId ?? null,
    };
  }

  async endTeamMembership(tenantId: string, athleteId: string, membershipId: string) {
    await this.findOne(tenantId, athleteId);
    const m = await this.teamMemberships.findOne({ where: { id: membershipId, tenantId, athleteId } });
    if (!m) throw new NotFoundException('Membership not found');
    m.endedAt = new Date();
    return this.teamMemberships.save(m);
  }
}
