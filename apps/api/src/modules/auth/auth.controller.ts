import { Controller, Get, Post, Req, Res, UseGuards, Body } from '@nestjs/common';
import type { Request, Response } from 'express';
import { TenantGuard } from '../core/tenant.guard';
import { AuthService } from './auth.service';
import { LoginStaffDto } from './dto/login-staff.dto';
import { StaffAuthGuard } from './staff-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginStaffDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto);
    this.auth.writeSessionCookie(res, result.sessionToken, result.expiresAt);
    return result.profile;
  }

  @Post('logout')
  @UseGuards(StaffAuthGuard)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (req.staffSessionToken) {
      await this.auth.logout(req.staffSessionToken);
    }
    this.auth.clearSessionCookie(res);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(StaffAuthGuard)
  me(@Req() req: Request) {
    return this.auth.getProfile(req.staffUserId!);
  }

  @Get('platform-overview')
  @UseGuards(StaffAuthGuard)
  platformOverview(@Req() req: Request) {
    return this.auth.getPlatformOverview(req.staffUserId!);
  }

  @Get('club-overview')
  @UseGuards(TenantGuard)
  clubOverview(@Req() req: Request) {
    return this.auth.getClubOverview(req.staffUserId!, req.tenantId!);
  }
}

@Controller('tenants')
export class AuthTenantController {
  constructor(private readonly auth: AuthService) {}

  @Get()
  @UseGuards(StaffAuthGuard)
  list(@Req() req: Request) {
    return this.auth.listAccessibleTenants(req.staffUserId!);
  }
}
