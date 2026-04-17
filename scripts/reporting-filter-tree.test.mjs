#!/usr/bin/env node
/**
 * Pure unit smoke for the filter-tree validator. Loads the compiled module
 * from apps/api/dist after `npm run build` so we can run it without booting
 * Nest. Failures print and exit non-zero.
 */
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const distPath = resolve(here, '..', 'apps', 'api', 'dist', 'modules', 'reporting', 'filter-tree.js');

const { validateFilterTree } = await import(distPath);

function expectThrows(fn, label) {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error(`expected ${label} to throw`);
}

const passes = [
  ['null tree returns null', () => assert.equal(validateFilterTree('athletes', null), null)],
  ['simple condition validates', () => {
    const result = validateFilterTree('athletes', {
      type: 'condition',
      field: 'athlete.status',
      operator: 'is',
      value: 'active',
    });
    assert.equal(result.type, 'condition');
    assert.equal(result.field, 'athlete.status');
    assert.equal(result.value, 'active');
  }],
  ['relation existence validates', () => {
    const result = validateFilterTree('athletes', {
      type: 'condition',
      field: 'athlete.guardiansExist',
      operator: 'exists',
    });
    assert.equal(result.value, null);
  }],
  ['nested AND/OR with NOT', () => {
    const result = validateFilterTree('athletes', {
      type: 'group',
      combinator: 'and',
      children: [
        { type: 'condition', field: 'athlete.gender', operator: 'is', value: 'female' },
        {
          type: 'group',
          combinator: 'or',
          not: true,
          children: [
            { type: 'condition', field: 'athlete.status', operator: 'is', value: 'archived' },
          ],
        },
      ],
    });
    assert.equal(result.type, 'group');
    assert.equal(result.children[1].not, true);
  }],
];

const fails = [
  ['unknown field rejected', () =>
    expectThrows(
      () => validateFilterTree('athletes', { type: 'condition', field: 'athlete.bogus', operator: 'is', value: 'x' }),
      'unknown field',
    )],
  ['operator mismatch rejected', () =>
    expectThrows(
      () => validateFilterTree('athletes', { type: 'condition', field: 'athlete.firstName', operator: 'gt', value: 'A' }),
      'gt on string',
    )],
  ['missing children for in operator', () =>
    expectThrows(
      () => validateFilterTree('athletes', { type: 'condition', field: 'athlete.status', operator: 'in', value: [] }),
      'empty IN list',
    )],
];

let failures = 0;
for (const [name, run] of [...passes, ...fails]) {
  try {
    run();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`  ✗ ${name}: ${error.message}`);
  }
}

if (failures > 0) {
  console.error(`\nreporting-filter-tree.test failed (${failures} cases).`);
  process.exit(1);
}
console.log('\nreporting-filter-tree.test passed.');
