import { Body, Controller, Get, NotFoundException, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Team } from '../../database/entities/team.entity';
import { TenantGuard } from '../core/tenant.guard';
import { CoachService } from '../coach/coach.service';
import { AssignHeadCoachDto } from '../coach/dto/assign-head-coach.dto';
import { ListTeamsQueryDto } from './dto/list-teams-query.dto';

@Controller('teams')
@UseGuards(TenantGuard)
export class TeamController {
  constructor(
    @InjectRepository(Team)
    private readonly teams: Repository<Team>,
    private readonly coaches: CoachService,
  ) {}

  @Get()
  async list(@Req() req: Request, @Query() query: ListTeamsQueryDto) {
    const tenantId = req.tenantId!;
    const qb = this.teams
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.sportBranch', 'sportBranch')
      .leftJoinAndSelect('t.group', 'group')
      .leftJoinAndSelect('t.headCoach', 'headCoach')
      .where('t.tenantId = :tenantId', { tenantId });
    if (query.sportBranchId) {
      qb.andWhere('t.sportBranchId = :sportBranchId', { sportBranchId: query.sportBranchId });
    }
    if (query.groupId) {
      qb.andWhere('t.groupId = :groupId', { groupId: query.groupId });
    }
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const total = await qb.clone().getCount();
    const items = await qb.orderBy('t.name', 'ASC').skip(offset).take(limit).getMany();
    return { items, total };
  }

  @Get(':id')
  async get(@Req() req: Request, @Param('id') id: string) {
    const t = await this.teams.findOne({
      where: { id, tenantId: req.tenantId! },
      relations: ['sportBranch', 'group', 'headCoach'],
    });
    if (!t) throw new NotFoundException('Team not found');
    return t;
  }

  @Patch(':id/head-coach')
  async assignHeadCoach(@Req() req: Request, @Param('id') id: string, @Body() dto: AssignHeadCoachDto) {
    const team = await this.teams.findOne({
      where: { id, tenantId: req.tenantId! },
      relations: ['headCoach'],
    });
    if (!team) throw new NotFoundException('Team not found');
    const coach = await this.coaches.assertCoachForBranch(req.tenantId!, dto.headCoachId ?? null, team.sportBranchId);
    team.headCoachId = coach?.id ?? null;
    return this.teams.save(team);
  }
}
