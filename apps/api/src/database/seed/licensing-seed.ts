/**
 * Billing & Licensing Foundation v1 — idempotent seed.
 *
 * Seeds the canonical commercial backbone for demo + staging:
 *   - 3 plans: Starter, Operations, Growth
 *   - per-plan entitlement mappings tuned for each tier
 *   - 4 usage bands (Community / Club / Academy / Federation)
 *   - one tenant subscription per demo club so platform admins always
 *     see realistic lifecycle state on first login
 *
 * Every row id is deterministic via `stableId(...)` so re-running
 * `npm run seed:demo` upserts in place. No commercial state is ever
 * orphaned.
 */
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import {
  LicensePlan,
  LicensePlanEntitlement,
  LicenseUsageBand,
  Tenant,
  TenantSubscription,
} from '../entities';
import {
  LICENSE_FEATURE_KEYS,
  LICENSE_PLAN_CODES,
  LICENSE_USAGE_BAND_CODES,
  LicenseFeatureKey,
} from '../../modules/licensing/license.constants';
import { CLUB_SLUGS } from './constants';

function stableId(...parts: string[]): string {
  const digest = createHash('sha256').update(JSON.stringify(parts)).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

type SeedPlan = {
  code: string;
  name: string;
  description: string;
  displayOrder: number;
  isDefaultTrial: boolean;
  entitlements: Array<{
    featureKey: LicenseFeatureKey;
    enabled: boolean;
    limitValue?: number | null;
    notes?: string | null;
  }>;
};

const SEED_PLANS: SeedPlan[] = [
  {
    code: LICENSE_PLAN_CODES.STARTER,
    name: 'Starter',
    description:
      'Calm starting point for small clubs: athletes, training, finance basics, and the parent portal core.',
    displayOrder: 10,
    isDefaultTrial: true,
    entitlements: [
      {
        featureKey: LICENSE_FEATURE_KEYS.ONBOARDING_ASSISTED_IMPORT,
        enabled: true,
        notes: 'Self-serve onboarding wizard with guided imports.',
      },
      {
        featureKey: LICENSE_FEATURE_KEYS.PARENT_PORTAL_BRANDING,
        enabled: false,
        notes: 'Branding stays platform-default on Starter.',
      },
      {
        featureKey: LICENSE_FEATURE_KEYS.PARENT_PORTAL_TARGETED_UPDATES,
        enabled: false,
      },
      {
        featureKey: LICENSE_FEATURE_KEYS.REPORTING_ADVANCED_BUILDER,
        enabled: false,
        notes: 'Starter views only.',
      },
      {
        featureKey: LICENSE_FEATURE_KEYS.COMMUNICATIONS_FOLLOW_UP,
        enabled: false,
      },
      {
        featureKey: LICENSE_FEATURE_KEYS.INVENTORY_MANAGEMENT,
        enabled: false,
      },
      {
        featureKey: LICENSE_FEATURE_KEYS.PRIVATE_LESSONS_MODULE,
        enabled: true,
      },
    ],
  },
  {
    code: LICENSE_PLAN_CODES.OPERATIONS,
    name: 'Operations',
    description:
      'Day-to-day operational depth: communications follow-up, inventory, parent branding, targeted updates.',
    displayOrder: 20,
    isDefaultTrial: false,
    entitlements: [
      {
        featureKey: LICENSE_FEATURE_KEYS.ONBOARDING_ASSISTED_IMPORT,
        enabled: true,
      },
      {
        featureKey: LICENSE_FEATURE_KEYS.PARENT_PORTAL_BRANDING,
        enabled: true,
      },
      {
        featureKey: LICENSE_FEATURE_KEYS.PARENT_PORTAL_TARGETED_UPDATES,
        enabled: true,
      },
      {
        featureKey: LICENSE_FEATURE_KEYS.REPORTING_ADVANCED_BUILDER,
        enabled: false,
        notes: 'Reporting builder unlocks at Growth.',
      },
      {
        featureKey: LICENSE_FEATURE_KEYS.COMMUNICATIONS_FOLLOW_UP,
        enabled: true,
      },
      {
        featureKey: LICENSE_FEATURE_KEYS.INVENTORY_MANAGEMENT,
        enabled: true,
      },
      {
        featureKey: LICENSE_FEATURE_KEYS.PRIVATE_LESSONS_MODULE,
        enabled: true,
      },
    ],
  },
  {
    code: LICENSE_PLAN_CODES.GROWTH,
    name: 'Growth',
    description:
      'Full commercial backbone: every operational module plus the advanced reporting builder.',
    displayOrder: 30,
    isDefaultTrial: false,
    entitlements: [
      {
        featureKey: LICENSE_FEATURE_KEYS.ONBOARDING_ASSISTED_IMPORT,
        enabled: true,
      },
      {
        featureKey: LICENSE_FEATURE_KEYS.PARENT_PORTAL_BRANDING,
        enabled: true,
      },
      {
        featureKey: LICENSE_FEATURE_KEYS.PARENT_PORTAL_TARGETED_UPDATES,
        enabled: true,
      },
      {
        featureKey: LICENSE_FEATURE_KEYS.REPORTING_ADVANCED_BUILDER,
        enabled: true,
      },
      {
        featureKey: LICENSE_FEATURE_KEYS.COMMUNICATIONS_FOLLOW_UP,
        enabled: true,
      },
      {
        featureKey: LICENSE_FEATURE_KEYS.INVENTORY_MANAGEMENT,
        enabled: true,
      },
      {
        featureKey: LICENSE_FEATURE_KEYS.PRIVATE_LESSONS_MODULE,
        enabled: true,
      },
    ],
  },
];

const SEED_BANDS = [
  {
    code: LICENSE_USAGE_BAND_CODES.COMMUNITY,
    label: 'Community (0–75 athletes)',
    minAthletes: 0,
    maxAthletes: 76,
    displayOrder: 10,
  },
  {
    code: LICENSE_USAGE_BAND_CODES.CLUB,
    label: 'Club (76–200 athletes)',
    minAthletes: 76,
    maxAthletes: 201,
    displayOrder: 20,
  },
  {
    code: LICENSE_USAGE_BAND_CODES.ACADEMY,
    label: 'Academy (201–500 athletes)',
    minAthletes: 201,
    maxAthletes: 501,
    displayOrder: 30,
  },
  {
    code: LICENSE_USAGE_BAND_CODES.FEDERATION,
    label: 'Federation (500+ athletes)',
    minAthletes: 501,
    maxAthletes: null,
    displayOrder: 40,
  },
];

type SeedTenantSubscription = {
  tenantSlug: string;
  planCode: string;
  status: 'trial' | 'active' | 'suspended' | 'expired' | 'cancelled';
  onboardingServiceIncluded: boolean;
  trialDaysFromNow?: number;
  renewalDaysFromNow?: number;
  internalNotes?: string;
};

const SEED_TENANT_SUBSCRIPTIONS: SeedTenantSubscription[] = [
  {
    tenantSlug: CLUB_SLUGS.kadikoy,
    planCode: LICENSE_PLAN_CODES.OPERATIONS,
    status: 'active',
    onboardingServiceIncluded: true,
    renewalDaysFromNow: 240,
    internalNotes: 'Anchor demo club — Operations plan with onboarding services.',
  },
  {
    tenantSlug: CLUB_SLUGS.fesa,
    planCode: LICENSE_PLAN_CODES.GROWTH,
    status: 'active',
    onboardingServiceIncluded: true,
    renewalDaysFromNow: 320,
    internalNotes: 'Reference Growth tenant for advanced reporting demos.',
  },
  {
    tenantSlug: CLUB_SLUGS.moda,
    planCode: LICENSE_PLAN_CODES.STARTER,
    status: 'trial',
    onboardingServiceIncluded: false,
    trialDaysFromNow: 21,
    internalNotes: 'Trial example — Starter plan, parents-first.',
  },
  {
    tenantSlug: CLUB_SLUGS.marmara,
    planCode: LICENSE_PLAN_CODES.OPERATIONS,
    status: 'suspended',
    onboardingServiceIncluded: false,
    internalNotes: 'Suspended example so the lifecycle UI shows a non-active state.',
  },
];

export async function runLicensingSeed(dataSource: DataSource): Promise<void> {
  await dataSource.transaction(async (manager) => {
    const planRepo = manager.getRepository(LicensePlan);
    const entitlementRepo = manager.getRepository(LicensePlanEntitlement);
    const bandRepo = manager.getRepository(LicenseUsageBand);
    const tenantRepo = manager.getRepository(Tenant);
    const subscriptionRepo = manager.getRepository(TenantSubscription);

    const planByCode = new Map<string, LicensePlan>();
    for (const seed of SEED_PLANS) {
      const id = stableId('license-plan', seed.code);
      const existing = await planRepo.findOne({ where: [{ id }, { code: seed.code }] });
      const row = existing ?? planRepo.create({ id });
      row.code = seed.code;
      row.name = seed.name;
      row.description = seed.description;
      row.displayOrder = seed.displayOrder;
      row.isActive = true;
      row.isDefaultTrial = seed.isDefaultTrial;
      const saved = await planRepo.save(row);
      planByCode.set(saved.code, saved);

      for (const entitlement of seed.entitlements) {
        const entitlementId = stableId(
          'license-plan-entitlement',
          seed.code,
          entitlement.featureKey,
        );
        const existingEntitlement = await entitlementRepo.findOne({
          where: { planId: saved.id, featureKey: entitlement.featureKey },
        });
        const entitlementRow =
          existingEntitlement ??
          entitlementRepo.create({
            id: entitlementId,
            planId: saved.id,
            featureKey: entitlement.featureKey,
          });
        entitlementRow.enabled = entitlement.enabled;
        entitlementRow.limitValue = entitlement.limitValue ?? null;
        entitlementRow.notes = entitlement.notes ?? null;
        await entitlementRepo.save(entitlementRow);
      }
    }

    for (const seed of SEED_BANDS) {
      const id = stableId('license-usage-band', seed.code);
      const existing = await bandRepo.findOne({ where: [{ id }, { code: seed.code }] });
      const row = existing ?? bandRepo.create({ id });
      row.code = seed.code;
      row.label = seed.label;
      row.minAthletes = seed.minAthletes;
      row.maxAthletes = seed.maxAthletes;
      row.displayOrder = seed.displayOrder;
      row.isActive = true;
      await bandRepo.save(row);
    }

    const now = new Date();
    for (const seed of SEED_TENANT_SUBSCRIPTIONS) {
      const tenant = await tenantRepo.findOne({ where: { slug: seed.tenantSlug } });
      if (!tenant) continue;
      const plan = planByCode.get(seed.planCode);
      if (!plan) continue;
      const id = stableId('tenant-subscription', tenant.id);
      const existing = await subscriptionRepo.findOne({ where: { tenantId: tenant.id } });
      const row =
        existing ??
        subscriptionRepo.create({ id, tenantId: tenant.id });
      row.planId = plan.id;
      row.status = seed.status;
      row.startDate = row.startDate ?? new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30);
      row.renewalDate =
        seed.renewalDaysFromNow !== undefined
          ? new Date(now.getTime() + seed.renewalDaysFromNow * 24 * 60 * 60 * 1000)
          : null;
      row.trialEndsAt =
        seed.trialDaysFromNow !== undefined
          ? new Date(now.getTime() + seed.trialDaysFromNow * 24 * 60 * 60 * 1000)
          : null;
      row.onboardingServiceIncluded = seed.onboardingServiceIncluded;
      row.internalNotes = seed.internalNotes ?? null;
      await subscriptionRepo.save(row);
    }
  });
}
