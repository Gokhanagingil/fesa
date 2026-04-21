import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Athlete } from '../../database/entities/athlete.entity';
import { LicensePlan } from '../../database/entities/license-plan.entity';
import { LicensePlanEntitlement } from '../../database/entities/license-plan-entitlement.entity';
import { LicenseUsageBand } from '../../database/entities/license-usage-band.entity';
import { StaffUser } from '../../database/entities/staff-user.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import { TenantSubscription } from '../../database/entities/tenant-subscription.entity';
import {
  TenantUsageSnapshot,
  TenantUsageSnapshotSource,
} from '../../database/entities/tenant-usage-snapshot.entity';
import { AthleteStatus } from '../../database/enums';
import {
  LICENSE_FEATURE_KEY_LIST,
  LICENSE_FEATURE_KEYS,
  LicenseFeatureKey,
  TENANT_SUBSCRIPTION_STATUSES,
  TenantSubscriptionStatusValue,
} from './license.constants';
import type {
  LicensePlanSummary,
  LicenseUsageBandSummary,
  TenantEntitlementPublicSummary,
  TenantEntitlementSnapshot,
  TenantSubscriptionSummary,
  TenantUsageEvaluation,
  TenantUsageSnapshotSummary,
} from './licensing.types';

export type AssignSubscriptionInput = {
  tenantId: string;
  planCode: string;
  status: TenantSubscriptionStatusValue;
  startDate?: Date | null;
  renewalDate?: Date | null;
  trialEndsAt?: Date | null;
  onboardingServiceIncluded?: boolean;
  internalNotes?: string | null;
  statusReason?: string | null;
  actingStaffUserId?: string | null;
};

@Injectable()
export class LicensingService {
  constructor(
    @InjectRepository(LicensePlan)
    private readonly plans: Repository<LicensePlan>,
    @InjectRepository(LicensePlanEntitlement)
    private readonly planEntitlements: Repository<LicensePlanEntitlement>,
    @InjectRepository(LicenseUsageBand)
    private readonly bands: Repository<LicenseUsageBand>,
    @InjectRepository(TenantSubscription)
    private readonly subscriptions: Repository<TenantSubscription>,
    @InjectRepository(TenantUsageSnapshot)
    private readonly usageSnapshots: Repository<TenantUsageSnapshot>,
    @InjectRepository(Tenant)
    private readonly tenants: Repository<Tenant>,
    @InjectRepository(Athlete)
    private readonly athletes: Repository<Athlete>,
    @InjectRepository(StaffUser)
    private readonly staffUsers: Repository<StaffUser>,
  ) {}

  // ------------------------------------------------------------------
  // Plans + entitlements (read)
  // ------------------------------------------------------------------

  async listPlans(): Promise<LicensePlanSummary[]> {
    const rows = await this.plans.find({
      order: { displayOrder: 'ASC', name: 'ASC' },
      relations: ['entitlements'],
    });
    return rows.map((plan) => this.serializePlan(plan));
  }

