import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { TenantGuard } from '../core/tenant.guard';
import { AssignSubscriptionDto } from './dto/assign-subscription.dto';
import { LicensingService } from './licensing.service';
import { PlatformAdminGuard } from './platform-admin.guard';

/**
 * Billing & Licensing Foundation v1 — platform-admin-only API.
 *
 * Every endpoint here is gated by `PlatformAdminGuard`. Tenant
 * admins do not see, edit, or assign plans, entitlements, lifecycle
 * states, or usage bands. They have a small read-only surface
 * elsewhere (`/api/licensing/me`).
 */
@Controller('admin/licensing')
@UseGuards(PlatformAdminGuard)
export class PlatformLicensingController {
  constructor(private readonly licensing: LicensingService) {}

  @Get('plans')
  listPlans() {
    return this.licensing.listPlans();
  }

  @Get('feature-keys')
  listFeatureKeys() {
    return {
      keys: this.licensing.getCanonicalFeatureCatalog(),
    };
  }

  @Get('bands')
  listBands() {
    return this.licensing.listBands();
  }

  @Get('subscriptions')
  listSubscriptions() {
    return this.licensing.listTenantSubscriptions();
  }

  @Get('subscriptions/:tenantId')
  getSubscription(@Param('tenantId', new ParseUUIDPipe()) tenantId: string) {
    return this.licensing.getTenantSubscription(tenantId);
  }

  @Put('subscriptions/:tenantId')
  assignSubscription(
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @Body() dto: AssignSubscriptionDto,
    @Req() req: Request,
  ) {
    return this.licensing.assignSubscription({
      tenantId,
      planCode: dto.planCode,
      status: dto.status,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      renewalDate: dto.renewalDate ? new Date(dto.renewalDate) : null,
      trialEndsAt: dto.trialEndsAt ? new Date(dto.trialEndsAt) : null,
      onboardingServiceIncluded: dto.onboardingServiceIncluded,
      internalNotes: dto.internalNotes ?? null,
      statusReason: dto.statusReason ?? null,
      actingStaffUserId: req.staffUserId ?? null,
    });
  }

  @Get('usage/:tenantId/snapshots')
  listSnapshots(
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Number.parseInt(limit, 10) : 12;
    return this.licensing.listUsageSnapshots(
      tenantId,
      Number.isFinite(parsed) ? parsed : 12,
    );
  }

  @Post('usage/:tenantId/snapshots')
  recordSnapshot(@Param('tenantId', new ParseUUIDPipe()) tenantId: string) {
    return this.licensing.recordUsageSnapshot(tenantId, 'manual');
  }

  @Get('usage/:tenantId/evaluation')
  evaluateUsage(@Param('tenantId', new ParseUUIDPipe()) tenantId: string) {
    return this.licensing.evaluateUsage(tenantId);
  }

  @Get('entitlements/:tenantId')
  tenantEntitlements(@Param('tenantId', new ParseUUIDPipe()) tenantId: string) {
    return this.licensing.getTenantEntitlements(tenantId);
  }
}

/**
 * Tenant-readable summary — calmer, much smaller payload. Available
 * to any authenticated staff user with a tenant context. Tenant
 * admins use this to inspect their own license; they cannot mutate
 * anything from this controller.
 */
@Controller('licensing')
export class TenantLicensingController {
  constructor(private readonly licensing: LicensingService) {}

  @Get('me')
  @UseGuards(TenantGuard)
  meSummary(@Req() req: Request) {
    return this.licensing.getTenantEntitlementsPublicSummary(req.tenantId!);
  }
}
