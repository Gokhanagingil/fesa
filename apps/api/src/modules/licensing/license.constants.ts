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

/**
 * Wave 23 — feature catalog metadata.
 *
 * Lightweight, code-side catalog so the platform-admin entitlement
 * editor can render groups, names, and i18n keys without a second
 * matrix table. Keys are i18n suffixes — the web client resolves them
 * under `pages.billing.featureCatalog.*` to keep TR/EN parity honest.
 *
 * Order in the array drives the visual order in the editor.
 */
export type LicenseFeatureCatalogEntry = {
  key: LicenseFeatureKey;
  group: 'parent_portal' | 'communications' | 'reporting' | 'operations' | 'onboarding';
  /** True for the small set we have actively wired through real gating. */
  gatingActive: boolean;
  /** Whether the entitlement supports a numeric `limitValue` editor. */
  supportsLimit: boolean;
};

export const LICENSE_FEATURE_CATALOG: LicenseFeatureCatalogEntry[] = [
  {
    key: LICENSE_FEATURE_KEYS.PARENT_PORTAL_BRANDING,
    group: 'parent_portal',
    gatingActive: true,
    supportsLimit: false,
  },
  {
    key: LICENSE_FEATURE_KEYS.PARENT_PORTAL_TARGETED_UPDATES,
    group: 'parent_portal',
    gatingActive: false,
    supportsLimit: false,
  },
  {
    key: LICENSE_FEATURE_KEYS.COMMUNICATIONS_FOLLOW_UP,
    group: 'communications',
    gatingActive: true,
    supportsLimit: false,
  },
  {
    key: LICENSE_FEATURE_KEYS.REPORTING_ADVANCED_BUILDER,
    group: 'reporting',
    gatingActive: true,
    supportsLimit: false,
  },
  {
    key: LICENSE_FEATURE_KEYS.INVENTORY_MANAGEMENT,
    group: 'operations',
    gatingActive: false,
    supportsLimit: false,
  },
  {
    key: LICENSE_FEATURE_KEYS.PRIVATE_LESSONS_MODULE,
    group: 'operations',
    gatingActive: false,
    supportsLimit: false,
  },
  {
    key: LICENSE_FEATURE_KEYS.ONBOARDING_ASSISTED_IMPORT,
    group: 'onboarding',
    gatingActive: false,
    supportsLimit: false,
  },
];

export const LICENSE_FEATURE_GROUPS = [
  'parent_portal',
  'communications',
  'reporting',
  'operations',
  'onboarding',
] as const;

export type LicenseFeatureGroup = (typeof LICENSE_FEATURE_GROUPS)[number];
