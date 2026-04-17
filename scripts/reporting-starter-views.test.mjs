#!/usr/bin/env node
/**
 * Pure unit smoke for the v2 starter-view catalog and filter-tree validity.
 *
 * Loads the compiled catalog + filter-tree validator from `apps/api/dist`
 * (so it has no DB dependency) and asserts that:
 *   - every starter view references a known reporting entity,
 *   - the starter filter tree validates against the reporting validator,
 *   - starter columns / sort fields are real catalog entries,
 *   - groupBy starter views point at fields marked groupable + measures that
 *     match the field's `aggregations` declaration.
 *
 * Failures print and exit non-zero. Run after `npm run build`.
 */
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const distRoot = resolve(here, '..', 'apps', 'api', 'dist', 'modules', 'reporting');

const { listStarterViews, listCatalogEntities, getFieldDefinition } = await import(
  resolve(distRoot, 'catalog.js')
);
const { validateFilterTree } = await import(resolve(distRoot, 'filter-tree.js'));

const entities = listCatalogEntities();
const entityKeys = new Set(entities.map((entity) => entity.key));

const failures = [];
const starters = listStarterViews();
if (!Array.isArray(starters) || starters.length === 0) {
  failures.push('starter catalog is empty');
}

for (const view of starters) {
  if (!entityKeys.has(view.entity)) {
    failures.push(`${view.id}: unknown entity ${view.entity}`);
    continue;
  }

  // Filter shape validates against the same grammar the API uses at runtime.
  if (view.filter) {
    try {
      validateFilterTree(view.entity, view.filter);
    } catch (error) {
      failures.push(`${view.id}: invalid filter — ${error.message}`);
    }
  }

  for (const column of view.columns) {
    const def = getFieldDefinition(view.entity, column);
    if (!def) failures.push(`${view.id}: unknown column ${column}`);
    else if (def.selectable === false) failures.push(`${view.id}: column ${column} is not selectable`);
  }

  for (const sortClause of view.sort) {
    const def = getFieldDefinition(view.entity, sortClause.field);
    if (!def) failures.push(`${view.id}: unknown sort field ${sortClause.field}`);
    else if (def.sortable === false) failures.push(`${view.id}: sort not allowed on ${sortClause.field}`);
  }

  if (view.groupBy) {
    const dimension = getFieldDefinition(view.entity, view.groupBy.field);
    if (!dimension) {
      failures.push(`${view.id}: unknown groupBy field ${view.groupBy.field}`);
    } else if (!dimension.groupable) {
      failures.push(`${view.id}: groupBy field ${view.groupBy.field} is not groupable`);
    }
    for (const measure of view.groupBy.measures) {
      if (measure.op === 'count') continue;
      const measureDef = measure.field ? getFieldDefinition(view.entity, measure.field) : null;
      if (!measureDef) {
        failures.push(`${view.id}: unknown measure field ${measure.field ?? '<missing>'}`);
        continue;
      }
      if (!measureDef.aggregations || !measureDef.aggregations.includes(measure.op)) {
        failures.push(
          `${view.id}: measure ${measure.op}(${measure.field ?? ''}) not allowed by catalog`,
        );
      }
    }
  }
}

const ids = new Set();
for (const view of starters) {
  if (ids.has(view.id)) failures.push(`duplicate starter id ${view.id}`);
  ids.add(view.id);
  if (!view.titleKey || !view.descriptionKey) failures.push(`${view.id}: missing i18n keys`);
}

assert.ok(starters.some((view) => view.managementPack), 'expected at least one management-pack starter');

if (failures.length > 0) {
  console.error('reporting-starter-views.test failures:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`reporting-starter-views.test passed (${starters.length} starters validated).`);
