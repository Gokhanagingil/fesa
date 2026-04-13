import { Controller, Get, NotFoundException, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from '../../database/entities/team.entity';
import { TenantGuard } from '../core/tenant.guard';

class ListTeamsQuery {
  sportBranchId?: string;
  groupId?: string;
  limit?: string;
  offset?: string;
}

@Controller('teams')
@UseGuards(TenantGuard)
export class TeamController {
  constructor(
    @InjectRepository(Team)
    private readonly teams: Repository<Team>,
  ) {}

  @Get()
  async list(@Req() req: Request, @Query() query: ListTeamsQuery) {
    const tenantId = req.tenantId!;
    const qb = this.teams
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.sportBranch', 'sportBranch')
      .leftJoinAndSelect('t.group', 'group')
      .where('t.tenantId = :tenantId', { tenantId });
    if (query.sportBranchId) {
      qb.andWhere('t.sportBranchId = :sportBranchId', { sportBranchId: query.sportBranchId });
    }
    if (query.groupId) {
      qb.andWhere('t.groupId = :groupId', { groupId: query.groupId });
    }
    const limit = Math.min(parseInt(query.limit ?? '50', 10) || 50, 200);
    const offset = parseInt(query.offset ?? '0', 10) || 0;
    const total = await qb.clone().getCount();
    const items = await qb.orderBy('t.name', 'ASC').skip(offset).take(limit).getMany();
    return { items, total };
  }

  @Get(':id')
  async get(@Req() req: Request, @Param('id') id: string) {
    const t = await this.teams.findOne({
      where: { id, tenantId: req.tenantId! },
      relations: ['sportBranch', 'group'],
    });
    if (!t) throw new NotFoundException('Team not found');
    return t;
  }
}
