import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../core/tenant.guard';
import { CoachService } from './coach.service';
import { CreateCoachDto } from './dto/create-coach.dto';
import { UpdateCoachDto } from './dto/update-coach.dto';
import { ListCoachesQueryDto } from './dto/list-coaches-query.dto';

@Controller('coaches')
@UseGuards(TenantGuard)
export class CoachController {
  constructor(private readonly coaches: CoachService) {}

  @Get()
  list(@Req() req: Request, @Query() query: ListCoachesQueryDto) {
    return this.coaches.list(req.tenantId!, query);
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreateCoachDto) {
    return this.coaches.create(req.tenantId!, dto);
  }

  @Get(':id')
  get(@Req() req: Request, @Param('id') id: string) {
    return this.coaches.findOne(req.tenantId!, id);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateCoachDto) {
    return this.coaches.update(req.tenantId!, id, dto);
  }
}
