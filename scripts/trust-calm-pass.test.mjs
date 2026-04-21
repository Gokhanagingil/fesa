#!/usr/bin/env node
/**
 * FESA Stabilization & Productization Gate — Trust & Calm Pass validator.
 *
 * This validator protects the small set of cross-module contracts that the
 * Trust & Calm Pass strengthened on top of the existing stabilization gate
 * and finance clarity pack. The goal is to keep the calmer, more
 * trustworthy parent-facing journey from silently regressing on the next
 * refactor:
 *
 *   1. The landing page must ship every locale key it references.
 *      The landing page is the first impression for both staff and
 *      parents. A missing key here renders the raw key string in the
 *      hero, which breaks trust before the user even logs in. We
 *      assert the small landing contract ships across EN and TR.
 *
 *   2. The shared API client fallback message must be localized.
 *      Previously a network blip / proxy 502 with no usable response
 *      body fell back to hardcoded English ("Request failed"), which
 *      the parent portal — otherwise fully Turkish for TR users —
 *      would surface in error states. We require the fallback to use
 *      i18n.t('app.errors.requestFailed').
 *
 *   3. GuardianPortalActionPage must not infinite-spinner on a missing
 *      :id route param. A parent who reaches the page without an id
 *      (broken bookmark, share-truncated link, manual typo) used to
 *      sit forever on the loading line. We require the effect to
 *      resolve `setLoading(false)` on the missing-id path.
 *
 *   4. GuardianPortalActionPage primary submit must be a real, mobile-
 *      first primary control. The previous compact py-2 button sat
 *      undersized vs the textarea above it on a phone. We require an
 *      `h-12` mobile target on the submit control, matching the
 *      activation / login pages.
 *
 *   5. PortalShell sign-out must be a comfortable tap target on mobile.
 *      The only deliberate exit from the parent portal must not be a
 *      sub-spec target on a phone. We require `min-h-[40px]`.
 *
 *   6. CommunicationsPage must surface bundle / history fetch failures.
 *      The previous silent catches made a broken backend look like a
 *      brand-new tenant. Both the bundle (`/api/groups`, etc.) and
 *      history loaders must feed `setError(...)` on failure.
 *
 * Run from the repo root:
 *   node scripts/trust-calm-pass.test.mjs
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

async function loadLocale(locale) {
  return JSON.parse(await read(`apps/web/src/i18n/locales/${locale}/common.json`));
}

async function checkLandingLocaleParity() {
  const expected = [
    'ctaPrimary',
    'ctaPortal',
    'ctaSecondary',
    'entryTitle',
    'entryStaffTitle',
    'entryStaffBody',
    'entryGuardianTitle',
    'entryGuardianBody',
  ];
  for (const locale of ['en', 'tr']) {
    const json = await loadLocale(locale);
    const landing = json?.landing ?? {};
    for (const key of expected) {
      if (typeof landing[key] !== 'string' || landing[key].length === 0) {
        record(`landing.${key} missing or empty in ${locale}.`);
      }
    }
  }
  // The landing page must reference the new entry copy keys (it must
  // not silently fall back to dashboard/groups subtitles for filler).
  const src = await read('apps/web/src/pages/LandingPage.tsx');
  for (const key of [
    'landing.entryTitle',
    'landing.entryStaffTitle',
    'landing.entryStaffBody',
    'landing.entryGuardianTitle',
    'landing.entryGuardianBody',
  ]) {
    if (!src.includes(key)) {
      record(`LandingPage.tsx must reference ${key} (calm landing copy).`);
    }
  }
  // The previous mixed-source fillers must be gone — they were a
  // long-running source of accidental copy churn on the landing page.
  if (/pages\.dashboard\.subtitle/.test(src) || /pages\.groups\.subtitle/.test(src)) {
    record(
      'LandingPage.tsx must not reuse pages.dashboard.subtitle / pages.groups.subtitle as filler copy — use landing.entry* instead.',
    );
  }
}

async function checkApiFallbackLocalized() {
  const src = await read('apps/web/src/lib/api.ts');
  if (!/i18n\.t\(\s*['"]app\.errors\.requestFailed['"]\s*\)/.test(src)) {
    record(
      "lib/api.ts parseError fallback must use i18n.t('app.errors.requestFailed') instead of a hardcoded English string.",
    );
  }
  for (const locale of ['en', 'tr']) {
    const json = await loadLocale(locale);
    if (typeof json?.app?.errors?.requestFailed !== 'string') {
      record(`app.errors.requestFailed missing in ${locale}.`);
    }
  }
}

async function checkActionPageIdGuard() {
  const src = await read('apps/web/src/pages/GuardianPortalActionPage.tsx');
  // The id-guard branch must explicitly resolve the loading state so
  // the page never infinite-spinners. We look for the pattern that
  // sets loading=false inside the missing-id branch.
  const guardBlock = src.match(/if\s*\(\s*!id\s*\)\s*\{[^}]*\}/);
  if (!guardBlock || !/setLoading\(false\)/.test(guardBlock[0])) {
    record(
      'GuardianPortalActionPage.tsx: missing-id branch must call setLoading(false) so the page never infinite-spinners.',
    );
  }
}

async function checkActionPageMobilePrimary() {
  const src = await read('apps/web/src/pages/GuardianPortalActionPage.tsx');
  // The submit Button must adopt the mobile-first h-12 / w-full pattern
  // that the activation and login pages already use.
  if (!/h-12\s+w-full[^"]*"\s*\n?\s*>?\s*\n?\s*\{saving/.test(src) && !/className=\"h-12 w-full[^\"]*\"/.test(src)) {
    // Looser check: ensure the submit area at minimum mentions the
    // h-12 token paired with w-full (so a refactor that splits the
    // class into multiple lines still passes).
    if (!/(h-12[^"]*w-full|w-full[^"]*h-12)/.test(src)) {
      record(
        'GuardianPortalActionPage.tsx: primary submit must adopt the mobile-first h-12 / w-full pattern (matching activation/login).',
      );
    }
  }
}

async function checkPortalShellSignOutTapTarget() {
  const src = await read('apps/web/src/components/layout/PortalShell.tsx');
  if (!/min-h-\[40px\]/.test(src)) {
    record('PortalShell.tsx: sign-out control must use min-h-[40px] for a comfortable mobile tap target.');
  }
}

async function checkCommunicationsErrorSurfacing() {
  const src = await read('apps/web/src/pages/CommunicationsPage.tsx');
  // The bundle loader must call setError on failure (not just empty
  // every dropdown). The previous swallow-only catch made a broken
  // backend look like a brand-new tenant.
  const bundleCatch = src.match(/setTokens\(\[\]\);\s*\n\s*setError\(/);
  if (!bundleCatch) {
    record(
      'CommunicationsPage.tsx: bundle loader must call setError after clearing dropdowns so a broken backend does not look like an empty tenant.',
    );
  }
  // The history loader must call setError on failure too, otherwise a
  // failed fetch is indistinguishable from "no follow-up has ever
  // happened on this tenant".
  const historyCatch = src.match(/archived: 0,\s*\n\s*\},?\s*\n\s*\}\);\s*\n\s*setError\(/);
  if (!historyCatch) {
    record(
      'CommunicationsPage.tsx: history loader must call setError after clearing counts so a failed history fetch is visible.',
    );
  }
}

async function main() {
  await checkLandingLocaleParity();
  await checkApiFallbackLocalized();
  await checkActionPageIdGuard();
  await checkActionPageMobilePrimary();
  await checkPortalShellSignOutTapTarget();
  await checkCommunicationsErrorSurfacing();

  if (failures.length > 0) {
    console.error('Trust & Calm Pass gate failed:');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log('Trust & Calm Pass gate OK — all hardening contracts hold.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
