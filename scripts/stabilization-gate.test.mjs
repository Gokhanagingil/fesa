#!/usr/bin/env node
/**
 * FESA Stabilization & Productization Gate — pure-Node validator.
 *
 * This validator protects the small set of cross-module contracts the
 * stabilization pass strengthened, so a future refactor cannot silently
 * undo the trust improvements:
 *
 *   1. Action Center row mutations must surface API errors.
 *      The `runBulkAction` and per-row `mutate` paths must explicitly
 *      catch errors and route them to a visible alert. Previously the
 *      per-row `mutate` swallowed failures inside a `finally`-only
 *      block, so failed Resolve / Snooze / Dismiss actions looked
 *      successful.
 *
 *   2. Charge item delete must require confirmation.
 *      Charge items are referenced by historical athlete charges; a
 *      mis-clicked delete is destructive. We require a `window.confirm`
 *      gate on the page.
 *
 *   3. Portal home must NOT surface every action twice.
 *      The "All requests" duplication is gone; the lower section now
 *      uses the `pastRequestsTitle` key and filters out active items
 *      (open / pending_family_action / rejected) which are already
 *      shown in "What needs your attention".
 *
 *   4. Activation page must offer a recovery path on a dead invite.
 *      The previous dead-end card is now a calm card with explicit
 *      Recover / Sign-in escapes.
 *
 *   5. Settings page must honor the Header's `?section=` deep link.
 *      The Header documents anchors `platform`, `club`, `brand`,
 *      `delivery`; the page must mount matching `id`s so scroll-into-
 *      view actually works.
 *
 *   6. PortalShell mobile bottom-nav must not dead-end on non-home
 *      routes — the Family / Updates shortcuts must navigate to
 *      `/portal/home#…` when off home, not just emit a `#…` href.
 *
 * Run from the repo root:
 *   node scripts/stabilization-gate.test.mjs
 *
 * Exit code 0 = all contracts hold; non-zero = at least one regressed.
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

async function checkActionCenterErrorSurfacing() {
  const src = await read('apps/web/src/pages/ActionCenterPage.tsx');
  if (!/setRowError\(/.test(src)) {
    record('ActionCenterPage: per-row error state (setRowError) is missing.');
  }
  if (!/<InlineAlert tone="error"\s*[^>]*>\s*\{rowError\}/.test(src)) {
    record('ActionCenterPage: rowError is not rendered as an InlineAlert.');
  }
  // Bulk action error surfacing must remain — we do not want to lose
  // the existing behavior either.
  if (!/setError\(/.test(src) || !/runBulkAction/.test(src)) {
    record('ActionCenterPage: bulk error surfacing has regressed.');
  }
}

async function checkChargeItemDeleteConfirm() {
  const src = await read('apps/web/src/pages/ChargeItemsPage.tsx');
  if (!/window\.confirm\([^)]*deleteConfirm/.test(src)) {
    record('ChargeItemsPage: delete must be guarded by window.confirm with the `deleteConfirm` key.');
  }
  for (const locale of ['en', 'tr']) {
    const json = JSON.parse(await read(`apps/web/src/i18n/locales/${locale}/common.json`));
    const key = json?.pages?.chargeItems?.deleteConfirm;
    if (typeof key !== 'string' || !key.includes('{{name}}')) {
      record(`pages.chargeItems.deleteConfirm missing or missing {{name}} interpolation in ${locale}.`);
    }
  }
}

async function checkPortalHomePastRequests() {
  const src = await read('apps/web/src/pages/GuardianPortalHomePage.tsx');
  if (!/portal\.home\.pastRequestsTitle/.test(src)) {
    record('GuardianPortalHomePage: must reference portal.home.pastRequestsTitle.');
  }
  // The archive must filter out active / pending action items so the
  // "What needs your attention" surface stays the only "do this now"
  // signal on the page.
  if (!/'open',\s*'pending_family_action',\s*'rejected'/.test(src)) {
    record('GuardianPortalHomePage: past-requests archive must filter out open/pending/rejected statuses.');
  }
  for (const locale of ['en', 'tr']) {
    const json = JSON.parse(await read(`apps/web/src/i18n/locales/${locale}/common.json`));
    if (typeof json?.portal?.home?.pastRequestsTitle !== 'string') {
      record(`portal.home.pastRequestsTitle missing in ${locale}.`);
    }
    if (typeof json?.portal?.home?.pastRequestsHint !== 'string') {
      record(`portal.home.pastRequestsHint missing in ${locale}.`);
    }
  }
}

async function checkActivationRecoveryEscape() {
  const src = await read('apps/web/src/pages/GuardianPortalActivationPage.tsx');
  if (!/portal\.activate\.invalidRecoverLink/.test(src)) {
    record('GuardianPortalActivationPage: must offer portal.activate.invalidRecoverLink.');
  }
  if (!/portal\.activate\.invalidLoginLink/.test(src)) {
    record('GuardianPortalActivationPage: must offer portal.activate.invalidLoginLink.');
  }
  if (!/to="\/portal\/recover"/.test(src)) {
    record('GuardianPortalActivationPage: invalid-invite escape must link to /portal/recover.');
  }
  for (const locale of ['en', 'tr']) {
    const json = JSON.parse(await read(`apps/web/src/i18n/locales/${locale}/common.json`));
    if (typeof json?.portal?.activate?.invalidRecoverLink !== 'string') {
      record(`portal.activate.invalidRecoverLink missing in ${locale}.`);
    }
    if (typeof json?.portal?.activate?.invalidLoginLink !== 'string') {
      record(`portal.activate.invalidLoginLink missing in ${locale}.`);
    }
  }
}

async function checkSettingsSectionAnchors() {
  const src = await read('apps/web/src/pages/SettingsPage.tsx');
  for (const section of ['club', 'platform', 'brand', 'delivery']) {
    const id = `settings-section-${section}`;
    if (!new RegExp(`id="${id}"`).test(src)) {
      record(`SettingsPage: missing anchor id="${id}" for the Header's ?section=${section} deep link.`);
    }
  }
  if (!/useSearchParams/.test(src)) {
    record('SettingsPage: must read useSearchParams to honor ?section= query.');
  }
  if (!/scrollIntoView/.test(src)) {
    record('SettingsPage: must scroll matching section into view on mount.');
  }
}

async function checkPortalShellBottomNav() {
  const src = await read('apps/web/src/components/layout/PortalShell.tsx');
  // Off-home shortcuts must navigate to /portal/home#<anchor>, not
  // just rely on a hash link that does nothing on /portal/actions/:id.
  if (!/navigate\(`?\/portal\/home#/.test(src)) {
    record('PortalShell: bottom-nav off-home shortcut must navigate to /portal/home#<anchor>.');
  }
  if (!/PortalBottomNavAnchor/.test(src)) {
    record('PortalShell: PortalBottomNavAnchor helper is missing — the dead-anchor fix may have regressed.');
  }
}

async function main() {
  await checkActionCenterErrorSurfacing();
  await checkChargeItemDeleteConfirm();
  await checkPortalHomePastRequests();
  await checkActivationRecoveryEscape();
  await checkSettingsSectionAnchors();
  await checkPortalShellBottomNav();

  if (failures.length > 0) {
    console.error('Stabilization gate failed:');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log('Stabilization gate OK — all hardening contracts hold.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
