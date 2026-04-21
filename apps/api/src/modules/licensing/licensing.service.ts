import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Athlete } from '../../database/entities/athlete.entity';
import { LicensePlan } from '../../database/entities/license-plan.entity';
import { LicensePlanEntitlement } from '../../database/entities/license-plan-entitlement.entity';
import { LicenseUsageBand } from '../../database/entities/license-usage-band.entity';
import { StaffUser } from '../../database/entities/staff-user.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import {
  TenantSubscription,
  TenantSubscriptionStatus,
} from '../../database/entities/tenant-subscription.entity';
import {
  TenantSubscriptionHistory,
  TenantSubscriptionHistoryChangeKind,
} from '../../database/entities/tenant-subscription-history.entity';
import {
  TenantUsageSnapshot,
  TenantUsageSnapshotSource,
} from '../../database/entities/tenant-usage-snapshot.entity';
import { AthleteStatus } from '../../database/enums';
import {
  LICENSE_FEATURE_CATALOG,
  LICENSE_FEATURE_KEY_LIST,
  LICENSE_FEATURE_KEYS,
  LicenseFeatureCatalogEntry,
  LicenseFeatureKey,
  TENANT_SUBSCRIPTION_STATUSES,
  TenantSubscriptionStatusValue,
} from './license.constants';
import type {
  LicenseFeatureUnavailableReason,
  LicensePlanSummary,
  LicenseUsageBandSummary,
  TenantEntitlementPublicSummary,
  TenantEntitlementSnapshot,
  TenantSubscriptionHistoryEntry,
  TenantSubscriptionSummary,
  TenantUsageEvaluation,
  TenantUsageSnapshotSummary,
  UpdatePlanEntitlementInput,
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
  private readonly logger = new Logger(LicensingService.name);

  /**
   * Tiny in-process entitlement cache. Centralised gating reads from
   * `getTenantEntitlements` for every protected request, so without a
   * cache hot endpoints would join `tenant_subscriptions` →
   * `license_plans` → `license_plan_entitlements` on every call. The
   * cache is invalidated on every commercial mutation we own
   * (`assignSubscription`, `updatePlanEntitlement`, snapshot writes
   * for the tenant). Default TTL is short enough that a stale value is
   * never user-visible for long.
   */
  private readonly entitlementCacheTtlMs = 30_000;
  private readonly entitlementCache = new Map<
    string,
    { snapshot: TenantEntitlementSnapshot; expiresAt: number }
  >();

  constructor(
    @InjectRepository(LicensePlan)
    private readonly plans: Repository<LicensePlan>,
    @InjectRepository(LicensePlanEntitlement)
    private readonly planEntitlements: Repository<LicensePlanEntitlement>,
    @InjectRepository(LicenseUsageBand)
    private readonly bands: Repository<LicenseUsageBand>,
    @InjectRepository(TenantSubscription)
    private readonly subscriptions: Repository<TenantSubscription>,
    @InjectRepository(TenantSubscriptionHistory)
    private readonly subscriptionHistory: Repository<TenantSubscriptionHistory>,
    @InjectRepository(TenantUsageSnapshot)
    private readonly usageSnapshots: Repository<TenantUsageSnapshot>,
    @InjectRepository(Tenant)
    private readonly tenants: Repository<Tenant>,
    @InjectRepository(Athlete)
    private readonly athletes: Repository<Athlete>,
    @InjectRepository(StaffUser)
    private readonly staffUsers: Repository<StaffUser>,
    private readonly dataSource: DataSource,
  ) {}

  // ------------------------------------------------------------------
  // Cache helpers
  // ------------------------------------------------------------------

  private invalidateEntitlementCache(tenantId?: string): void {
    if (!tenantId) {
      this.entitlementCache.clear();
      return;
    }
    this.entitlementCache.delete(tenantId);
  }

  private invalidateAllEntitlementCaches(): void {
    this.entitlementCache.clear();
  }

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

  /**
   * Wave 23 — append-aware writer used by the scheduled snapshot job.
   * Skips creating a row when the most recent snapshot for the tenant
   * already matches the live evaluation (same band + same active count
   * within the cadence window). Keeps the history strip honest without
   * spamming duplicate rows when nothing changed.
   *
   * Returns `null` when no row was written.
   */
  async recordUsageSnapshotIfChanged(
    tenantId: string,
    source: TenantUsageSnapshotSource,
    options: { minIntervalMs?: number } = {},
  ): Promise<TenantUsageSnapshotSummary | null> {
    const evaluation = await this.evaluateUsage(tenantId);
    const minIntervalMs = options.minIntervalMs ?? 60 * 60 * 1000;
    const last = await this.usageSnapshots.findOne({
      where: { tenantId },
      order: { measuredAt: 'DESC' },
    });
    if (last) {
      const sameCount = last.activeAthleteCount === evaluation.activeAthleteCount;
      const sameBand = (last.bandCode ?? null) === (evaluation.band.code ?? null);
      const ageMs = Date.now() - last.measuredAt.getTime();
      if (sameCount && sameBand && ageMs < minIntervalMs) {
        return null;
      }
    }
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
      relations: ['plan'],
    });
    const previous = existing
      ? {
          planId: existing.planId,
          planCode: existing.plan?.code ?? null,
          status: existing.status,
          startDate: existing.startDate,
          renewalDate: existing.renewalDate,
          trialEndsAt: existing.trialEndsAt,
          onboardingServiceIncluded: existing.onboardingServiceIncluded,
          internalNotes: existing.internalNotes,
          statusReason: existing.statusReason,
        }
      : null;

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

    const saved = await this.subscriptions.save(row);
    await this.recordSubscriptionHistory({
      tenantId: input.tenantId,
      subscriptionId: saved.id,
      previous,
      next: {
        planId: plan.id,
        planCode: plan.code,
        status: row.status,
        startDate: row.startDate,
        renewalDate: row.renewalDate,
        trialEndsAt: row.trialEndsAt,
        onboardingServiceIncluded: row.onboardingServiceIncluded,
        internalNotes: row.internalNotes,
        statusReason: row.statusReason,
      },
      actingStaffUserId: input.actingStaffUserId ?? null,
      isNew,
    });
    this.invalidateEntitlementCache(input.tenantId);
    return this.getTenantSubscription(input.tenantId);
  }

  // ------------------------------------------------------------------
  // Subscription history (Wave 23)
  // ------------------------------------------------------------------

  /**
   * Append a history row capturing the diff between previous and next
   * subscription state. We never throw out of the history writer — a
   * commercial mutation is the source of truth, and a degraded ledger
   * should not block the operator. We log loudly instead.
   */
  private async recordSubscriptionHistory(args: {
    tenantId: string;
    subscriptionId: string | null;
    previous:
      | {
          planId: string;
          planCode: string | null;
          status: TenantSubscriptionStatus;
          startDate: Date | null;
          renewalDate: Date | null;
          trialEndsAt: Date | null;
          onboardingServiceIncluded: boolean;
          internalNotes: string | null;
          statusReason: string | null;
        }
      | null;
    next: {
      planId: string;
      planCode: string;
      status: TenantSubscriptionStatus;
      startDate: Date | null;
      renewalDate: Date | null;
      trialEndsAt: Date | null;
      onboardingServiceIncluded: boolean;
      internalNotes: string | null;
      statusReason: string | null;
    };
    actingStaffUserId: string | null;
    isNew: boolean;
  }): Promise<void> {
    try {
      const changedFields: string[] = [];
      let changeKind: TenantSubscriptionHistoryChangeKind = 'metadata_change';

      if (args.isNew || !args.previous) {
        changeKind = 'created';
        changedFields.push('plan', 'status');
      } else {
        if (args.previous.planId !== args.next.planId) {
          changeKind = 'plan_change';
          changedFields.push('plan');
        }
        if (args.previous.status !== args.next.status) {
          if (changeKind === 'metadata_change') changeKind = 'status_change';
          changedFields.push('status');
        }
        const datesDiffer =
          (args.previous.startDate?.getTime() ?? null) !==
            (args.next.startDate?.getTime() ?? null) ||
          (args.previous.renewalDate?.getTime() ?? null) !==
            (args.next.renewalDate?.getTime() ?? null) ||
          (args.previous.trialEndsAt?.getTime() ?? null) !==
            (args.next.trialEndsAt?.getTime() ?? null);
        if (datesDiffer) {
          if (changeKind === 'metadata_change') changeKind = 'dates_change';
          changedFields.push('dates');
        }
        if (
          args.previous.onboardingServiceIncluded !==
          args.next.onboardingServiceIncluded
        ) {
          changedFields.push('onboardingService');
        }
        if ((args.previous.internalNotes ?? null) !== (args.next.internalNotes ?? null)) {
          changedFields.push('internalNotes');
        }
        if ((args.previous.statusReason ?? null) !== (args.next.statusReason ?? null)) {
          changedFields.push('statusReason');
        }
      }

      if (changedFields.length === 0) {
        // Nothing actually changed — do not write a noisy row.
        return;
      }

      const actor = args.actingStaffUserId
        ? await this.staffUsers.findOne({ where: { id: args.actingStaffUserId } })
        : null;

      const entry = this.subscriptionHistory.create({
        tenantId: args.tenantId,
        subscriptionId: args.subscriptionId,
        previousPlanId: args.previous?.planId ?? null,
        nextPlanId: args.next.planId,
        previousPlanCode: args.previous?.planCode ?? null,
        nextPlanCode: args.next.planCode,
        previousStatus: args.previous?.status ?? null,
        nextStatus: args.next.status,
        changeKind,
        changedFields,
        statusReason: args.next.statusReason ?? null,
        internalNote: args.next.internalNotes ?? null,
        actorStaffUserId: args.actingStaffUserId,
        actorDisplayName: actor ? this.formatStaffName(actor) : null,
        changedAt: new Date(),
      });
      await this.subscriptionHistory.save(entry);
    } catch (err) {
      this.logger.error(
        `Failed to write subscription history for tenant ${args.tenantId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  async listSubscriptionHistory(
    tenantId: string,
    limit = 25,
  ): Promise<TenantSubscriptionHistoryEntry[]> {
    const rows = await this.subscriptionHistory.find({
      where: { tenantId },
      order: { changedAt: 'DESC' },
      take: Math.max(1, Math.min(100, limit)),
    });
    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      subscriptionId: row.subscriptionId,
      changeKind: row.changeKind,
      changedFields: Array.isArray(row.changedFields) ? row.changedFields : [],
      previousPlanCode: row.previousPlanCode,
      nextPlanCode: row.nextPlanCode,
      previousStatus: row.previousStatus,
      nextStatus: row.nextStatus,
      statusReason: row.statusReason,
      internalNote: row.internalNote,
      actorDisplayName: row.actorDisplayName,
      changedAt: row.changedAt.toISOString(),
    }));
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
    const cached = this.entitlementCache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.snapshot;
    }
    const subscription = await this.subscriptions.findOne({
      where: { tenantId },
      relations: ['plan', 'plan.entitlements'],
    });
    const usage = await this.evaluateUsage(tenantId);

    const features = this.buildFeatureMap(subscription);
    const isLicenseActive = subscription
      ? subscription.status === 'trial' || subscription.status === 'active'
      : false;

    const snapshot: TenantEntitlementSnapshot = {
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
    this.entitlementCache.set(tenantId, {
      snapshot,
      expiresAt: Date.now() + this.entitlementCacheTtlMs,
    });
    return snapshot;
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

  /**
   * Wave 23 — single, honest gate that callers use to short-circuit a
   * protected operation. Returns `null` when the feature is allowed, or
   * the reason it is unavailable when not. Reasons are designed to map
   * cleanly to calm UI copy keys on the client (`pages.gating.*`).
   */
  async getFeatureUnavailableReason(
    tenantId: string,
    featureKey: LicenseFeatureKey,
  ): Promise<LicenseFeatureUnavailableReason | null> {
    const snapshot = await this.getTenantEntitlements(tenantId);
    if (!snapshot.plan) {
      return { reason: 'no_subscription', featureKey };
    }
    if (!snapshot.isLicenseActive) {
      return {
        reason: 'license_inactive',
        featureKey,
        planCode: snapshot.plan.code,
        planName: snapshot.plan.name,
        status: snapshot.status,
      };
    }
    if (!snapshot.features[featureKey]?.enabled) {
      return {
        reason: 'plan_excludes_feature',
        featureKey,
        planCode: snapshot.plan.code,
        planName: snapshot.plan.name,
        status: snapshot.status,
      };
    }
    return null;
  }

  /**
   * Wave 23 — strict variant for write paths that should refuse with a
   * 403 when a tenant is not entitled. UI surfaces should call
   * `getFeatureUnavailableReason` first to render calm copy; this is
   * the server-side defence-in-depth gate.
   */
  async requireFeature(
    tenantId: string,
    featureKey: LicenseFeatureKey,
  ): Promise<void> {
    const reason = await this.getFeatureUnavailableReason(tenantId, featureKey);
    if (!reason) return;
    throw new ForbiddenException({
      message: 'Feature is not available on the current license.',
      featureKey,
      reason: reason.reason,
    });
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

  getFeatureCatalog(): LicenseFeatureCatalogEntry[] {
    return LICENSE_FEATURE_CATALOG.map((entry) => ({ ...entry }));
  }

  // ------------------------------------------------------------------
  // Plan entitlement editing (Wave 23)
  // ------------------------------------------------------------------

  /**
   * Editable view of a single plan with the canonical feature matrix
   * filled out (every catalog feature shows up, even if no row yet
   * exists in `license_plan_entitlements`). Lets the admin UI render a
   * calm grid without showing "missing" rows differently from
   * "explicitly off" rows.
   */
  async getPlanForEditing(planCode: string): Promise<{
    plan: LicensePlanSummary;
    matrix: Array<{
      featureKey: LicenseFeatureKey;
      enabled: boolean;
      limitValue: number | null;
      notes: string | null;
      catalog: LicenseFeatureCatalogEntry;
    }>;
  }> {
    const plan = await this.plans.findOne({
      where: { code: planCode },
      relations: ['entitlements'],
    });
    if (!plan) {
      throw new NotFoundException(`Plan not found: ${planCode}`);
    }
    const summary = this.serializePlan(plan);
    const byKey = new Map(
      (plan.entitlements ?? []).map((row) => [row.featureKey, row]),
    );
    const matrix = LICENSE_FEATURE_CATALOG.map((entry) => {
      const row = byKey.get(entry.key);
      return {
        featureKey: entry.key,
        enabled: row?.enabled ?? false,
        limitValue: row?.limitValue ?? null,
        notes: row?.notes ?? null,
        catalog: { ...entry },
      };
    });
    return { plan: summary, matrix };
  }

  /**
   * Upsert a single feature entitlement on a plan. We intentionally
   * keep the API one-feature-at-a-time — it makes the UI easier to
   * reason about (one save flow per feature, no giant atomic blob),
   * matches the calm-edit principle, and avoids a foot-gun where a
   * single save toggles five things at once.
   */
  async updatePlanEntitlement(
    planCode: string,
    featureKey: LicenseFeatureKey,
    input: UpdatePlanEntitlementInput,
  ): Promise<LicensePlanSummary> {
    if (!LICENSE_FEATURE_KEY_LIST.includes(featureKey)) {
      throw new BadRequestException(`Unknown feature key: ${featureKey}`);
    }
    const plan = await this.plans.findOne({ where: { code: planCode } });
    if (!plan) {
      throw new NotFoundException(`Plan not found: ${planCode}`);
    }
    if (!plan.isActive) {
      throw new BadRequestException('Cannot edit entitlements on a retired plan');
    }

    const limitValue =
      typeof input.limitValue === 'number' && Number.isFinite(input.limitValue)
        ? Math.max(0, Math.floor(input.limitValue))
        : null;
    const notes = input.notes !== undefined ? input.notes ?? null : null;

    const existing = await this.planEntitlements.findOne({
      where: { planId: plan.id, featureKey },
    });
    const row =
      existing ??
      this.planEntitlements.create({
        planId: plan.id,
        featureKey,
      });
    row.enabled = Boolean(input.enabled);
    row.limitValue = limitValue;
    if (input.notes !== undefined) row.notes = notes;
    await this.planEntitlements.save(row);

    // Editing entitlements affects every tenant on this plan, so we
    // clear the entire entitlement cache. The cache is per-tenant so
    // wiping it is cheap; gates re-warm on the next request.
    this.invalidateAllEntitlementCaches();

    const reloaded = await this.plans.findOne({
      where: { id: plan.id },
      relations: ['entitlements'],
    });
    return this.serializePlan(reloaded!);
  }

  // ------------------------------------------------------------------
  // Scheduled snapshot job (Wave 23)
  // ------------------------------------------------------------------

  /**
   * Iterate every tenant and append a snapshot only when the value
   * changed since the last row. Designed for a daily cadence — we use
   * a 6-hour minimum interval so a manual snapshot taken just before
   * the scheduled tick does not immediately get duplicated.
   */
  async runScheduledSnapshotPass(): Promise<{
    tenantsScanned: number;
    snapshotsWritten: number;
  }> {
    const tenants = await this.tenants.find({ order: { name: 'ASC' } });
    let snapshotsWritten = 0;
    for (const tenant of tenants) {
      try {
        const snapshot = await this.recordUsageSnapshotIfChanged(tenant.id, 'scheduled', {
          minIntervalMs: 6 * 60 * 60 * 1000,
        });
        if (snapshot) {
          snapshotsWritten += 1;
        }
      } catch (err) {
        this.logger.warn(
          `Scheduled snapshot pass failed for tenant ${tenant.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return { tenantsScanned: tenants.length, snapshotsWritten };
  }
}
