import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../core/tenant.guard';
import { FamilyActionService } from './family-action.service';
import { CreateFamilyActionRequestDto } from './dto/create-family-action-request.dto';
import { ListFamilyActionRequestsQueryDto } from './dto/list-family-action-requests-query.dto';
import { TransitionFamilyActionRequestDto } from './dto/transition-family-action-request.dto';
import { UpdateFamilyActionRequestDto } from './dto/update-family-action-request.dto';

@Controller('family-actions')
@UseGuards(TenantGuard)
export class FamilyActionController {
  constructor(private readonly familyActions: FamilyActionService) {}

  @Get()
  list(@Req() req: Request, @Query() query: ListFamilyActionRequestsQueryDto) {
    return this.familyActions.list(req.tenantId!, query);
  }

  @Get('summary')
  summary(@Req() req: Request) {
    return this.familyActions.getWorkflowSummary(req.tenantId!);
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreateFamilyActionRequestDto) {
    return this.familyActions.create(req.tenantId!, dto);
  }

  @Get(':id')
  get(@Req() req: Request, @Param('id') id: string) {
    return this.familyActions.findOne(req.tenantId!, id);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateFamilyActionRequestDto) {
    return this.familyActions.update(req.tenantId!, id, dto);
  }

  @Post(':id/transition')
  transition(@Req() req: Request, @Param('id') id: string, @Body() dto: TransitionFamilyActionRequestDto) {
    return this.familyActions.transition(req.tenantId!, id, dto);
  }
}
