import {
  BadRequestException,
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
import { UpdatePlanEntitlementDto } from './dto/update-plan-entitlement.dto';
import {
  LICENSE_FEATURE_CATALOG,
  LICENSE_FEATURE_KEY_LIST,
  LicenseFeatureKey,
} from './license.constants';
import { LicensingSnapshotScheduler } from './licensing-snapshot.scheduler';
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
  constructor(
    private readonly licensing: LicensingService,
    private readonly snapshotScheduler: LicensingSnapshotScheduler,
  ) {}

  @Get('plans')
  listPlans() {
    return this.licensing.listPlans();
  }

  @Get('plans/:planCode/edit')
  getPlanForEditing(@Param('planCode') planCode: string) {
    return this.licensing.getPlanForEditing(planCode);
  }

  @Put('plans/:planCode/entitlements/:featureKey')
  updatePlanEntitlement(
    @Param('planCode') planCode: string,
    @Param('featureKey') featureKey: string,
    @Body() dto: UpdatePlanEntitlementDto,
  ) {
    if (!LICENSE_FEATURE_KEY_LIST.includes(featureKey as LicenseFeatureKey)) {
      throw new BadRequestException(`Unknown feature key: ${featureKey}`);
    }
    return this.licensing.updatePlanEntitlement(
      planCode,
      featureKey as LicenseFeatureKey,
      {
        enabled: dto.enabled,
        limitValue: dto.limitValue ?? null,
        notes: dto.notes ?? null,
      },
    );
  }

  @Get('feature-keys')
  listFeatureKeys() {
    return {
      keys: this.licensing.getCanonicalFeatureCatalog(),
    };
  }

  @Get('feature-catalog')
  listFeatureCatalog() {
    return {
      groups: ['parent_portal', 'communications', 'reporting', 'operations', 'onboarding'],
      features: LICENSE_FEATURE_CATALOG,
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

  @Post('usage/snapshots/run')
  async runSnapshotPass() {
    const result = await this.snapshotScheduler.runOnce('manual');
    return result;
  }

  @Get('usage/:tenantId/evaluation')
  evaluateUsage(@Param('tenantId', new ParseUUIDPipe()) tenantId: string) {
    return this.licensing.evaluateUsage(tenantId);
  }

  @Get('entitlements/:tenantId')
  tenantEntitlements(@Param('tenantId', new ParseUUIDPipe()) tenantId: string) {
    return this.licensing.getTenantEntitlements(tenantId);
  }

  @Get('subscriptions/:tenantId/history')
  subscriptionHistory(
    @Param('tenantId', new ParseUUIDPipe()) tenantId: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Number.parseInt(limit, 10) : 25;
    return this.licensing.listSubscriptionHistory(
      tenantId,
      Number.isFinite(parsed) ? parsed : 25,
    );
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

  /**
   * Wave 23 — calm "is this feature available?" probe.
   *
   * Lets a tenant-facing surface disable a control or render the
   * "Available on Operations / Growth" hint without leaking the full
   * platform-admin entitlement matrix. The endpoint never returns 403:
   * it always answers, with `{ available: true }` or
   * `{ available: false, reason: ..., planCode, planName, status }`.
   */
  @Get('me/feature/:featureKey')
  @UseGuards(TenantGuard)
  async featureAvailability(
    @Req() req: Request,
    @Param('featureKey') featureKey: string,
  ) {
    if (!LICENSE_FEATURE_KEY_LIST.includes(featureKey as LicenseFeatureKey)) {
      throw new BadRequestException(`Unknown feature key: ${featureKey}`);
    }
    const reason = await this.licensing.getFeatureUnavailableReason(
      req.tenantId!,
      featureKey as LicenseFeatureKey,
    );
    if (!reason) {
      return { available: true, featureKey };
    }
    return { available: false, ...reason };
  }
}
