import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const localeDir = path.join(root, 'apps', 'web', 'src', 'i18n', 'locales');
const referenceLocale = 'en';
const comparedLocales = ['tr'];
const scopedPrefixes = [
  'app.bulk',
  'app.exportCsv',
  'app.nav.imports',
  'app.nav.onboarding',
  'pages.imports',
  'pages.onboarding',
  'pages.guardians.bulkTitle',
  'pages.guardians.bulkHint',
  'pages.guardians.bulkDelete',
  'pages.guardians.bulkDeleteConfirm',
  'pages.guardians.bulkPrepareMessage',
  'pages.inventory.bulkReturnAll',
  'pages.inventory.bulkReturnConfirm',
  'pages.inventory.bulkReturnedDone',
  'app.enums.athleteStatus',
  'pages.dashboard.recentCollectionsHint',
  'pages.dashboard.stats.guardians',
  'pages.finance.totalCharged',
  'pages.finance.totalCollected',
  'pages.finance.totalOutstanding',
  'pages.finance.totalOverdue',
  'pages.finance.totalChargedHint',
  'pages.finance.totalCollectedHint',
  'pages.finance.totalOutstandingHint',
  'pages.finance.totalOverdueHint',
  'pages.groups.headCoachSaved',
  'pages.athletes.intakeSubtitle',
  'pages.athletes.editSubtitle',
  'pages.athletes.intakeIntro',
  'pages.athletes.editIntro',
  'pages.athletes.branchHint',
  'pages.athletes.branchReadyHint',
  'pages.athletes.statusGuideTrial',
  'pages.athletes.statusGuideActive',
  'pages.athletes.statusGuidePaused',
  'pages.athletes.statusGuideInactive',
  'pages.athletes.statusGuideArchived',
  'pages.athletes.saveAndOpen',
  'pages.athletes.enrollmentTitle',
  'pages.athletes.enrollmentSubtitle',
  'pages.athletes.enrollmentHint',
  'pages.athletes.enrollmentOutstanding',
  'pages.athletes.enrollmentOverdue',
  'pages.athletes.enrollmentLessons',
  'pages.athletes.readinessStatus',
  'pages.athletes.readinessGuardian',
  'pages.athletes.readinessGuardianReady',
  'pages.athletes.readinessGuardianMissing',
  'pages.athletes.readinessGroup',
  'pages.athletes.readinessGroupMissing',
  'pages.athletes.readinessTeam',
  'pages.athletes.readinessTeamAssigned',
  'pages.athletes.readinessTeamOptional',
  'pages.athletes.readinessFinance',
  'pages.athletes.readinessFinanceOpen',
  'pages.athletes.readinessFinanceReady',
  'pages.athletes.nextActionsTitle',
  'pages.athletes.nextActionsClear',
  'pages.athletes.teamHistory',
  'pages.athleteCharges.summaryOutstanding',
  'pages.athleteCharges.summaryCollected',
  'pages.athleteCharges.summaryOverdue',
  'pages.athleteCharges.paymentTitle',
  'pages.athleteCharges.paymentHint',
  'pages.athleteCharges.chooseAthlete',
  'pages.athleteCharges.currency',
  'pages.athleteCharges.allocateCharges',
  'pages.athleteCharges.paymentMethodPlaceholder',
  'pages.athleteCharges.referencePlaceholder',
  'pages.athleteCharges.paymentTotal',
  'pages.athleteCharges.recentPayments',
  'pages.athleteCharges.recentPaymentsHint',
  'pages.athleteCharges.noPayments',
  'pages.athleteCharges.overdue',
  'pages.athleteCharges.periodicTitle',
  'pages.athleteCharges.periodicHint',
  'pages.athleteCharges.targetType',
  'pages.athleteCharges.targetSelected',
  'pages.athleteCharges.targetGroup',
  'pages.athleteCharges.targetTeam',
  'pages.athleteCharges.periodKey',
  'pages.athleteCharges.periodKeyPlaceholder',
  'pages.athleteCharges.periodLabel',
  'pages.athleteCharges.periodLabelPlaceholder',
  'pages.athleteCharges.periodicTargetSummarySelected',
  'pages.athleteCharges.periodicTargetSummaryGroup',
  'pages.athleteCharges.periodicTargetSummaryTeam',
  'pages.athleteCharges.periodicPreviewSummary',
  'pages.athleteCharges.periodicDuplicateWarning',
  'pages.athleteCharges.periodicNoDuplicates',
  'pages.athleteCharges.previewPeriodic',
  'pages.athleteCharges.generatePeriodic',
  'pages.athleteCharges.generatedPeriodic',
  // Reports launch surface - explicit parity protection so the launchpad,
  // continue panel and definition action labels never silently regress to
  // raw key rendering (Wave 16 bugfix).
  'pages.reports.launch',
  'pages.reports.definitionActions',
  'pages.reports.continueHint',
  'pages.reports.continueEmpty',
  'pages.reports.continueEmptyHint',
  'pages.reports.communicationReadyContext',
  // Athlete photo surface - keep upload/replace/remove copy aligned across locales.
  'pages.athletes.photo',
  // Parent Portal v1.1 + Brand Admin v1.1 — staff branding + club updates surfaces.
  'pages.brandAdmin',
  'pages.clubUpdates',
  // Parent Portal v1.1 — calm "From the club" strip (parent home).
  'portal.home.clubUpdatesTitle',
  'portal.home.clubUpdatesHint',
  'portal.home.clubUpdatePinned',
  'portal.home.clubUpdateOpenLink',
  'portal.home.clubUpdateCategory',
  // Sidebar nav keys for the club updates surface.
  'app.nav.clubUpdates',
  // Parent Portal v1.2 — Targeted announcements + family utility refinement +
  // parent recovery UX. Protect every new key set across both locales so the
  // staff editor, recovery surface, and refined home never silently drift.
  'pages.clubUpdates.audience',
  'pages.guardians.portalAccess.recoveryRequested',
  'portal.home.thisWeekTitle',
  'portal.home.thisWeekHint',
  'portal.home.inventoryTitle',
  'portal.home.inventoryQuantity',
  'portal.home.clubUpdateAudienceFor',
  'portal.login.forgotAccess',
  'portal.login.recoveryHint',
  'portal.recovery',
  // Family Activation & Landing Pack v1 — staff-side activation visibility,
  // calm follow-up audience slices, and the parent first-landing surfaces.
  'pages.guardians.activationViewToggle',
  'pages.guardians.activation',
  'pages.communications.portalNotActivatedOnly',
  'pages.communications.portalRecoveryOnly',
  'portal.home.landingBadge',
  'portal.home.landingTitle',
  'portal.home.landingTitleClub',
  'portal.home.landingBody',
  'portal.home.essentialsTitle',
  'portal.home.essentialsHint',
  'portal.home.essentials',
  // Parent Portal v1.3 — Family Communication Continuity, Payment
  // Readiness, and Club-to-Family Trust Layer. Protect every new
  // parent-facing key set across both locales so the calm continuity
  // strip and the payment readiness card never silently drift.
  'portal.home.continuityTitle',
  'portal.home.continuityHint',
  'portal.home.continuityBadgeClubUpdate',
  'portal.home.continuityBadgeFamilyRequest',
  'portal.home.continuityStatusOpen',
  'portal.home.continuityStatusReview',
  'portal.home.continuityStatusResolved',
  'portal.home.continuityStatusClosed',
  'portal.home.continuityForAudience',
  'portal.home.continuityOpenHint',
  'portal.home.paymentTitle',
  'portal.home.paymentClearTag',
  'portal.home.paymentClearBody',
  'portal.home.paymentOpenHint',
  'portal.home.paymentAttentionHint',
  'portal.home.paymentTotalLabel',
  'portal.home.paymentOverdueLabel',
  'portal.home.paymentNextDueLabel',
  'portal.home.paymentDueOn',
  'portal.home.paymentNoDueDate',
  'portal.home.paymentStatusOverdue',
  'portal.home.paymentStatusDueSoon',
  'portal.home.paymentStatusOpen',
  'portal.home.paymentOpenFooter',
  'portal.home.paymentAttentionFooter',
  // FESA Stabilization & Productization Gate — calmer past-requests
  // archive replaces the old "All requests" duplicate, plus explicit
  // recovery / sign-in escapes from a dead activation card. Protect
  // every parent-facing key set across both locales.
  'portal.home.pastRequestsTitle',
  'portal.home.pastRequestsHint',
  'portal.activate.invalidRecoverLink',
  'portal.activate.invalidLoginLink',
];

