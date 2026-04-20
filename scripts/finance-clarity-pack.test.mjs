#!/usr/bin/env node
/**
 * Athlete Charges Flow Flattening & Collections Clarity Pack — validator.
 *
 * This validator protects the small set of UX contracts that the
 * Collections Clarity Pack introduced, so a future refactor cannot
 * silently undo the calmer staff-side finance experience:
 *
 *   1. AthleteChargesPage must use a single action drawer.
 *      The previous layout stacked three nested <details> action panels
 *      (bulk assign + periodic generation + record collection) at equal
 *      visual weight, which created competing primary actions and a
 *      noisy mobile rhythm. The clarity pack collapses these into one
 *      drawer with a segmented control where only the chosen action
 *      panel is mounted at a time.
 *
 *   2. AthleteChargesPage must surface the collections clarity strip.
 *      Staff need a calm "who needs attention right now" view above the
 *      noisy charge list. The strip reuses the existing finance summary
 *      and links to the existing communications follow-up surface, so
 *      no parallel collections workflow is created.
 *
 *   3. AthleteChargesPage must preserve source/context honesty when
 *      handing off to communications. The follow-up links must declare
 *      the existing `source=finance_overdue` surface and pass an
 *      explicit `sourceKey` so the existing follow-up history can
 *      re-open the original list.
 *
 *   4. FinanceHubPage must lead with the collections-first sequence:
 *      summary → primary action surface (athlete charges) → priority
 *      collections → demoted "more tools" strip. The reporting hero
 *      must NOT sit above the priority collections section anymore.
 *
 *   5. EN + TR must both ship the new calmer copy keys (drawer labels,
 *      attention strip, finance hub primary hint). This is enforced
 *      separately by `npm run i18n:check`, but the validator double-
 *      checks a representative subset to keep contracts visible.
 *
 * Run from the repo root:
 *   node scripts/finance-clarity-pack.test.mjs
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

async function checkAthleteChargesActionDrawer() {
  const src = await read('apps/web/src/pages/AthleteChargesPage.tsx');

  // Single-drawer state model.
  if (!/openAction,\s*setOpenAction/.test(src)) {
    record('AthleteChargesPage: single openAction state is missing — drawer collapse may have regressed.');
  }
  if (!/role="tablist"/.test(src) || !/aria-selected=\{isOpen\}/.test(src)) {
    record('AthleteChargesPage: action drawer must expose a tablist with aria-selected segmented controls.');
  }

  // The three action panels must be conditionally mounted, not stacked.
  for (const panel of ['payment', 'bulk', 'periodic']) {
    if (!new RegExp(`openAction === '${panel}'`).test(src)) {
      record(`AthleteChargesPage: action panel "${panel}" must be conditionally mounted via openAction.`);
    }
    if (!new RegExp(`charge-action-panel-${panel}`).test(src)) {
      record(`AthleteChargesPage: action panel "${panel}" missing accessible id charge-action-panel-${panel}.`);
    }
  }

  // The previous layout's tell-tale "stack of three <details open>" must be
  // gone. We accept at most 3 <details> elements total (advanced-details
  // disclosures inside the drawer + the athlete picker), and none of them
  // may carry the `open` attribute that previously force-stacked panels.
  // Strip block + line comments first so descriptive prose does not count.
  const codeOnly = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\n)\s*\/\/.*$/gm, '$1')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  const detailsTags = codeOnly.match(/<details\b[^>]*>/g) ?? [];
  if (detailsTags.length > 3) {
    record(
      `AthleteChargesPage: too many <details> disclosures (${detailsTags.length}). The clarity pack expects at most 3 calmer disclosures.`,
    );
  }
  if (detailsTags.some((tag) => /\bopen\b/.test(tag))) {
    record('AthleteChargesPage: no <details> may use the `open` attribute — calmer disclosures must default closed.');
  }

  // Drawer keys.
  for (const key of [
    'pages.athleteCharges.actions.title',
    'pages.athleteCharges.actions.recordPayment',
    'pages.athleteCharges.actions.bulkAssign',
    'pages.athleteCharges.actions.periodic',
  ]) {
    if (!src.includes(key)) {
      record(`AthleteChargesPage: drawer copy key "${key}" must be referenced by the page.`);
    }
  }
}

async function checkAttentionStrip() {
  const src = await read('apps/web/src/pages/AthleteChargesPage.tsx');
  if (!/attentionAthletes/.test(src) || !/attentionCount/.test(src)) {
    record('AthleteChargesPage: collections clarity strip (attentionAthletes/attentionCount) is missing.');
  }
  for (const key of [
    'pages.athleteCharges.attention.title',
    'pages.athleteCharges.attention.openFollowUp',
    'pages.athleteCharges.attention.viewCharges',
  ]) {
    if (!src.includes(key)) {
      record(`AthleteChargesPage: attention strip copy key "${key}" must be referenced by the page.`);
    }
  }
}

async function checkFollowUpSourceHonesty() {
  const src = await read('apps/web/src/pages/AthleteChargesPage.tsx');
  // Source/context preservation: the follow-up links must declare both the
  // existing source surface and an explicit sourceKey rooted at this page.
  if (!/source=finance_overdue/.test(src)) {
    record('AthleteChargesPage: follow-up handoff must declare source=finance_overdue.');
  }
  if (!/sourceKey=athlete-charges/.test(src)) {
    record('AthleteChargesPage: follow-up handoff must include a sourceKey=athlete-charges* identifier.');
  }
  if (!/template=overdue_payment_reminder/.test(src)) {
    record('AthleteChargesPage: follow-up handoff must reuse template=overdue_payment_reminder.');
  }
}

async function checkFinanceHubOrdering() {
  const src = await read('apps/web/src/pages/FinanceHubPage.tsx');

  // Summary band must come before the primary action surface and before the
  // priority collections section. Reporting must be demoted into the "more
  // tools" strip. The previous layout placed the reporting hero on top.
  const totalChargedIdx = src.indexOf("pages.finance.totalCharged");
  const primaryHintIdx = src.indexOf("pages.finance.athleteChargesPrimaryHint");
  const priorityIdx = src.indexOf("pages.finance.priorityCollections");
  const moreToolsIdx = src.indexOf("pages.finance.moreToolsTitle");
  const reportingIdx = src.indexOf("pages.finance.reportingTitle");

  if (totalChargedIdx === -1 || primaryHintIdx === -1 || priorityIdx === -1 || moreToolsIdx === -1) {
    record('FinanceHubPage: the calmer ordering anchors (summary, primary action, priority, more tools) are missing.');
    return;
  }

  if (!(totalChargedIdx < primaryHintIdx && primaryHintIdx < priorityIdx && priorityIdx < moreToolsIdx)) {
    record(
      'FinanceHubPage: section order regressed. Expected summary → athlete-charges primary → priority collections → more tools.',
    );
  }

  if (reportingIdx !== -1 && reportingIdx < priorityIdx) {
    record('FinanceHubPage: reporting hero must sit BELOW the priority collections section, not above it.');
  }

  // The athlete-charges primary surface must be a real link, not a checklist bullet.
  if (!/to="\/app\/finance\/athlete-charges"/.test(src)) {
    record('FinanceHubPage: primary athlete-charges surface must link to /app/finance/athlete-charges.');
  }
}

async function checkLocaleCopyParity() {
  for (const locale of ['en', 'tr']) {
    const json = JSON.parse(await read(`apps/web/src/i18n/locales/${locale}/common.json`));
    const requiredCharges = json?.pages?.athleteCharges;
    if (!requiredCharges?.actions?.recordPayment || !requiredCharges?.attention?.title) {
      record(`pages.athleteCharges.actions / attention copy missing in ${locale}.`);
    }
    const finance = json?.pages?.finance;
    if (typeof finance?.athleteChargesPrimaryHint !== 'string' || typeof finance?.moreToolsTitle !== 'string') {
      record(`pages.finance.athleteChargesPrimaryHint / moreToolsTitle missing in ${locale}.`);
    }
  }
}

async function main() {
  await checkAthleteChargesActionDrawer();
  await checkAttentionStrip();
  await checkFollowUpSourceHonesty();
  await checkFinanceHubOrdering();
  await checkLocaleCopyParity();

  if (failures.length > 0) {
    console.error('Finance clarity pack gate failed:');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log('Finance clarity pack gate OK — all collections clarity contracts hold.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
