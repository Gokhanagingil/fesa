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
  'pages.imports',
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
