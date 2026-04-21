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
