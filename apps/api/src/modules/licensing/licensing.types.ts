import type {
  LicenseFeatureKey,
  TenantSubscriptionStatusValue,
} from './license.constants';

export type LicensePlanSummary = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isDefaultTrial: boolean;
  displayOrder: number;
  entitlements: Array<{
    featureKey: string;
    enabled: boolean;
    limitValue: number | null;
    notes: string | null;
  }>;
};

export type LicenseUsageBandSummary = {
  id: string;
  code: string;
  label: string;
  minAthletes: number;
  maxAthletes: number | null;
  displayOrder: number;
  isActive: boolean;
};

export type TenantUsageEvaluation = {
  tenantId: string;
  measuredAt: string;
  activeAthleteCount: number;
  band: {
    id: string | null;
    code: string | null;
    label: string | null;
  };
  source: 'live' | 'snapshot';
};

export type TenantUsageSnapshotSummary = {
  id: string;
  tenantId: string;
  measuredAt: string;
  activeAthleteCount: number;
  bandCode: string | null;
  bandLabel: string | null;
  source: 'manual' | 'scheduled' | 'api';
  createdAt: string;
};

export type TenantSubscriptionSummary = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  plan: {
    id: string;
    code: string;
    name: string;
  };
  status: TenantSubscriptionStatusValue;
  startDate: string | null;
  renewalDate: string | null;
  trialEndsAt: string | null;
  onboardingServiceIncluded: boolean;
  internalNotes: string | null;
  statusReason: string | null;
  assignedByDisplayName: string | null;
  lastChangedByDisplayName: string | null;
  createdAt: string;
  updatedAt: string;
  usage: TenantUsageEvaluation;
};

export type TenantEntitlementSnapshot = {
  tenantId: string;
  plan: {
    id: string;
    code: string;
    name: string;
  } | null;
  status: TenantSubscriptionStatusValue | null;
  /**
   * `true` when the lifecycle is `trial` or `active`. Suspended /
   * expired / cancelled subscriptions evaluate every gate to `false`
   * to make commercial state honest at the boundary.
   */
  isLicenseActive: boolean;
  features: Record<
    LicenseFeatureKey,
    {
      enabled: boolean;
      limitValue: number | null;
    }
  >;
  usage: TenantUsageEvaluation;
};

export type TenantEntitlementPublicSummary = {
  tenantId: string;
  plan: { code: string; name: string } | null;
  status: TenantSubscriptionStatusValue | null;
  isLicenseActive: boolean;
  trialEndsAt: string | null;
  renewalDate: string | null;
  usage: {
    activeAthleteCount: number;
    band: { code: string | null; label: string | null };
  };
};

/**
 * Wave 23 — calm "why is this not available" payload.
 * Reasons are designed to map directly to UI copy keys.
 */
export type LicenseFeatureUnavailableReason =
  | { reason: 'no_subscription'; featureKey: LicenseFeatureKey }
  | {
      reason: 'license_inactive';
      featureKey: LicenseFeatureKey;
      planCode: string;
      planName: string;
      status: TenantSubscriptionStatusValue | null;
    }
  | {
      reason: 'plan_excludes_feature';
      featureKey: LicenseFeatureKey;
      planCode: string;
      planName: string;
      status: TenantSubscriptionStatusValue | null;
    };

export type UpdatePlanEntitlementInput = {
  enabled: boolean;
  limitValue?: number | null;
  notes?: string | null;
};

export type TenantSubscriptionHistoryEntry = {
  id: string;
  tenantId: string;
  subscriptionId: string | null;
  changeKind:
    | 'created'
    | 'plan_change'
    | 'status_change'
    | 'dates_change'
    | 'metadata_change';
  changedFields: string[];
  previousPlanCode: string | null;
  nextPlanCode: string | null;
  previousStatus: TenantSubscriptionStatusValue | null;
  nextStatus: TenantSubscriptionStatusValue | null;
  statusReason: string | null;
  internalNote: string | null;
  actorDisplayName: string | null;
  changedAt: string;
};
