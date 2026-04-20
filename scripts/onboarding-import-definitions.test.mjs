/**
 * Pure-Node validator for the onboarding import templates.
 *
 * The Club Onboarding Wizard depends on every importable entity having:
 *   - a stable key
 *   - i18n labels for the entity, its description, and every field
 *   - at least one required field
 *   - sample rows that cover every declared column
 *
 * This guards the contract without a database or a Nest test harness.
 */
import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = dirname(__dirname);

async function loadDefinitionsAst() {
  const filePath = join(
    root,
    'apps',
    'api',
    'src',
    'modules',
    'imports',
    'import-definitions.ts',
  );
  return readFile(filePath, 'utf8');
}

async function loadEnLocale() {
  const filePath = join(
    root,
    'apps',
    'web',
    'src',
    'i18n',
    'locales',
    'en',
    'common.json',
  );
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

function pickI18n(obj, key) {
  return key.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), obj);
}

function expectedEntityKeys() {
  return [
    'sport_branches',
    'coaches',
    'groups',
    'teams',
    'athletes',
    'guardians',
    'athlete_guardians',
    'charge_items',
    'inventory_items',
  ];
}

const REQUIRED_FIELD_NUMBERS = {
  sport_branches: 2,
  coaches: 3,
  groups: 2,
  teams: 2,
  athletes: 3,
  guardians: 2,
  athlete_guardians: 5,
  charge_items: 4,
  inventory_items: 2,
};

async function main() {
  const source = await loadDefinitionsAst();
  for (const entity of expectedEntityKeys()) {
    assert.match(
      source,
      new RegExp(`entity:\\s*'${entity}'`),
      `import-definitions.ts should declare entity '${entity}'`,
    );
  }

  const locale = await loadEnLocale();
  const importsLocale = pickI18n(locale, 'pages.imports');
  assert.ok(importsLocale, 'pages.imports must exist in EN locale');
  for (const entity of expectedEntityKeys()) {
    const camel = entity
      .split('_')
      .map((part, idx) => (idx === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
      .join('');
    const entityCopy = importsLocale.entities?.[camel];
    assert.ok(entityCopy, `Missing pages.imports.entities.${camel} EN copy`);
    assert.ok(entityCopy.title, `Missing title for entity ${entity}`);
    assert.ok(entityCopy.description, `Missing description for entity ${entity}`);
  }

  const onboarding = pickI18n(locale, 'pages.onboarding');
  assert.ok(onboarding, 'pages.onboarding must exist in EN locale');
  for (const stepKey of [
    'club_basics',
    'sport_branches',
    'coaches',
    'groups',
    'teams',
    'athletes',
    'guardians',
    'athlete_guardians',
    'charge_items',
    'inventory_items',
    'go_live',
  ]) {
    const stepCopy = onboarding.steps?.[stepKey];
    assert.ok(stepCopy, `Missing pages.onboarding.steps.${stepKey} EN copy`);
    assert.ok(stepCopy.title, `Missing title for step ${stepKey}`);
    assert.ok(stepCopy.hint, `Missing hint for step ${stepKey}`);
  }

  for (const status of ['not_started', 'in_progress', 'completed', 'needs_attention']) {
    assert.ok(onboarding.status?.[status], `Missing onboarding status copy for ${status}`);
  }
  for (const state of ['fresh', 'in_progress', 'ready']) {
    assert.ok(onboarding.progress?.[state], `Missing onboarding progress copy for ${state}`);
  }

  // v1.1 Go-Live Confidence Pack — readiness, history, last-import surfaces.
  assert.ok(onboarding.readiness, 'pages.onboarding.readiness must exist');
  for (const tone of ['fresh', 'in_progress', 'almost_ready', 'ready']) {
    assert.ok(
      onboarding.readiness.tone?.[tone],
      `Missing readiness tone copy for ${tone}`,
    );
    assert.ok(
      onboarding.readiness.headline?.[tone],
      `Missing readiness headline copy for ${tone}`,
    );
    assert.ok(
      onboarding.readiness.subtitle?.[tone],
      `Missing readiness subtitle copy for ${tone}`,
    );
  }
  for (const signal of [
    'brandMissing',
    'athletesWithoutGroups',
    'linksMissing',
    'lowAthleteCount',
    'rejectedRows',
  ]) {
    assert.ok(
      onboarding.readiness.signals?.[signal],
      `Missing readiness signal copy for ${signal}`,
    );
  }

  assert.ok(onboarding.history, 'pages.onboarding.history must exist');
  for (const status of ['success', 'partial', 'needs_attention']) {
    assert.ok(
      onboarding.history.status?.[status],
      `Missing onboarding history status copy for ${status}`,
    );
  }
  assert.ok(onboarding.lastImport?.title, 'Missing pages.onboarding.lastImport.title');
  assert.ok(onboarding.goLive?.requiredTitle, 'Missing pages.onboarding.goLive.requiredTitle');
  assert.ok(onboarding.goLive?.optionalTitle, 'Missing pages.onboarding.goLive.optionalTitle');

  for (const [entity, expected] of Object.entries(REQUIRED_FIELD_NUMBERS)) {
    const block = source.split(`entity: '${entity}'`)[1] ?? '';
    const matches = block
      .split(/entity:\s*'/)
      .shift()
      ?.match(/required:\s*true/g) ?? [];
    assert.ok(
      matches.length >= expected,
      `Entity ${entity} should declare at least ${expected} required fields (found ${matches.length}).`,
    );
  }

  console.log('onboarding-import-definitions: OK');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
