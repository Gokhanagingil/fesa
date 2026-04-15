import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Athlete } from '../../database/entities/athlete.entity';
import { ClubGroup } from '../../database/entities/club-group.entity';
import { SportBranch } from '../../database/entities/sport-branch.entity';
import { AthleteStatus } from '../../database/enums';
import { CreateAthleteDto } from './dto/create-athlete.dto';
import { UpdateAthleteDto } from './dto/update-athlete.dto';
import { ListAthletesQueryDto } from './dto/list-athletes-query.dto';
import { AthleteGuardian } from '../../database/entities/athlete-guardian.entity';
import { AthleteTeamMembership } from '../../database/entities/athlete-team-membership.entity';
import { Team } from '../../database/entities/team.entity';

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
    return this.athletes.save(existing);
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

  async endTeamMembership(tenantId: string, athleteId: string, membershipId: string) {
    await this.findOne(tenantId, athleteId);
    const m = await this.teamMemberships.findOne({ where: { id: membershipId, tenantId, athleteId } });
    if (!m) throw new NotFoundException('Membership not found');
    m.endedAt = new Date();
    return this.teamMemberships.save(m);
  }
}
