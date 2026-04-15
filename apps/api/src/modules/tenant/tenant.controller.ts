import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { StaffAuthGuard } from '../auth/staff-auth.guard';
import { AuthService } from '../auth/auth.service';

@Controller('tenants')
export class TenantController {
  constructor(private readonly auth: AuthService) {}

  @Get()
  @UseGuards(StaffAuthGuard)
  list(@Req() req: Request) {
    return this.auth.listAccessibleTenants(req.staffUserId!);
  }
}
