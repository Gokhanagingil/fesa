#!/usr/bin/env node
/**
 * Billing & Licensing Foundation v1 — pure-Node validator.
 *
 * This validator protects the structural contracts the commercial
 * backbone introduced, so a future refactor cannot silently undo
 * tenant isolation, lifecycle correctness, or the platform-admin-only
 * boundary.
 *
 *   1. The five commercial entities exist and are wired into the
 *      shared entities index.
 *   2. The Wave 22 migration creates the five tables with the
 *      expected tenant FKs and uniqueness invariants.
 *   3. The licensing module is registered in the API and exposes
 *      both the platform-admin and tenant-readable controllers.
 *   4. The platform-admin guard is applied at the controller class
 *      level on `PlatformLicensingController`, never on the tenant
 *      summary controller.
 *   5. The seed registers Starter / Operations / Growth, the four
 *      usage bands, and one tenant subscription per demo club.
 *   6. The frontend route + sidebar link is platform-admin-only.
 *   7. EN + TR carry the calm copy keys for the new console.
 *
 * Run from the repo root:
 *   node scripts/billing-licensing.test.mjs
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function record(message) {
  failures.push(message);
}

async function read(rel) {
  return readFile(path.join(root, rel), 'utf8');
}

async function checkEntities() {
  const entities = [
    'license-plan.entity.ts',
    'license-plan-entitlement.entity.ts',
    'license-usage-band.entity.ts',
    'tenant-subscription.entity.ts',
    'tenant-usage-snapshot.entity.ts',
  ];
  for (const file of entities) {
    try {
      await read(`apps/api/src/database/entities/${file}`);
    } catch {
      record(`entities: missing required file ${file}`);
    }
  }
  const index = await read('apps/api/src/database/entities/index.ts');
  for (const sym of [
    'LicensePlan',
    'LicensePlanEntitlement',
    'LicenseUsageBand',
    'TenantSubscription',
    'TenantUsageSnapshot',
  ]) {
    if (!index.includes(sym)) {
      record(`entities/index.ts: missing ${sym} export.`);
    }
  }
}

async function checkMigration() {
  const migration = await read(
    'apps/api/src/database/migrations/1746800000000-Wave22BillingLicensingFoundation.ts',
  );
  for (const table of [
    'license_plans',
    'license_plan_entitlements',
    'license_usage_bands',
    'tenant_subscriptions',
    'tenant_usage_snapshots',
  ]) {
    if (!migration.includes(`CREATE TABLE IF NOT EXISTS "${table}"`)) {
      record(`Wave22 migration: missing CREATE TABLE for ${table}.`);
    }
  }
  if (!/REFERENCES "tenants" \("id"\) ON DELETE CASCADE/.test(migration)) {
    record('Wave22 migration: tenant FK with CASCADE missing.');
  }
  if (!/IDX_tenant_subscriptions_tenant.*UNIQUE/i.test(migration) && !/CREATE UNIQUE INDEX[^"]*"IDX_tenant_subscriptions_tenant"/.test(migration)) {
    record('Wave22 migration: unique index on tenant_subscriptions(tenantId) missing.');
  }
}

async function checkLicensingModule() {
  const appModule = await read('apps/api/src/app.module.ts');
  if (!appModule.includes('LicensingModule')) {
    record('app.module.ts: LicensingModule must be registered.');
  }

  const controller = await read(
    'apps/api/src/modules/licensing/licensing.controller.ts',
  );
  // Class-level platform-admin guard.
  if (
    !/@Controller\('admin\/licensing'\)\s*\n@UseGuards\(PlatformAdminGuard\)/.test(
      controller,
    )
  ) {
    record(
      'PlatformLicensingController: platform-admin guard must be applied at class level on /admin/licensing.',
    );
  }
  if (!controller.includes("@Controller('licensing')")) {
    record('TenantLicensingController missing — tenant read-only endpoint should live at /licensing.');
  }
  // Confirm the tenant controller never names the platform-admin guard.
  const tenantBlock = controller.split("@Controller('licensing')")[1] ?? '';
  if (tenantBlock.includes('PlatformAdminGuard')) {
    record('TenantLicensingController must not reference PlatformAdminGuard.');
  }

  const guard = await read('apps/api/src/modules/licensing/platform-admin.guard.ts');
  if (!guard.includes('global_admin')) {
    record('platform-admin.guard: must enforce StaffPlatformRole.GLOBAL_ADMIN.');
  }

  const service = await read('apps/api/src/modules/licensing/licensing.service.ts');
  for (const helper of [
    'isFeatureEnabled',
    'getTenantEntitlements',
    'evaluateUsage',
    'recordUsageSnapshot',
    'assignSubscription',
  ]) {
    if (!service.includes(helper)) {
      record(`LicensingService: missing helper ${helper}().`);
    }
  }
}

async function checkSeed() {
  const seed = await read('apps/api/src/database/seed/licensing-seed.ts');
  for (const planConstant of ['STARTER', 'OPERATIONS', 'GROWTH']) {
    if (!seed.includes(`LICENSE_PLAN_CODES.${planConstant}`)) {
      record(`licensing-seed: missing plan reference LICENSE_PLAN_CODES.${planConstant}.`);
    }
  }
  for (const bandConstant of ['COMMUNITY', 'CLUB', 'ACADEMY', 'FEDERATION']) {
    if (!seed.includes(`LICENSE_USAGE_BAND_CODES.${bandConstant}`)) {
      record(`licensing-seed: missing usage band reference LICENSE_USAGE_BAND_CODES.${bandConstant}.`);
    }
  }
  if (!seed.includes('runLicensingSeed')) {
    record('licensing-seed: must export runLicensingSeed().');
  }

  const constants = await read('apps/api/src/modules/licensing/license.constants.ts');
  for (const planValue of ['starter', 'operations', 'growth']) {
    if (!constants.includes(`'${planValue}'`)) {
      record(`license.constants: missing canonical plan code value '${planValue}'.`);
    }
  }
  for (const bandValue of ['community', 'club', 'academy', 'federation']) {
    if (!constants.includes(`'${bandValue}'`)) {
      record(`license.constants: missing canonical band code value '${bandValue}'.`);
    }
  }

  const runner = await read('apps/api/src/database/seed/run-demo-seed.ts');
  if (!runner.includes('runLicensingSeed')) {
    record('run-demo-seed: must call runLicensingSeed.');
  }
}

async function checkFrontendGate() {
  const sidebar = await read('apps/web/src/components/layout/Sidebar.tsx');
  if (!sidebar.includes("key: 'billing'")) {
    record('Sidebar: missing billing nav entry.');
  }
  if (!/platformAdminOnly:\s*true/.test(sidebar)) {
    record('Sidebar: billing entry must be guarded by platformAdminOnly.');
  }
  if (!sidebar.includes('canAccessCrossTenant')) {
    record('Sidebar: must filter platform-admin-only entries by canAccessCrossTenant.');
  }

  const app = await read('apps/web/src/App.tsx');
  if (!app.includes('/app/billing')) {
    record('App.tsx: missing /app/billing route.');
  }

  const page = await read('apps/web/src/pages/BillingLicensingPage.tsx');
  if (!page.includes("staffUser?.platformRole === 'global_admin'")) {
    record('BillingLicensingPage: must short-circuit non-platform-admin viewers.');
  }
  if (!page.includes('/api/admin/licensing/subscriptions')) {
    record('BillingLicensingPage: must talk to /api/admin/licensing endpoints.');
  }
}

async function checkLocaleParity() {
  for (const locale of ['en', 'tr']) {
    const json = JSON.parse(
      await read(`apps/web/src/i18n/locales/${locale}/common.json`),
    );
    if (!json?.app?.nav?.billing) {
      record(`Locale ${locale}: app.nav.billing missing.`);
    }
    const billing = json?.pages?.billing;
    if (!billing?.title || !billing?.subtitle) {
      record(`Locale ${locale}: pages.billing.title / subtitle missing.`);
    }
    for (const status of ['trial', 'active', 'suspended', 'expired', 'cancelled']) {
      if (!billing?.statuses?.[status]) {
        record(`Locale ${locale}: pages.billing.statuses.${status} missing.`);
      }
    }
    const licensingSummary = json?.pages?.settings?.licensing;
    if (!licensingSummary?.title || !licensingSummary?.platformOnly) {
      record(`Locale ${locale}: pages.settings.licensing.title / platformOnly missing.`);
    }
  }
}

async function main() {
  await checkEntities();
  await checkMigration();
  await checkLicensingModule();
  await checkSeed();
  await checkFrontendGate();
  await checkLocaleParity();

  if (failures.length > 0) {
    console.error('Billing & Licensing Foundation v1 gate failed:');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log('Billing & Licensing Foundation v1 gate OK — all contracts hold.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
