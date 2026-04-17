#!/usr/bin/env node
/**
 * dashboard-smoke
 *
 * Hits every endpoint that powers the staff sidebar against a running API and
 * fails loudly if any of them return non-200, or if the dashboard reporting
 * payload is missing the basic shape the frontend expects (the regression we
 * already shipped a fix for: charge.dueDate becoming a string and crashing
 * action-center / reporting / platform-overview with a 500).
 *
 * Usage:
 *   API_BASE=http://localhost:3000 \
 *   ADMIN_EMAIL=platform.admin@amateur.local \
 *   ADMIN_PASSWORD=Admin123! \
 *   node scripts/dashboard-smoke.mjs
 *
 * Defaults match the seeded demo accounts.
 */

import process from 'node:process';

const API_BASE = (process.env.API_BASE ?? 'http://localhost:3000').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'platform.admin@amateur.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'Admin123!';

const SIDEBAR_ENDPOINTS = [
  '/api/auth/me',
  '/api/auth/club-overview',
  '/api/reporting/command-center',
  '/api/reporting/definitions',
  '/api/athletes?limit=20',
  '/api/guardians?limit=20',
  '/api/coaches?limit=50&isActive=true',
  '/api/groups?limit=50',
  '/api/teams?limit=50',
  '/api/training-sessions?limit=20',
  '/api/private-lessons?limit=20',
  '/api/communications/audiences',
  '/api/action-center/items',
  '/api/family-actions',
  '/api/family-actions/summary',
  '/api/charge-items?limit=50',
  '/api/athlete-charges?limit=50',
  '/api/payments?limit=20',
  '/api/finance/dashboard-summary',
  '/api/finance/athlete-summaries',
  '/api/sport-branches',
  '/api/guardian-portal/staff/access-summary',
];

const GLOBAL_ONLY = ['/api/auth/platform-overview'];

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

async function fetchJson(method, path, body, tenantId) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookieHeader) headers.cookie = cookieHeader;
  if (tenantId) headers['X-Tenant-Id'] = tenantId;

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  captureCookies(response.headers.getSetCookie?.() ?? response.headers.get('set-cookie'));
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
  const result = await fetchJson('POST', '/api/auth/login', {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (result.status !== 200 && result.status !== 201) {
    throw new Error(`Login failed (${result.status}): ${JSON.stringify(result.body)}`);
  }
  return result.body;
}

function assertCommandCenterShape(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('command-center payload missing');
  }
  for (const key of ['stats', 'attendance', 'actionCenter', 'familyWorkflow']) {
    if (!(key in payload)) {
      throw new Error(`command-center payload missing key '${key}'`);
    }
  }
  if (!payload.actionCenter || typeof payload.actionCenter !== 'object') {
    throw new Error('command-center actionCenter missing');
  }
  if (!Array.isArray(payload.actionCenter.items)) {
    throw new Error('command-center actionCenter.items not an array');
  }
}

async function smokeTenant(tenantId, tenantLabel) {
  const failures = [];
  for (const path of SIDEBAR_ENDPOINTS) {
    const { status } = await fetchJson('GET', path, undefined, tenantId);
    if (status !== 200) {
      failures.push(`${tenantLabel} ${status} ${path}`);
    }
  }
  const platform = await fetchJson('GET', GLOBAL_ONLY[0], undefined, tenantId);
  if (platform.status !== 200) {
    failures.push(`${tenantLabel} ${platform.status} ${GLOBAL_ONLY[0]}`);
  }

  const cc = await fetchJson('GET', '/api/reporting/command-center', undefined, tenantId);
  try {
    assertCommandCenterShape(cc.body);
  } catch (error) {
    failures.push(`${tenantLabel} command-center shape: ${error instanceof Error ? error.message : error}`);
  }

  return failures;
}

async function main() {
  console.log(`dashboard-smoke against ${API_BASE} as ${ADMIN_EMAIL}`);
  const profile = await login();
  if (profile?.user?.platformRole !== 'global_admin') {
    throw new Error('dashboard-smoke expects a global_admin login to exercise platform-overview.');
  }
  const tenants = profile.accessibleTenants ?? [];
  if (tenants.length === 0) {
    throw new Error('dashboard-smoke expects at least one accessible tenant after login.');
  }

  const allFailures = [];
  for (const tenant of tenants) {
    const failures = await smokeTenant(tenant.id, tenant.slug);
    if (failures.length === 0) {
      console.log(`  ${tenant.slug}: OK`);
    } else {
      console.error(`  ${tenant.slug}: FAIL`);
      for (const failure of failures) {
        console.error(`    ${failure}`);
        allFailures.push(failure);
      }
    }
  }

  if (allFailures.length > 0) {
    console.error(`\ndashboard-smoke detected ${allFailures.length} failures.`);
    process.exit(1);
  }
  console.log('\ndashboard-smoke completed successfully.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
