import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { TenantGuard } from '../core/tenant.guard';
import { GuardianPortalGuard } from './guardian-portal.guard';
import { GuardianPortalService } from './guardian-portal.service';
import { InviteGuardianPortalAccessDto } from './dto/invite-guardian-portal-access.dto';
import { GuardianPortalLoginDto } from './dto/guardian-portal-login.dto';
import { GuardianPortalRecoveryRequestDto } from './dto/guardian-portal-recovery.dto';
import { ActivateGuardianPortalAccessDto } from './dto/activate-guardian-portal-access.dto';
import { SubmitGuardianPortalActionDto } from './dto/submit-guardian-portal-action.dto';
import { ReviewGuardianPortalSubmissionDto } from './dto/review-guardian-portal-submission.dto';

@Controller('guardian-portal')
export class GuardianPortalController {
  constructor(private readonly portal: GuardianPortalService) {}

  @Post('staff/guardians/:guardianId/access')
  @UseGuards(TenantGuard)
  invite(
    @Req() req: Request,
    @Param('guardianId') guardianId: string,
    @Body() dto: InviteGuardianPortalAccessDto,
  ) {
    return this.portal.inviteGuardian(req.tenantId!, guardianId, dto);
  }

  @Patch('staff/access/:accessId/disable')
  @UseGuards(TenantGuard)
  disable(@Req() req: Request, @Param('accessId') accessId: string) {
    return this.portal.disableAccess(req.tenantId!, accessId);
  }

  @Patch('staff/access/:accessId/enable')
  @UseGuards(TenantGuard)
  enable(@Req() req: Request, @Param('accessId') accessId: string) {
    return this.portal.enableAccess(req.tenantId!, accessId);
  }

  @Get('staff/access-summary')
  @UseGuards(TenantGuard)
  accessSummary(@Req() req: Request) {
    return this.portal.listAccessSummary(req.tenantId!);
  }

  /**
   * Family Activation & Landing Pack v1 — calm staff overview.
   *
   * Buckets each guardian into "where do they stand right now?" so club
   * staff have a single, scannable view of the families they should
   * gently follow up with. The endpoint never lists more than 25 names
   * per bucket and never exposes any operational data the staff doesn't
   * already see on the existing access summary surface.
   */
  @Get('staff/activation-overview')
  @UseGuards(TenantGuard)
  activationOverview(@Req() req: Request) {
    return this.portal.getActivationOverview(req.tenantId!);
  }

  @Get('staff/guardians/:guardianId/access')
  @UseGuards(TenantGuard)
  guardianAccess(@Req() req: Request, @Param('guardianId') guardianId: string) {
    return this.portal.getAccessSummary(req.tenantId!, guardianId);
  }

  @Get('activate/:token')
  activationStatus(@Param('token') token: string) {
    return this.portal.getActivationStatus(token);
  }

  @Get('tenants')
  loginTenants() {
    return this.portal.listTenants();
  }

  @Get('branding/:tenantId')
  branding(@Param('tenantId') tenantId: string) {
    return this.portal.getTenantBranding(tenantId);
  }

  @Post('activate/:token')
  async activate(
    @Param('token') token: string,
    @Body() dto: ActivateGuardianPortalAccessDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.portal.activate(token, dto);
    this.portal.writeSessionCookie(res, result.sessionToken, result.expiresAt);
    return result.summary;
  }

  /**
   * Parent Portal v1.2 — public recovery surface.
   *
   * Always returns a calm, identical response regardless of whether the
   * email matched an access row, so we never leak account existence.
   */
  @Post('recover')
  async recover(@Body() dto: GuardianPortalRecoveryRequestDto) {
    return this.portal.requestRecovery({
      email: dto.email,
      tenantId: dto.tenantId ?? null,
    });
  }

  @Post('login')
  async login(@Body() dto: GuardianPortalLoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.portal.login(dto);
    this.portal.writeSessionCookie(res, result.sessionToken, result.expiresAt);
    return result.summary;
  }

  @Post('logout')
  @UseGuards(GuardianPortalGuard)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (req.guardianPortalSessionToken) {
      await this.portal.logout(req.tenantId!, req.guardianPortalSessionToken);
    }
    this.portal.clearSessionCookie(res);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(GuardianPortalGuard)
  me(@Req() req: Request) {
    return this.portal.getPortalHome(req.tenantId!, req.guardianId!);
  }

  @Get('actions/:id')
  @UseGuards(GuardianPortalGuard)
  actionDetail(@Req() req: Request, @Param('id') id: string) {
    return this.portal.getActionDetail(req.tenantId!, req.guardianId!, id);
  }

  @Post('actions/:id/submit')
  @UseGuards(GuardianPortalGuard)
  submitAction(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: SubmitGuardianPortalActionDto,
  ) {
    return this.portal.submitAction(req.tenantId!, req.guardianId!, id, dto, req.portalSessionId ?? null);
  }

  @Post('staff/actions/:id/review')
  @UseGuards(TenantGuard)
  reviewSubmission(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: ReviewGuardianPortalSubmissionDto,
  ) {
    return this.portal.reviewSubmission(req.tenantId!, id, dto);
  }
}
