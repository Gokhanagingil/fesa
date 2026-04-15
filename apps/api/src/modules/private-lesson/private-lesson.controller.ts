import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../core/tenant.guard';
import { PrivateLessonService } from './private-lesson.service';
import { CreatePrivateLessonDto } from './dto/create-private-lesson.dto';
import { UpdatePrivateLessonDto } from './dto/update-private-lesson.dto';
import { ListPrivateLessonsQueryDto } from './dto/list-private-lessons-query.dto';

@Controller('private-lessons')
@UseGuards(TenantGuard)
export class PrivateLessonController {
  constructor(private readonly privateLessons: PrivateLessonService) {}

  @Get()
  list(@Req() req: Request, @Query() query: ListPrivateLessonsQueryDto) {
    return this.privateLessons.list(req.tenantId!, query);
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreatePrivateLessonDto) {
    return this.privateLessons.create(req.tenantId!, dto);
  }

  @Get(':id')
  get(@Req() req: Request, @Param('id') id: string) {
    return this.privateLessons.findOne(req.tenantId!, id);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdatePrivateLessonDto) {
    return this.privateLessons.update(req.tenantId!, id, dto);
  }
}
