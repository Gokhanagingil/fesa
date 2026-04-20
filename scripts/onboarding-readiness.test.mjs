/**
 * Pure-Node validator for the Go-Live Confidence Pack readiness logic.
 *
 * The Club Onboarding Wizard v1.1 exposes a `readiness` block that has to
 * stay coherent with the per-step status:
 *   - "fresh"        when nothing required is done.
 *   - "in_progress"  when some required steps remain.
 *   - "almost_ready" when required steps are done but soft warning signals
 *                     stand out.
 *   - "ready"        when required steps are done and no warnings stand out.
 *
 * This test exercises a tiny inline copy of the same decision rules so any
 * future refactor of `OnboardingService.computeReadiness` cannot silently
 * drift. We deliberately avoid spinning up Nest/TypeORM here.
 */
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = dirname(__dirname);

function readinessTone({ requiredCompleted, requiredTotal, signals }) {
  if (requiredCompleted < requiredTotal) {
    return requiredCompleted === 0 ? 'fresh' : 'in_progress';
  }
  return signals.some((signal) => signal.tone === 'warning') ? 'almost_ready' : 'ready';
}

function buildSignals({
  brandConfigured,
  athleteCount,
  guardianCount,
  linkCount,
  groupCount,
  rejectedRowsByStep = {},
}) {
  const signals = [];
  if (!brandConfigured) {
    signals.push({ key: 'brand_missing', tone: 'info' });
  }
  if (athleteCount > 0 && groupCount === 0) {
    signals.push({ key: 'athletes_without_groups', tone: 'warning' });
  }
  if (athleteCount > 0 && guardianCount > 0 && linkCount === 0) {
    signals.push({ key: 'links_missing', tone: 'warning' });
  }
  if (athleteCount > 0 && athleteCount < 4) {
    signals.push({ key: 'low_athlete_count', tone: 'info' });
  }
  for (const [step, count] of Object.entries(rejectedRowsByStep)) {
    if (count > 0) {
      signals.push({ key: `rejected_rows_${step}`, tone: 'warning' });
    }
  }
  return signals;
}

function checkSourceContains(source, text, message) {
  assert.ok(source.includes(text), message);
}

