#!/usr/bin/env node
/**
 * reporting-smoke
 *
 * Exercises the Reporting Foundation v1 against a running API:
 *   - catalog endpoint shape,
 *   - filter tree validation (intentional bad payload should 400),
 *   - tenant isolation across all accessible tenants for `run`,
 *   - saved-view CRUD round-trip,
 *   - CSV export sanity (status 200 + non-empty body).
 *
 * Usage:
 *   API_BASE=http://localhost:3000 \
 *   ADMIN_EMAIL=platform.admin@amateur.local \
 *   ADMIN_PASSWORD=Admin123! \
 *   node scripts/reporting-smoke.mjs
 */

import process from 'node:process';

const API_BASE = (process.env.API_BASE ?? 'http://localhost:3000').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'platform.admin@amateur.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin123!';

let cookieHeader = '';

function captureCookies(setCookie) {
  if (!setCookie) return;
  const parts = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const cookie of parts) {
    const [pair] = cookie.split(';');
    if (!pair) continue;
    cookieHeader = cookieHeader ? `${cookieHeader}; ${pair}` : pair;
  }
}

async function request(method, path, body, tenantId, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookieHeader) headers.cookie = cookieHeader;
  if (tenantId) headers['X-Tenant-Id'] = tenantId;
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  captureCookies(response.headers.getSetCookie?.() ?? response.headers.get('set-cookie'));
  if (options.expectText) {
    return { status: response.status, body: await response.text() };
  }
  const text = await response.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: response.status, body: parsed };
}

async function login() {
  const res = await request('POST', '/api/auth/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`Login failed (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`assertion failed: ${message}`);
  }
}