function flattenKeys(input, prefix = '') {
  if (Array.isArray(input)) {
    return input.flatMap((value, index) => flattenKeys(value, `${prefix}[${index}]`));
  }

  if (input && typeof input === 'object') {
    return Object.entries(input).flatMap(([key, value]) =>
      flattenKeys(value, prefix ? `${prefix}.${key}` : key),
    );
  }

  return [prefix];
}

async function loadLocale(locale) {
  const filePath = path.join(localeDir, locale, 'common.json');
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function diffKeys(referenceKeys, targetKeys) {
  const referenceOnly = referenceKeys.filter((key) => !targetKeys.includes(key));
  const targetOnly = targetKeys.filter((key) => !referenceKeys.includes(key));
  return { referenceOnly, targetOnly };
}

function isScopedKey(key) {
  return scopedPrefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}.`));
}

async function main() {
  const reference = await loadLocale(referenceLocale);
  const referenceKeys = flattenKeys(reference).filter(isScopedKey).sort();

  let failed = false;

  for (const locale of comparedLocales) {
    const current = await loadLocale(locale);
    const localeKeys = flattenKeys(current).filter(isScopedKey).sort();
    const { referenceOnly, targetOnly } = diffKeys(referenceKeys, localeKeys);

    if (referenceOnly.length === 0 && targetOnly.length === 0) {
      continue;
    }

    failed = true;
    console.error(`Locale parity mismatch: ${referenceLocale} vs ${locale}`);

    if (referenceOnly.length > 0) {
      console.error(`  Missing in ${locale}:`);
      referenceOnly.forEach((key) => console.error(`    - ${key}`));
    }

    if (targetOnly.length > 0) {
      console.error(`  Extra in ${locale}:`);
      targetOnly.forEach((key) => console.error(`    + ${key}`));
    }
  }

  if (failed) {
    process.exitCode = 1;
    return;
  }

  console.log('Locale parity OK');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