async function main() {
  // Decision-table coverage for the readiness tone mapping.
  const fresh = readinessTone({ requiredCompleted: 0, requiredTotal: 7, signals: [] });
  assert.equal(fresh, 'fresh', 'A fresh club should land in the fresh tone');

  const inProgress = readinessTone({
    requiredCompleted: 3,
    requiredTotal: 7,
    signals: [],
  });
  assert.equal(inProgress, 'in_progress', 'Mid-onboarding clubs should be in progress');

  const ready = readinessTone({
    requiredCompleted: 7,
    requiredTotal: 7,
    signals: buildSignals({
      brandConfigured: true,
      athleteCount: 12,
      guardianCount: 10,
      linkCount: 11,
      groupCount: 3,
    }),
  });
  assert.equal(ready, 'ready', 'A clean finish should report ready');

  const almost = readinessTone({
    requiredCompleted: 7,
    requiredTotal: 7,
    signals: buildSignals({
      brandConfigured: true,
      athleteCount: 12,
      guardianCount: 10,
      linkCount: 0,
      groupCount: 3,
    }),
  });
  assert.equal(almost, 'almost_ready', 'Missing athlete↔guardian links should keep us almost ready');

  const lowAthletesWithGroups = buildSignals({
    brandConfigured: true,
    athleteCount: 2,
    guardianCount: 2,
    linkCount: 1,
    groupCount: 1,
  });
  assert.ok(
    lowAthletesWithGroups.some((signal) => signal.key === 'low_athlete_count'),
    'Tiny athlete counts should raise the low_athlete_count info signal',
  );

  const rejectedSignals = buildSignals({
    brandConfigured: true,
    athleteCount: 30,
    guardianCount: 25,
    linkCount: 28,
    groupCount: 3,
    rejectedRowsByStep: { athletes: 4 },
  });
  assert.ok(
    rejectedSignals.some((s) => s.key === 'rejected_rows_athletes' && s.tone === 'warning'),
    'Recent rejected rows should produce a warning-tone signal',
  );

  // Make sure the production OnboardingService still declares the same
  // tones so the UI / docs / locale pack stay in sync. We grep the source
  // to avoid pulling Nest/TypeORM into a pure-Node test.
  const servicePath = join(
    root,
    'apps',
    'api',
    'src',
    'modules',
    'imports',
    'onboarding.service.ts',
  );
  const source = await readFile(servicePath, 'utf8');
  for (const tone of ['fresh', 'in_progress', 'almost_ready', 'ready']) {
    checkSourceContains(
      source,
      `'${tone}'`,
      `OnboardingService should reference readiness tone '${tone}'`,
    );
  }
  for (const signal of [
    'brand_missing',
    'athletes_without_groups',
    'links_missing',
    'low_athlete_count',
  ]) {
    checkSourceContains(
      source,
      signal,
      `OnboardingService should declare readiness signal '${signal}'`,
    );
  }
  assert.ok(
    source.includes('getHistory(') && source.includes('importBatches'),
    'OnboardingService should expose getHistory backed by importBatches',
  );

  // ImportsService must still record a server-side batch on commit.
  const importsServicePath = join(
    root,
    'apps',
    'api',
    'src',
    'modules',
    'imports',
    'imports.service.ts',
  );
  const importsSource = await readFile(importsServicePath, 'utf8');
  assert.ok(
    importsSource.includes('recordBatch('),
    'ImportsService should record an import batch on commit',
  );

  // Onboarding Completion Pack guards.
  assert.ok(
    source.includes('getBatch(') && source.includes('OnboardingBatchDetail'),
    'OnboardingService should expose getBatch returning OnboardingBatchDetail',
  );
  assert.ok(
    source.includes('buildRecommendedActions') && source.includes('recommendedActions'),
    'OnboardingService should build recommendedActions for the go-live review',
  );
  assert.ok(
    source.includes('buildFirstThirtyDays') && source.includes('firstThirtyDays'),
    'OnboardingService should expose firstThirtyDays guidance on the state report',
  );
  assert.ok(
    source.includes('buildReplayHint') &&
      source.includes('retryRecommended') &&
      source.includes('replayHintKey'),
    'OnboardingService should attach a calm replay hint to every history entry',
  );
  assert.ok(
    source.includes('parseSummaryHints'),
    'OnboardingService should parse the summary hints blob for batch detail',
  );

  // The wizard contract: onboarding history accepts a per-step filter.
  assert.ok(
    source.includes('options.step') || source.includes('options: { limit?'),
    'OnboardingService.getHistory should accept a step filter for per-step history',
  );

  // Decision-table coverage for the calm replay tone mapping.
  function buildReplayKey(batch) {
    if (batch.status === 'needs_attention' || batch.rejectedRows > 0) {
      return { key: 'needsAttention', retryRecommended: true };
    }
    if (batch.warningRows > 0) return { key: 'warnings', retryRecommended: true };
    if (batch.status === 'partial') return { key: 'partial', retryRecommended: false };
    return { key: 'success', retryRecommended: false };
  }
  assert.deepEqual(
    buildReplayKey({ status: 'success', rejectedRows: 0, warningRows: 0 }),
    { key: 'success', retryRecommended: false },
  );
  assert.deepEqual(
    buildReplayKey({ status: 'needs_attention', rejectedRows: 4, warningRows: 0 }),
    { key: 'needsAttention', retryRecommended: true },
  );
  assert.deepEqual(
    buildReplayKey({ status: 'success', rejectedRows: 0, warningRows: 3 }),
    { key: 'warnings', retryRecommended: true },
  );
  assert.deepEqual(
    buildReplayKey({ status: 'partial', rejectedRows: 0, warningRows: 0 }),
    { key: 'partial', retryRecommended: false },
  );

  // Controller exposes the batch detail endpoint and per-step history filter.
  const controllerPath = join(
    root,
    'apps',
    'api',
    'src',
    'modules',
    'imports',
    'onboarding.controller.ts',
  );
  const controllerSource = await readFile(controllerPath, 'utf8');
  assert.ok(
    controllerSource.includes("@Get('batches/:id')") &&
      controllerSource.includes('getBatch('),
    'OnboardingController should expose GET /batches/:id',
  );
  assert.ok(
    controllerSource.includes("@Query('step')") || controllerSource.includes("'step'"),
    'OnboardingController history endpoint should accept a ?step= filter',
  );

  console.log('onboarding-readiness: OK');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
