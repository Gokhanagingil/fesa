import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { TenantGuard } from '../core/tenant.guard';
import { ClubUpdateService } from './club-update.service';
import { UpsertClubUpdateDto } from './dto/upsert-club-update.dto';

/**
 * Parent Portal v1.1 — staff-side club updates surface.
 *
 * Tenant isolation is enforced via {@link TenantGuard}; every read and
 * write resolves through `req.tenantId`. We never read a tenant identifier
 * from the request body.
 */
@Controller('club-updates')
@UseGuards(TenantGuard)
export class StaffClubUpdateController {
  constructor(private readonly updates: ClubUpdateService) {}

  @Get()
  list(@Req() req: Request) {
    return this.updates.listForStaff(req.tenantId!);
  }

  @Get('audience-options')
  audienceOptions(@Req() req: Request) {
    return this.updates.listAudienceOptions(req.tenantId!);
  }

  @Get(':id')
  one(@Req() req: Request, @Param('id') id: string) {
    return this.updates.getOne(req.tenantId!, id);
  }

  @Post()
  create(@Req() req: Request, @Body() dto: UpsertClubUpdateDto) {
    if (!dto || typeof dto !== 'object') {
      throw new BadRequestException('Update payload is required');
    }
    return this.updates.create(req.tenantId!, dto);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpsertClubUpdateDto) {
    if (!dto || typeof dto !== 'object') {
      throw new BadRequestException('Update payload is required');
    }
    return this.updates.update(req.tenantId!, id, dto);
  }

  @Post(':id/publish')
  publish(@Req() req: Request, @Param('id') id: string) {
    return this.updates.publish(req.tenantId!, id);
  }

  @Post(':id/archive')
  archive(@Req() req: Request, @Param('id') id: string) {
    return this.updates.archive(req.tenantId!, id);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() req: Request, @Param('id') id: string) {
    await this.updates.remove(req.tenantId!, id);
  }
}