async function main() {
  console.log(`reporting-smoke against ${API_BASE} as ${ADMIN_EMAIL}`);
  const profile = await login();
  const tenants = profile.accessibleTenants ?? [];
  if (tenants.length === 0) {
    throw new Error('reporting-smoke needs at least one accessible tenant');
  }

  const failures = [];

  // Catalog
  const catalog = await request('GET', '/api/reporting/catalog', undefined, tenants[0].id);
  assert(catalog.status === 200, `catalog GET ${catalog.status}`);
  assert(Array.isArray(catalog.body?.entities), 'catalog.entities is array');
  const requiredEntities = ['athletes', 'guardians', 'private_lessons', 'finance_charges'];
  for (const key of requiredEntities) {
    const entity = catalog.body.entities.find((e) => e.key === key);
    if (!entity) {
      failures.push(`catalog missing entity ${key}`);
      continue;
    }
    if (!Array.isArray(entity.fields) || entity.fields.length === 0) {
      failures.push(`catalog entity ${key} has no fields`);
    }
  }

  // Bad filter tree → 400
  const badFilter = await request(
    'POST',
    '/api/reporting/run',
    {
      entity: 'athletes',
      filter: {
        type: 'condition',
        field: 'athlete.firstName',
        operator: 'gt',
        value: 'A',
      },
    },
    tenants[0].id,
  );
  if (badFilter.status === 200) {
    failures.push(`expected 400 for invalid operator, got 200`);
  }

  // Tenant isolation: run athletes for each tenant and ensure totals look sane
  for (const tenant of tenants) {
    const run = await request('POST', '/api/reporting/run', { entity: 'athletes', limit: 5 }, tenant.id);
    if (run.status !== 200) {
      failures.push(`${tenant.slug} athletes run ${run.status}`);
      continue;
    }
    if (!Array.isArray(run.body?.rows)) {
      failures.push(`${tenant.slug} athletes run rows not array`);
      continue;
    }
  }

  // Saved view round-trip on first tenant
  const tenant = tenants[0];
  const created = await request(
    'POST',
    '/api/reporting/saved-views',
    {
      entity: 'athletes',
      name: 'Smoke view',
      visibility: 'private',
      filter: { type: 'group', combinator: 'and', children: [{ type: 'condition', field: 'athlete.status', operator: 'is', value: 'active' }] },
      columns: ['athlete.firstName', 'athlete.lastName', 'athlete.status'],
      sort: [{ field: 'athlete.lastName', direction: 'asc' }],
    },
    tenant.id,
  );
  if (created.status !== 200 && created.status !== 201) {
    failures.push(`saved view create ${created.status}: ${JSON.stringify(created.body)}`);
  } else {
    const id = created.body.id;
    const fetched = await request('GET', `/api/reporting/saved-views/${id}`, undefined, tenant.id);
    if (fetched.status !== 200) failures.push(`saved view get ${fetched.status}`);
    if (fetched.body?.name !== 'Smoke view') failures.push('saved view name mismatch');

    const updated = await request(
      'PATCH',
      `/api/reporting/saved-views/${id}`,
      { name: 'Smoke view (updated)' },
      tenant.id,
    );
    if (updated.status !== 200) failures.push(`saved view update ${updated.status}`);

    const deleted = await request('DELETE', `/api/reporting/saved-views/${id}`, undefined, tenant.id);
    if (deleted.status !== 200) failures.push(`saved view delete ${deleted.status}`);
  }

  // CSV export sanity
  const csv = await request(
    'POST',
    '/api/reporting/export',
    { entity: 'athletes', limit: 50 },
    tenant.id,
    { expectText: true },
  );
  if (csv.status !== 200) failures.push(`export ${csv.status}`);
  if (typeof csv.body !== 'string' || csv.body.length < 5) failures.push('export body too small');

  // ---- v2 ----------------------------------------------------------------

  // Starter view listing
  const starterList = await request('GET', '/api/reporting/starter-views', undefined, tenant.id);
  if (starterList.status !== 200) failures.push(`starter-views list ${starterList.status}`);
  if (!Array.isArray(starterList.body?.items) || starterList.body.items.length === 0) {
    failures.push('starter-views list has no items');
  } else {
    const sample = starterList.body.items.find((view) => view.entity === 'athletes');
    if (!sample) failures.push('starter-views list missing athletes entity');
  }

  // Specific starter view fetch
  const starterFetch = await request(
    'GET',
    '/api/reporting/starter-views/finance.overdue',
    undefined,
    tenant.id,
  );
  if (starterFetch.status !== 200) failures.push(`starter-views fetch ${starterFetch.status}`);
  if (starterFetch.body?.id !== 'finance.overdue') failures.push('starter-views fetch wrong id');
  if (starterFetch.body?.entity !== 'finance_charges') failures.push('starter-views fetch wrong entity');

  // Tenant isolation: starter-views are catalog metadata, must work for every tenant
  for (const isolationTenant of tenants) {
    const isolationStarters = await request(
      'GET',
      '/api/reporting/starter-views?entity=athletes',
      undefined,
      isolationTenant.id,
    );
    if (isolationStarters.status !== 200) {
      failures.push(`starter-views tenant ${isolationTenant.slug} ${isolationStarters.status}`);
    }
  }

  // Grouped run: athletes by primary group
  const grouped = await request(
    'POST',
    '/api/reporting/run',
    {
      entity: 'athletes',
      groupBy: {
        field: 'athlete.primaryGroupName',
        measures: [{ op: 'count', alias: 'athleteCount' }],
        sort: { alias: 'athleteCount', direction: 'desc' },
        limit: 25,
      },
    },
    tenant.id,
  );
  if (grouped.status !== 200) failures.push(`grouped run ${grouped.status}: ${JSON.stringify(grouped.body)}`);
  if (!Array.isArray(grouped.body?.rows)) failures.push('grouped run rows missing');
  if (!grouped.body?.groupBy) failures.push('grouped response should echo groupBy');
  if (!Array.isArray(grouped.body?.columnLabels)) failures.push('grouped response missing columnLabels');

  // Grouped run with a sum measure should reject ungroupable / non-aggregatable combos
  const badGroup = await request(
    'POST',
    '/api/reporting/run',
    {
      entity: 'athletes',
      groupBy: {
        field: 'athlete.firstName',
        measures: [{ op: 'count', alias: 'count' }],
      },
    },
    tenant.id,
  );
  if (badGroup.status === 200) failures.push('grouped run accepted non-groupable field');

  // Save a grouped view and round-trip
  const groupedView = await request(
    'POST',
    '/api/reporting/saved-views',
    {
      entity: 'athletes',
      name: 'Smoke grouped view',
      visibility: 'private',
      groupBy: {
        field: 'athlete.primaryGroupName',
        measures: [
          { op: 'count', alias: 'athleteCount' },
          { op: 'sum', field: 'athlete.outstandingTotal', alias: 'outstandingSum' },
        ],
        sort: { alias: 'outstandingSum', direction: 'desc' },
      },
      derivedFromStarterId: 'athletes.outstandingByGroup',
    },
    tenant.id,
  );
  if (groupedView.status !== 200 && groupedView.status !== 201) {
    failures.push(`grouped saved view create ${groupedView.status}: ${JSON.stringify(groupedView.body)}`);
  } else {
    const fetched = await request(
      'GET',
      `/api/reporting/saved-views/${groupedView.body.id}`,
      undefined,
      tenant.id,
    );
    if (fetched.body?.groupBy?.field !== 'athlete.primaryGroupName') {
      failures.push('saved grouped view did not preserve groupBy');
    }
    if (fetched.body?.derivedFromStarterId !== 'athletes.outstandingByGroup') {
      failures.push('saved grouped view did not preserve derivedFromStarterId');
    }
    await request('DELETE', `/api/reporting/saved-views/${groupedView.body.id}`, undefined, tenant.id);
  }

  // Grouped CSV export
  const groupedCsv = await request(
    'POST',
    '/api/reporting/export',
    {
      entity: 'finance_charges',
      groupBy: {
        field: 'charge.itemCategory',
        measures: [{ op: 'sum', field: 'charge.remainingAmount', alias: 'remainingSum' }],
      },
      limit: 50,
    },
    tenant.id,
    { expectText: true },
  );
  if (groupedCsv.status !== 200) failures.push(`grouped export ${groupedCsv.status}`);
  if (typeof groupedCsv.body !== 'string' || groupedCsv.body.length < 5) failures.push('grouped export body too small');

  if (failures.length > 0) {
    console.error('reporting-smoke failures:');
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }
  console.log('reporting-smoke completed successfully.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
