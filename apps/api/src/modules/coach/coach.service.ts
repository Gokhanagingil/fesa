import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Coach } from '../../database/entities/coach.entity';
import { ClubGroup } from '../../database/entities/club-group.entity';
import { Team } from '../../database/entities/team.entity';
import { TrainingSession } from '../../database/entities/training-session.entity';
import { TrainingSessionSeries } from '../../database/entities/training-session-series.entity';
import { SportBranch } from '../../database/entities/sport-branch.entity';
import { CreateCoachDto } from './dto/create-coach.dto';
import { UpdateCoachDto } from './dto/update-coach.dto';
import { ListCoachesQueryDto } from './dto/list-coaches-query.dto';

@Injectable()
export class CoachService {
  constructor(
    @InjectRepository(Coach)
    private readonly coaches: Repository<Coach>,
    @InjectRepository(SportBranch)
    private readonly branches: Repository<SportBranch>,
    @InjectRepository(ClubGroup)
    private readonly groups: Repository<ClubGroup>,
    @InjectRepository(Team)
    private readonly teams: Repository<Team>,
    @InjectRepository(TrainingSession)
    private readonly sessions: Repository<TrainingSession>,
    @InjectRepository(TrainingSessionSeries)
    private readonly series: Repository<TrainingSessionSeries>,
  ) {}

  async assertCoachForTenant(tenantId: string, coachId: string | null | undefined): Promise<Coach | null> {
    if (!coachId) return null;
    const coach = await this.coaches.findOne({ where: { id: coachId, tenantId } });
    if (!coach) {
      throw new BadRequestException('coachId invalid for tenant');
    }
    return coach;
  }

  async assertCoachForBranch(
    tenantId: string,
    coachId: string | null | undefined,
    sportBranchId: string | null | undefined,
  ): Promise<Coach | null> {
    const coach = await this.assertCoachForTenant(tenantId, coachId);
    if (!coach || !sportBranchId) return coach;
    if (coach.sportBranchId !== sportBranchId) {
      throw new BadRequestException('Coach must belong to the same sport branch');
    }
    return coach;
  }

  async create(tenantId: string, dto: CreateCoachDto): Promise<Coach> {
    const branch = await this.branches.findOne({ where: { id: dto.sportBranchId, tenantId } });
    if (!branch) {
      throw new BadRequestException('sportBranchId invalid for tenant');
    }
    const entity = this.coaches.create({
      tenantId,
      sportBranchId: dto.sportBranchId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      preferredName: dto.preferredName ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      specialties: dto.specialties ?? null,
      isActive: dto.isActive ?? true,
      notes: dto.notes ?? null,
    });
    return this.coaches.save(entity);
  }

  async list(tenantId: string, query: ListCoachesQueryDto) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const qb = this.coaches
      .createQueryBuilder('coach')
      .leftJoinAndSelect('coach.sportBranch', 'sportBranch')
      .where('coach.tenantId = :tenantId', { tenantId });

    if (query.isActive !== undefined) {
      qb.andWhere('coach.isActive = :isActive', { isActive: query.isActive });
    }
    if (query.sportBranchId) {
      qb.andWhere('coach.sportBranchId = :sportBranchId', { sportBranchId: query.sportBranchId });
    }
    if (query.q?.trim()) {
      const term = `%${query.q.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((where) => {
          where
            .where('LOWER(coach.firstName) LIKE :term', { term })
            .orWhere('LOWER(coach.lastName) LIKE :term', { term })
            .orWhere('LOWER(COALESCE(coach.preferredName, \'\')) LIKE :term', { term })
            .orWhere("LOWER(CONCAT(coach.firstName, ' ', coach.lastName)) LIKE :term", { term })
            .orWhere("LOWER(CONCAT(coach.lastName, ' ', coach.firstName)) LIKE :term", { term })
            .orWhere('LOWER(COALESCE(coach.email, \'\')) LIKE :term', { term })
            .orWhere('LOWER(COALESCE(coach.phone, \'\')) LIKE :term', { term })
            .orWhere('LOWER(COALESCE(coach.specialties, \'\')) LIKE :term', { term });
        }),
      );
    }

    const total = await qb.clone().getCount();
    const items = await qb.orderBy('coach.firstName', 'ASC').addOrderBy('coach.lastName', 'ASC').skip(offset).take(limit).getMany();
    return { items, total };
  }

  async findOne(tenantId: string, id: string): Promise<Coach> {
    const coach = await this.coaches.findOne({ where: { id, tenantId }, relations: ['sportBranch'] });
    if (!coach) throw new NotFoundException('Coach not found');
    return coach;
  }

  async update(tenantId: string, id: string, dto: UpdateCoachDto): Promise<Coach> {
    const coach = await this.findOne(tenantId, id);
    if (dto.sportBranchId && dto.sportBranchId !== coach.sportBranchId) {
      const branch = await this.branches.findOne({ where: { id: dto.sportBranchId, tenantId } });
      if (!branch) {
        throw new BadRequestException('sportBranchId invalid for tenant');
      }
      coach.sportBranchId = dto.sportBranchId;
    }
    Object.assign(coach, {
      firstName: dto.firstName ?? coach.firstName,
      lastName: dto.lastName ?? coach.lastName,
      preferredName: dto.preferredName !== undefined ? dto.preferredName ?? null : coach.preferredName,
      phone: dto.phone !== undefined ? dto.phone ?? null : coach.phone,
      email: dto.email !== undefined ? dto.email ?? null : coach.email,
      specialties: dto.specialties !== undefined ? dto.specialties ?? null : coach.specialties,
      isActive: dto.isActive ?? coach.isActive,
      notes: dto.notes !== undefined ? dto.notes ?? null : coach.notes,
    });
    return this.coaches.save(coach);
  }

  async getCoachContext(tenantId: string, coachId: string) {
    await this.findOne(tenantId, coachId);

    const [groups, teams, sessions, series] = await Promise.all([
      this.groups.find({
        where: { tenantId, headCoachId: coachId },
        relations: ['sportBranch'],
        order: { name: 'ASC' },
      }),
      this.teams.find({
        where: { tenantId, headCoachId: coachId },
        relations: ['sportBranch', 'group'],
        order: { name: 'ASC' },
      }),
      this.sessions.find({
        where: { tenantId, coachId },
        relations: ['group', 'team'],
        order: { scheduledStart: 'ASC' },
        take: 20,
      }),
      this.series.find({
        where: { tenantId, coachId },
        relations: ['group', 'team'],
        order: { startsOn: 'ASC' },
      }),
    ]);

    return {
      groups,
      teams,
      upcomingSessions: sessions,
      recurringSeries: series,
    };
  }
}
