import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../core/tenant.guard';
import { ReportingService } from './reporting.service';

/**
 * Placeholder for report registry and saved filters API.
 * Full engine, exports, and RBAC come in later waves.
 */
@Controller('reporting')
@UseGuards(TenantGuard)
export class ReportingController {
  constructor(private readonly reporting: ReportingService) {}

  @Get('definitions')
  definitions(@Req() req: Request) {
    return this.reporting.definitions(req.tenantId!);
  }

  @Get('command-center')
  commandCenter(@Req() req: Request) {
    return this.reporting.commandCenter(req.tenantId!);
  }
}
