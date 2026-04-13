import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../core/tenant.guard';
import { AthleteService } from './athlete.service';
import { CreateAthleteDto } from './dto/create-athlete.dto';
import { UpdateAthleteDto } from './dto/update-athlete.dto';
import { ListAthletesQueryDto } from './dto/list-athletes-query.dto';
import { LinkAthleteGuardianDto } from '../guardian/dto/link-athlete-guardian.dto';
import { GuardianService } from '../guardian/guardian.service';
import { AddTeamMembershipDto } from './dto/add-team-membership.dto';

@Controller('athletes')
@UseGuards(TenantGuard)
export class AthleteController {
  constructor(
    private readonly athletes: AthleteService,
    private readonly guardians: GuardianService,
  ) {}

  @Get()
  list(@Req() req: Request, @Query() query: ListAthletesQueryDto) {
    return this.athletes.list(req.tenantId!, query);
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreateAthleteDto) {
    return this.athletes.create(req.tenantId!, dto);
  }

  @Get(':id')
  get(@Req() req: Request, @Param('id') id: string) {
    return this.athletes.findOne(req.tenantId!, id);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateAthleteDto) {
    return this.athletes.update(req.tenantId!, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.athletes.remove(req.tenantId!, id);
  }

  @Get(':id/guardians')
  listGuardians(@Req() req: Request, @Param('id') athleteId: string) {
    return this.athletes.listGuardiansForAthlete(req.tenantId!, athleteId);
  }

  @Post(':id/guardians')
  linkGuardian(
    @Req() req: Request,
    @Param('id') athleteId: string,
    @Body() dto: LinkAthleteGuardianDto,
  ) {
    return this.guardians.linkToAthlete(req.tenantId!, athleteId, dto);
  }

  @Delete(':id/guardians/:linkId')
  unlinkGuardian(
    @Req() req: Request,
    @Param('id') athleteId: string,
    @Param('linkId') linkId: string,
  ) {
    return this.guardians.unlinkFromAthlete(req.tenantId!, athleteId, linkId);
  }

  @Get(':id/teams')
  listTeams(@Req() req: Request, @Param('id') athleteId: string) {
    return this.athletes.listTeamsForAthlete(req.tenantId!, athleteId);
  }

  @Post(':id/teams')
  addTeam(
    @Req() req: Request,
    @Param('id') athleteId: string,
    @Body() dto: AddTeamMembershipDto,
  ) {
    return this.athletes.addTeamMembership(req.tenantId!, athleteId, dto.teamId);
  }

  @Post(':id/teams/:membershipId/end')
  endTeam(
    @Req() req: Request,
    @Param('id') athleteId: string,
    @Param('membershipId') membershipId: string,
  ) {
    return this.athletes.endTeamMembership(req.tenantId!, athleteId, membershipId);
  }
}
