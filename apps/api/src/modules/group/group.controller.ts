import { Body, Controller, Get, NotFoundException, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClubGroup } from '../../database/entities/club-group.entity';
import { TenantGuard } from '../core/tenant.guard';
import { CoachService } from '../coach/coach.service';
import { AssignHeadCoachDto } from '../coach/dto/assign-head-coach.dto';

class ListGroupsQuery {
  sportBranchId?: string;
  limit?: string;
  offset?: string;
}

@Controller('groups')
@UseGuards(TenantGuard)
export class GroupController {
  constructor(
    @InjectRepository(ClubGroup)
    private readonly groups: Repository<ClubGroup>,
    private readonly coaches: CoachService,
  ) {}

  @Get()
  async list(@Req() req: Request, @Query() query: ListGroupsQuery) {
    const tenantId = req.tenantId!;
    const qb = this.groups
      .createQueryBuilder('g')
      .leftJoinAndSelect('g.sportBranch', 'sportBranch')
      .leftJoinAndSelect('g.ageGroup', 'ageGroup')
      .leftJoinAndSelect('g.headCoach', 'headCoach')
      .leftJoinAndSelect('g.teams', 'teams')
      .where('g.tenantId = :tenantId', { tenantId });
    if (query.sportBranchId) {
      qb.andWhere('g.sportBranchId = :sportBranchId', { sportBranchId: query.sportBranchId });
    }
    const limit = Math.min(parseInt(query.limit ?? '50', 10) || 50, 200);
    const offset = parseInt(query.offset ?? '0', 10) || 0;
    const total = await qb.clone().getCount();
    const items = await qb.orderBy('g.name', 'ASC').skip(offset).take(limit).getMany();
    return { items, total };
  }

  @Get(':id')
  async get(@Req() req: Request, @Param('id') id: string) {
    const g = await this.groups.findOne({
      where: { id, tenantId: req.tenantId! },
      relations: ['sportBranch', 'ageGroup', 'headCoach', 'teams'],
    });
    if (!g) throw new NotFoundException('Group not found');
    return g;
  }

  @Patch(':id/head-coach')
  async assignHeadCoach(@Req() req: Request, @Param('id') id: string, @Body() dto: AssignHeadCoachDto) {
    const group = await this.groups.findOne({ where: { id, tenantId: req.tenantId! } });
    if (!group) throw new NotFoundException('Group not found');
    const coach = await this.coaches.assertCoachForTenant(req.tenantId!, dto.headCoachId ?? null);
    if (coach && coach.sportBranchId !== group.sportBranchId) {
      throw new NotFoundException('Coach not found for this group branch');
    }
    group.headCoachId = coach?.id ?? null;
    await this.groups.save(group);
    return this.groups.findOne({
      where: { id, tenantId: req.tenantId! },
      relations: ['sportBranch', 'ageGroup', 'headCoach', 'teams'],
    });
  }
}
