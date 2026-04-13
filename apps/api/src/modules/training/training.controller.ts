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
import { TrainingService } from './training.service';
import { CreateTrainingSessionDto } from './dto/create-training-session.dto';
import { UpdateTrainingSessionDto } from './dto/update-training-session.dto';
import { ListTrainingSessionsQueryDto } from './dto/list-training-sessions-query.dto';
import { BulkAttendanceDto } from './dto/bulk-attendance.dto';
import { PatchAttendanceDto } from './dto/patch-attendance.dto';

@Controller('training-sessions')
@UseGuards(TenantGuard)
export class TrainingController {
  constructor(private readonly training: TrainingService) {}

  @Get()
  list(@Req() req: Request, @Query() query: ListTrainingSessionsQueryDto) {
    return this.training.list(req.tenantId!, query);
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreateTrainingSessionDto) {
    return this.training.create(req.tenantId!, dto);
  }

  @Get(':id')
  get(@Req() req: Request, @Param('id') id: string) {
    return this.training.findOne(req.tenantId!, id);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateTrainingSessionDto) {
    return this.training.update(req.tenantId!, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.training.remove(req.tenantId!, id);
  }

  @Get(':id/attendance')
  listAttendance(@Req() req: Request, @Param('id') sessionId: string) {
    return this.training.listAttendance(req.tenantId!, sessionId);
  }

  @Post(':id/attendance/bulk')
  bulkAttendance(
    @Req() req: Request,
    @Param('id') sessionId: string,
    @Body() dto: BulkAttendanceDto,
  ) {
    return this.training.bulkUpsertAttendance(req.tenantId!, sessionId, dto);
  }
}

@Controller('attendance')
@UseGuards(TenantGuard)
export class AttendanceController {
  constructor(private readonly training: TrainingService) {}

  @Patch(':id')
  patch(@Req() req: Request, @Param('id') id: string, @Body() dto: PatchAttendanceDto) {
    return this.training.patchAttendance(req.tenantId!, id, dto);
  }
}
