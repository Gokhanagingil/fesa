export type TenantSubscriptionStatus =
  | 'trial'
  | 'active'
  | 'suspended'
  | 'expired'
  | 'cancelled';

export type LicensePlanEntitlementSummary = {
  featureKey: string;
  enabled: boolean;
  limitValue: number | null;
  notes: string | null;
};

export type LicensePlanSummary = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isDefaultTrial: boolean;
  displayOrder: number;
  entitlements: LicensePlanEntitlementSummary[];
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
  band: { id: string | null; code: string | null; label: string | null };
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
  plan: { id: string; code: string; name: string };
  status: TenantSubscriptionStatus;
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

export type TenantEntitlementPublicSummary = {
  tenantId: string;
  plan: { code: string; name: string } | null;
  status: TenantSubscriptionStatus | null;
  isLicenseActive: boolean;
  trialEndsAt: string | null;
  renewalDate: string | null;
  usage: {
    activeAthleteCount: number;
    band: { code: string | null; label: string | null };
  };
};

export type AssignSubscriptionPayload = {
  planCode: string;
  status: TenantSubscriptionStatus;
  startDate?: string | null;
  renewalDate?: string | null;
  trialEndsAt?: string | null;
  onboardingServiceIncluded?: boolean;
  internalNotes?: string | null;
  statusReason?: string | null;
};

export const TENANT_SUBSCRIPTION_STATUS_VALUES: TenantSubscriptionStatus[] = [
  'trial',
  'active',
  'suspended',
  'expired',
  'cancelled',
];
