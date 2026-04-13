import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../core/tenant.guard';
import { GuardianService } from './guardian.service';
import { CreateGuardianDto } from './dto/create-guardian.dto';
import { UpdateGuardianDto } from './dto/update-guardian.dto';
import { ListGuardiansQueryDto } from './dto/list-guardians-query.dto';

@Controller('guardians')
@UseGuards(TenantGuard)
export class GuardianController {
  constructor(private readonly guardians: GuardianService) {}

  @Get()
  list(@Req() req: Request, @Query() query: ListGuardiansQueryDto) {
    return this.guardians.list(req.tenantId!, query);
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreateGuardianDto) {
    return this.guardians.create(req.tenantId!, dto);
  }

  @Get(':id')
  get(@Req() req: Request, @Param('id') id: string) {
    return this.guardians.findOne(req.tenantId!, id);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateGuardianDto) {
    return this.guardians.update(req.tenantId!, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.guardians.remove(req.tenantId!, id);
  }
}
