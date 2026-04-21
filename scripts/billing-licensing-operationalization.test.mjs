#!/usr/bin/env node
/**
 * Wave 23 — Billing & Licensing Operationalization Pack v1 — pure-Node validator.
 *
 * Protects the structural contracts of the operationalization layer so
 * a future refactor cannot silently:
 *   - drop the subscription history surface;
 *   - lose real gating in the three first-class capabilities;
 *   - regress the entitlement editor or scheduled snapshot writer;
 *   - break the calm tenant-side feature availability probe.
 *
 * Run from the repo root:
 *   node scripts/billing-licensing-operationalization.test.mjs
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

async function checkSubscriptionHistory() {
  const entity = await read(
    'apps/api/src/database/entities/tenant-subscription-history.entity.ts',
  );
  if (!entity.includes("@Entity('tenant_subscription_history')")) {
    record('tenant-subscription-history.entity.ts: missing @Entity decorator on tenant_subscription_history.');
  }
  if (!entity.includes('changeKind')) {
    record('tenant-subscription-history.entity.ts: missing changeKind column.');
  }
  if (!entity.includes('actorStaffUserId')) {
    record('tenant-subscription-history.entity.ts: missing actorStaffUserId column.');
  }

  const index = await read('apps/api/src/database/entities/index.ts');
  if (!index.includes('TenantSubscriptionHistory')) {
    record('entities/index.ts: missing TenantSubscriptionHistory export.');
  }

  const migration = await read(
    'apps/api/src/database/migrations/1746900000000-Wave23BillingLicensingOperationalization.ts',
  );
  if (!migration.includes('CREATE TABLE IF NOT EXISTS "tenant_subscription_history"')) {
    record('Wave23 migration: missing CREATE TABLE for tenant_subscription_history.');
  }
  if (!/REFERENCES "tenants" \("id"\) ON DELETE CASCADE/.test(migration)) {
    record('Wave23 migration: tenant FK with CASCADE missing on tenant_subscription_history.');
  }
}

async function checkLicensingService() {
  const service = await read('apps/api/src/modules/licensing/licensing.service.ts');
  for (const helper of [
    'requireFeature',
    'getFeatureUnavailableReason',
    'updatePlanEntitlement',
    'getPlanForEditing',
    'recordUsageSnapshotIfChanged',
    'runScheduledSnapshotPass',
    'listSubscriptionHistory',
    'recordSubscriptionHistory',
  ]) {
    if (!service.includes(helper)) {
      record(`LicensingService: missing helper ${helper}().`);
    }
  }
  if (!service.includes('entitlementCache')) {
    record('LicensingService: entitlement cache missing — gating will hammer the DB.');
  }
}

async function checkScheduler() {
  const scheduler = await read(
    'apps/api/src/modules/licensing/licensing-snapshot.scheduler.ts',
  );
  if (!/OnApplicationBootstrap/.test(scheduler)) {
    record('Snapshot scheduler: must hook into OnApplicationBootstrap.');
  }
  if (!/runScheduledSnapshotPass/.test(scheduler)) {
    record('Snapshot scheduler: must call licensing.runScheduledSnapshotPass().');
  }
  if (!/LICENSING_SNAPSHOT_SCHEDULER/.test(scheduler)) {
    record('Snapshot scheduler: must honor LICENSING_SNAPSHOT_SCHEDULER=disabled.');
  }
}

async function checkFeatureGate() {
  const guard = await read('apps/api/src/modules/licensing/feature-gate.guard.ts');
  if (!/RequireFeature/.test(guard)) {
    record('feature-gate.guard.ts: must export RequireFeature decorator.');
  }
  if (!/FeatureGateGuard/.test(guard)) {
    record('feature-gate.guard.ts: must export FeatureGateGuard guard.');
  }

  const module = await read('apps/api/src/modules/licensing/licensing.module.ts');
  if (!module.includes('FeatureGateGuard')) {
    record('LicensingModule: must register and export FeatureGateGuard.');
  }
}

async function checkRealGating() {
  const branding = await read('apps/api/src/modules/tenant/tenant-branding.controller.ts');
  if (!branding.includes('PARENT_PORTAL_BRANDING')) {
    record('Tenant branding controller: must reference PARENT_PORTAL_BRANDING gate.');
  }
  if (!/@RequireFeature\(LICENSE_FEATURE_KEYS\.PARENT_PORTAL_BRANDING\)/.test(branding)) {
    record('Tenant branding controller: PUT/POST/DELETE branding routes must use @RequireFeature.');
  }

  const communications = await read(
    'apps/api/src/modules/communication/communication.controller.ts',
  );
  if (!communications.includes('COMMUNICATIONS_FOLLOW_UP')) {
    record('Communication controller: must gate /deliver with COMMUNICATIONS_FOLLOW_UP.');
  }

  const reporting = await read('apps/api/src/modules/reporting/reporting.controller.ts');
  if (!reporting.includes('REPORTING_ADVANCED_BUILDER')) {
    record('Reporting controller: must gate saved-views/export with REPORTING_ADVANCED_BUILDER.');
  }
}

async function checkPlatformControllerNewEndpoints() {
  const controller = await read(
    'apps/api/src/modules/licensing/licensing.controller.ts',
  );
  for (const route of [
    "@Get('plans/:planCode/edit')",
    "@Put('plans/:planCode/entitlements/:featureKey')",
    "@Post('usage/snapshots/run')",
    "@Get('subscriptions/:tenantId/history')",
    "@Get('feature-catalog')",
  ]) {
    if (!controller.includes(route)) {
      record(`PlatformLicensingController: missing route ${route}.`);
    }
  }

  if (!controller.includes("@Get('me/feature/:featureKey')")) {
    record('TenantLicensingController: missing /me/feature/:featureKey probe.');
  }
}

async function checkFrontendSurfaces() {
  const billingPage = await read('apps/web/src/pages/BillingLicensingPage.tsx');
  if (!billingPage.includes("'history'")) {
    record('BillingLicensingPage: missing history tab.');
  }
  if (!billingPage.includes("'editEntitlements'")) {
    record('BillingLicensingPage: missing editEntitlements tab.');
  }
  if (!billingPage.includes('/api/admin/licensing/usage/snapshots/run')) {
    record('BillingLicensingPage: must offer the scheduled snapshot trigger.');
  }
  if (!billingPage.includes('/api/admin/licensing/subscriptions/${selectedTenantId}/history')) {
    record('BillingLicensingPage: must call the new subscription history endpoint.');
  }
  if (!billingPage.includes('/api/admin/licensing/plans/${code}/edit')) {
    record('BillingLicensingPage: must call the new plan editor endpoint.');
  }

  const featureLib = await read('apps/web/src/lib/feature-availability.ts');
  if (!/useFeatureAvailability/.test(featureLib)) {
    record('feature-availability.ts: must export useFeatureAvailability hook.');
  }

  const notice = await read(
    'apps/web/src/components/licensing/FeatureAvailabilityNotice.tsx',
  );
  if (!/FeatureAvailabilityNotice/.test(notice)) {
    record('FeatureAvailabilityNotice: missing component implementation.');
  }

  const brand = await read('apps/web/src/components/branding/BrandAdminPanel.tsx');
  if (!brand.includes("'parent_portal.branding'")) {
    record('BrandAdminPanel: must read parent_portal.branding availability.');
  }

  const comms = await read('apps/web/src/pages/CommunicationsPage.tsx');
  if (!comms.includes("'communications.follow_up'")) {
    record('CommunicationsPage: must read communications.follow_up availability.');
  }

  const explorer = await read('apps/web/src/components/reporting/DataExplorer.tsx');
  if (!explorer.includes("'reporting.advanced_builder'")) {
    record('DataExplorer: must read reporting.advanced_builder availability.');
  }
}

async function checkLocaleParity() {
  for (const locale of ['en', 'tr']) {
    const json = JSON.parse(
      await read(`apps/web/src/i18n/locales/${locale}/common.json`),
    );
    const billing = json?.pages?.billing;
    if (!billing?.tabs2?.history || !billing?.tabs2?.editEntitlements) {
      record(`Locale ${locale}: pages.billing.tabs2 missing history/editEntitlements.`);
    }
    if (!billing?.history?.title || !billing?.history?.empty) {
      record(`Locale ${locale}: pages.billing.history missing title/empty.`);
    }
    if (!billing?.entitlementEditor?.title || !billing?.entitlementEditor?.save) {
      record(`Locale ${locale}: pages.billing.entitlementEditor missing title/save.`);
    }
    const gating = json?.pages?.gating;
    if (
      !gating?.platformOnly ||
      !gating?.no_subscription?.title ||
      !gating?.license_inactive?.title ||
      !gating?.plan_excludes_feature?.title
    ) {
      record(`Locale ${locale}: pages.gating.* (no_subscription/license_inactive/plan_excludes_feature) keys missing.`);
    }
    const featureCatalog = json?.pages?.billing?.featureCatalog;
    for (const key of [
      'parent_portal.branding',
      'communications.follow_up',
      'reporting.advanced_builder',
    ]) {
      if (!featureCatalog?.[key]) {
        record(`Locale ${locale}: pages.billing.featureCatalog.${key} missing.`);
      }
    }
    if (!billing?.usage?.runScheduledNow || !billing?.usage?.scheduledHint) {
      record(`Locale ${locale}: pages.billing.usage.runScheduledNow / scheduledHint missing.`);
    }
  }
}

async function main() {
  await checkSubscriptionHistory();
  await checkLicensingService();
  await checkScheduler();
  await checkFeatureGate();
  await checkRealGating();
  await checkPlatformControllerNewEndpoints();
  await checkFrontendSurfaces();
  await checkLocaleParity();

  if (failures.length > 0) {
    console.error('Wave 23 Billing & Licensing Operationalization gate failed:');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log('Wave 23 Billing & Licensing Operationalization gate OK — all contracts hold.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