  async listActivePlans(): Promise<LicensePlanSummary[]> {
    const rows = await this.plans.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC', name: 'ASC' },
      relations: ['entitlements'],
    });
    return rows.map((plan) => this.serializePlan(plan));
  }

  private serializePlan(plan: LicensePlan): LicensePlanSummary {
    const entitlements = (plan.entitlements ?? [])
      .map((entitlement) => ({
        featureKey: entitlement.featureKey,
        enabled: entitlement.enabled,
        limitValue: entitlement.limitValue,
        notes: entitlement.notes,
      }))
      .sort((left, right) => left.featureKey.localeCompare(right.featureKey));
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description,
      isActive: plan.isActive,
      isDefaultTrial: plan.isDefaultTrial,
      displayOrder: plan.displayOrder,
      entitlements,
    };
  }

  // ------------------------------------------------------------------
  // Bands (read)
  // ------------------------------------------------------------------

  async listBands(): Promise<LicenseUsageBandSummary[]> {
    const rows = await this.bands.find({
      order: { displayOrder: 'ASC', minAthletes: 'ASC' },
    });
    return rows.map((band) => ({
      id: band.id,
      code: band.code,
      label: band.label,
      minAthletes: band.minAthletes,
      maxAthletes: band.maxAthletes,
      displayOrder: band.displayOrder,
      isActive: band.isActive,
    }));
  }

  // ------------------------------------------------------------------
  // Usage evaluation (live + snapshots)
  // ------------------------------------------------------------------

  async countActiveAthletes(tenantId: string): Promise<number> {
    return this.athletes.count({
      where: { tenantId, status: In([AthleteStatus.ACTIVE, AthleteStatus.TRIAL]) },
    });
  }

  async evaluateUsage(tenantId: string): Promise<TenantUsageEvaluation> {
    const measuredAt = new Date();
    const activeAthleteCount = await this.countActiveAthletes(tenantId);
    const band = await this.resolveBand(activeAthleteCount);
    return {
      tenantId,
      measuredAt: measuredAt.toISOString(),
      activeAthleteCount,
      band: {
        id: band?.id ?? null,
        code: band?.code ?? null,
        label: band?.label ?? null,
      },
      source: 'live',
    };
  }

  private async resolveBand(activeAthleteCount: number): Promise<LicenseUsageBand | null> {
    const candidates = await this.bands.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC', minAthletes: 'ASC' },
    });
    return (
      candidates.find((band) => {
        const lowerOk = activeAthleteCount >= band.minAthletes;
        const upperOk =
          band.maxAthletes === null || activeAthleteCount < band.maxAthletes;
        return lowerOk && upperOk;
      }) ?? null
    );
  }

  async recordUsageSnapshot(
    tenantId: string,
    source: TenantUsageSnapshotSource = 'manual',
  ): Promise<TenantUsageSnapshotSummary> {
    const evaluation = await this.evaluateUsage(tenantId);
    const row = this.usageSnapshots.create({
      tenantId,
      measuredAt: new Date(evaluation.measuredAt),
      activeAthleteCount: evaluation.activeAthleteCount,
      bandId: evaluation.band.id,
      bandCode: evaluation.band.code,
      source,
    });
    const saved = await this.usageSnapshots.save(row);
    return this.serializeSnapshot(saved, evaluation.band.label ?? null);
  }

  async listUsageSnapshots(
    tenantId: string,
    limit = 12,
  ): Promise<TenantUsageSnapshotSummary[]> {
    const rows = await this.usageSnapshots.find({
      where: { tenantId },
      order: { measuredAt: 'DESC' },
      take: Math.max(1, Math.min(50, limit)),
      relations: ['band'],
    });
    return rows.map((row) =>
      this.serializeSnapshot(row, row.band?.label ?? null),
    );
  }

  private serializeSnapshot(
    row: TenantUsageSnapshot,
    bandLabel: string | null,
  ): TenantUsageSnapshotSummary {
    return {
      id: row.id,
      tenantId: row.tenantId,
      measuredAt: row.measuredAt.toISOString(),
      activeAthleteCount: row.activeAthleteCount,
      bandCode: row.bandCode,
      bandLabel,
      source: row.source,
      createdAt: row.createdAt.toISOString(),
    };
  }

  // ------------------------------------------------------------------
  // Tenant subscriptions
  // ------------------------------------------------------------------

  async listTenantSubscriptions(): Promise<TenantSubscriptionSummary[]> {
    const tenantRows = await this.tenants.find({ order: { name: 'ASC' } });
    const subscriptionRows = await this.subscriptions.find({
      relations: ['plan', 'assignedByStaffUser', 'lastChangedByStaffUser'],
    });
    const subscriptionByTenant = new Map(
      subscriptionRows.map((row) => [row.tenantId, row]),
    );

    const summaries: TenantSubscriptionSummary[] = [];
    for (const tenant of tenantRows) {
      const subscription = subscriptionByTenant.get(tenant.id);
      const usage = await this.evaluateUsage(tenant.id);
      summaries.push(this.serializeSubscription(tenant, subscription ?? null, usage));
    }
    return summaries;
  }

  async getTenantSubscription(
    tenantId: string,
  ): Promise<TenantSubscriptionSummary> {
    const tenant = await this.tenants.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    const subscription = await this.subscriptions.findOne({
      where: { tenantId },
      relations: ['plan', 'assignedByStaffUser', 'lastChangedByStaffUser'],
    });
    const usage = await this.evaluateUsage(tenantId);
    return this.serializeSubscription(tenant, subscription, usage);
  }

  async assignSubscription(
    input: AssignSubscriptionInput,
  ): Promise<TenantSubscriptionSummary> {
    if (!TENANT_SUBSCRIPTION_STATUSES.includes(input.status)) {
      throw new BadRequestException(
        `Unknown subscription status: ${input.status}`,
      );
    }
    const tenant = await this.tenants.findOne({ where: { id: input.tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    const plan = await this.plans.findOne({ where: { code: input.planCode } });
    if (!plan) {
      throw new NotFoundException(`Plan not found: ${input.planCode}`);
    }
    if (!plan.isActive) {
      throw new BadRequestException('Cannot assign an inactive plan');
    }

    const existing = await this.subscriptions.findOne({
      where: { tenantId: input.tenantId },
    });
    const isNew = !existing;
    const row =
      existing ??
      this.subscriptions.create({
        tenantId: input.tenantId,
        assignedByStaffUserId: input.actingStaffUserId ?? null,
      });

    row.planId = plan.id;
    row.status = input.status;
    row.startDate = input.startDate ?? row.startDate ?? new Date();
    row.renewalDate = input.renewalDate ?? null;
    row.trialEndsAt = input.trialEndsAt ?? null;
    row.onboardingServiceIncluded =
      input.onboardingServiceIncluded ?? row.onboardingServiceIncluded ?? false;
    row.internalNotes = input.internalNotes ?? null;
    row.statusReason = input.statusReason ?? null;
    row.lastChangedByStaffUserId = input.actingStaffUserId ?? null;
    if (isNew) {
      row.assignedByStaffUserId = input.actingStaffUserId ?? null;
    }

    await this.subscriptions.save(row);
    return this.getTenantSubscription(input.tenantId);
  }

  private serializeSubscription(
    tenant: Tenant,
    subscription: TenantSubscription | null,
    usage: TenantUsageEvaluation,
  ): TenantSubscriptionSummary {
    if (!subscription) {
      return {
        id: '',
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        plan: { id: '', code: '', name: '' },
        status: 'trial',
        startDate: null,
        renewalDate: null,
        trialEndsAt: null,
        onboardingServiceIncluded: false,
        internalNotes: null,
        statusReason: null,
        assignedByDisplayName: null,
        lastChangedByDisplayName: null,
        createdAt: tenant.createdAt.toISOString(),
        updatedAt: tenant.updatedAt.toISOString(),
        usage,
      };
    }
    return {
      id: subscription.id,
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      plan: {
        id: subscription.plan.id,
        code: subscription.plan.code,
        name: subscription.plan.name,
      },
      status: subscription.status as TenantSubscriptionStatusValue,
      startDate: subscription.startDate?.toISOString() ?? null,
      renewalDate: subscription.renewalDate?.toISOString() ?? null,
      trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
      onboardingServiceIncluded: subscription.onboardingServiceIncluded,
      internalNotes: subscription.internalNotes,
      statusReason: subscription.statusReason,
      assignedByDisplayName: this.formatStaffName(subscription.assignedByStaffUser),
      lastChangedByDisplayName: this.formatStaffName(
        subscription.lastChangedByStaffUser,
      ),
      createdAt: subscription.createdAt.toISOString(),
      updatedAt: subscription.updatedAt.toISOString(),
      usage,
    };
  }

  private formatStaffName(user: StaffUser | null | undefined): string | null {
    if (!user) return null;
    return user.preferredName?.trim() || `${user.firstName} ${user.lastName}`;
  }

  // ------------------------------------------------------------------
  // Entitlement engine
  // ------------------------------------------------------------------

  /**
   * Build the central per-tenant entitlement snapshot. Every gate in
   * the product should ultimately route through this shape (or one of
   * the helpers below), so future commercial changes never require
   * sweeping conditional rewrites.
   */
  async getTenantEntitlements(
    tenantId: string,
  ): Promise<TenantEntitlementSnapshot> {
    const subscription = await this.subscriptions.findOne({
      where: { tenantId },
      relations: ['plan', 'plan.entitlements'],
    });
    const usage = await this.evaluateUsage(tenantId);

    const features = this.buildFeatureMap(subscription);
    const isLicenseActive = subscription
      ? subscription.status === 'trial' || subscription.status === 'active'
      : false;

    return {
      tenantId,
      plan: subscription
        ? {
            id: subscription.plan.id,
            code: subscription.plan.code,
            name: subscription.plan.name,
          }
        : null,
      status: subscription
        ? (subscription.status as TenantSubscriptionStatusValue)
        : null,
      isLicenseActive,
      features,
      usage,
    };
  }

  /**
   * Tenant-readable summary. Strips internal notes, actor labels, and
   * full entitlement matrix down to a small calm shape suitable for
   * tenant admins to inspect their own license.
   */
  async getTenantEntitlementsPublicSummary(
    tenantId: string,
  ): Promise<TenantEntitlementPublicSummary> {
    const snapshot = await this.getTenantEntitlements(tenantId);
    const subscription = await this.subscriptions.findOne({ where: { tenantId } });
    return {
      tenantId,
      plan: snapshot.plan
        ? { code: snapshot.plan.code, name: snapshot.plan.name }
        : null,
      status: snapshot.status,
      isLicenseActive: snapshot.isLicenseActive,
      trialEndsAt: subscription?.trialEndsAt?.toISOString() ?? null,
      renewalDate: subscription?.renewalDate?.toISOString() ?? null,
      usage: {
        activeAthleteCount: snapshot.usage.activeAthleteCount,
        band: snapshot.usage.band,
      },
    };
  }

  private buildFeatureMap(
    subscription: TenantSubscription | null,
  ): TenantEntitlementSnapshot['features'] {
    const map = {} as TenantEntitlementSnapshot['features'];
    const planEntitlements = new Map<string, LicensePlanEntitlement>();
    if (subscription?.plan?.entitlements) {
      for (const entitlement of subscription.plan.entitlements) {
        planEntitlements.set(entitlement.featureKey, entitlement);
      }
    }
    const isLifecycleActive = subscription
      ? subscription.status === 'trial' || subscription.status === 'active'
      : false;
    for (const key of LICENSE_FEATURE_KEY_LIST) {
      const entitlement = planEntitlements.get(key);
      const enabled = isLifecycleActive ? Boolean(entitlement?.enabled) : false;
      map[key] = {
        enabled,
        limitValue: entitlement?.limitValue ?? null,
      };
    }
    return map;
  }

  /**
   * Lightweight gate helper. Other modules call this rather than
   * reading the entitlement table themselves so all commercial logic
   * stays inside the licensing module.
   */
  async isFeatureEnabled(
    tenantId: string,
    featureKey: LicenseFeatureKey,
  ): Promise<boolean> {
    const snapshot = await this.getTenantEntitlements(tenantId);
    return snapshot.features[featureKey]?.enabled === true;
  }

  /** Convenience accessor used by tests and the admin console. */
  getKnownFeatureKeys(): LicenseFeatureKey[] {
    return [...LICENSE_FEATURE_KEY_LIST];
  }

  /** Convenience accessor used by the admin console. */
  getCanonicalFeatureCatalog(): Array<{ key: LicenseFeatureKey; constant: string }> {
    return Object.entries(LICENSE_FEATURE_KEYS).map(([constant, key]) => ({
      constant,
      key,
    }));
  }
}
