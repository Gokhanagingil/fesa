/**
 * Billing & Licensing Foundation v1 — feature key catalog.
 *
 * The set of capabilities the entitlement engine knows about. Keys are
 * deliberately small in v1; we do NOT try to gate every module right
 * away. Adding a key is cheap (one entry here, optional plan rows in
 * `license_plan_entitlements`, callers opt in via the engine helper).
 *
 * Keys are stable, lower_snake_case strings. They are the canonical
 * vocabulary of the commercial control plane — keep them honest and
 * keep them user-meaningful so the platform-admin console reads well.
 */
export const LICENSE_FEATURE_KEYS = {
  /** Onboarding wizard + import batches with concierge-style guidance. */
  ONBOARDING_ASSISTED_IMPORT: 'onboarding.assisted_import',
  /** Reporting builder + advanced filter tree (beyond starter views). */
  REPORTING_ADVANCED_BUILDER: 'reporting.advanced_builder',
  /** Communications follow-up automations beyond manual sends. */
  COMMUNICATIONS_FOLLOW_UP: 'communications.follow_up',
  /** Tenant branding (logo, palette, welcome copy) on the parent portal. */
  PARENT_PORTAL_BRANDING: 'parent_portal.branding',
  /** Targeted club updates audience model in the parent portal. */
  PARENT_PORTAL_TARGETED_UPDATES: 'parent_portal.targeted_updates',
  /** Inventory & assignment pack (apparel/equipment tracking). */
  INVENTORY_MANAGEMENT: 'inventory.management',
  /** Private lessons module surfaced for staff. */
  PRIVATE_LESSONS_MODULE: 'private_lessons.module',
} as const;

export type LicenseFeatureKey =
  (typeof LICENSE_FEATURE_KEYS)[keyof typeof LICENSE_FEATURE_KEYS];

export const LICENSE_FEATURE_KEY_LIST: LicenseFeatureKey[] = Object.values(
  LICENSE_FEATURE_KEYS,
);

/** Stable plan codes used by the seed and the platform-admin UI. */
export const LICENSE_PLAN_CODES = {
  STARTER: 'starter',
  OPERATIONS: 'operations',
  GROWTH: 'growth',
} as const;

export type LicensePlanCode =
  (typeof LICENSE_PLAN_CODES)[keyof typeof LICENSE_PLAN_CODES];

/** Stable usage-band codes used by the seed. */
export const LICENSE_USAGE_BAND_CODES = {
  COMMUNITY: 'community',
  CLUB: 'club',
  ACADEMY: 'academy',
  FEDERATION: 'federation',
} as const;

export type LicenseUsageBandCode =
  (typeof LICENSE_USAGE_BAND_CODES)[keyof typeof LICENSE_USAGE_BAND_CODES];

/** Lifecycle status set used by `tenant_subscriptions.status`. */
export const TENANT_SUBSCRIPTION_STATUSES = [
  'trial',
  'active',
  'suspended',
  'expired',
  'cancelled',
] as const;

export type TenantSubscriptionStatusValue =
  (typeof TENANT_SUBSCRIPTION_STATUSES)[number];
