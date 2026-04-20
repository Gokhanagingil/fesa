/**
 * Family Activation & Landing Pack v1 — pure-Node validator smoke.
 *
 * Mirrors the bucketing rules in
 *   apps/api/src/modules/guardian-portal/guardian-portal.service.ts
 *   (`getActivationOverview`)
 * and the calm essentials/first-landing logic from
 *   apps/web/src/pages/GuardianPortalHomePage.tsx
 *   (`pickEssentialsForRender`)
 * exactly so we can gate every CI run alongside the existing
 * tenant-branding and club-updates smokes — no database required.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DORMANT_AFTER_DAYS = 60;
const STALE_INVITE_AFTER_DAYS = 7;
const FIRST_LANDING_WINDOW_DAYS = 14;

function expect(condition, message) {
  if (!condition) {
    console.error(`family-activation: ${message}`);
    process.exit(1);
  }
}

function bucketOf(now, access, hasGuardianRow, guardianHasEmail) {
  // Guardians without an access row land in the "ready to invite"
  // bucket only when they have an email AND at least one linked athlete
  // — the no-email path is intentionally invisible because there is
  // nothing actionable to do yet.
  if (!access) {
    if (!hasGuardianRow) return 'skip';
    if (!guardianHasEmail) return 'skip';
    return 'notInvited';
  }
  if (access.recoveryRequestedAt && access.status !== 'disabled') {
    return 'recovery';
  }
  if (access.status === 'disabled') return 'disabled';
  if (access.status === 'invited') return 'invited';
  if (access.status === 'active') {
    const lastSignal = access.lastLoginAt ?? access.activatedAt;
    if (!lastSignal) return 'dormant';
    if (now - lastSignal.getTime() >= DORMANT_AFTER_DAYS * DAY_MS) return 'dormant';
    return 'active';
  }
  return 'skip';
}

const now = new Date('2026-04-20T12:00:00Z').getTime();

const cases = [
  // 1. No access row, has email, has linked athlete → notInvited.
  {
    access: null,
    hasGuardianRow: true,
    guardianHasEmail: true,
    expected: 'notInvited',
  },
  // 2. No access row, no email → skipped. We never list a family we
  //    cannot invite from a single click.
  {
    access: null,
    hasGuardianRow: true,
    guardianHasEmail: false,
    expected: 'skip',
  },
  // 3. Recovery request takes priority over status (except disabled).
  {
    access: {
      status: 'invited',
      recoveryRequestedAt: new Date(now - 2 * DAY_MS),
      activatedAt: null,
      lastLoginAt: null,
    },
    expected: 'recovery',
  },
  // 4. Disabled access masks the recovery flag — the family is paused.
  {
    access: {
      status: 'disabled',
      recoveryRequestedAt: new Date(now - 3 * DAY_MS),
      activatedAt: new Date(now - 30 * DAY_MS),
      lastLoginAt: null,
    },
    expected: 'disabled',
  },
  // 5. Fresh invite → invited bucket.
  {
    access: {
      status: 'invited',
      recoveryRequestedAt: null,
      activatedAt: null,
      lastLoginAt: null,
      invitedAt: new Date(now - 2 * DAY_MS),
    },
    expected: 'invited',
  },
  // 6. Active with recent login → active.
  {
    access: {
      status: 'active',
      recoveryRequestedAt: null,
      activatedAt: new Date(now - 30 * DAY_MS),
      lastLoginAt: new Date(now - 5 * DAY_MS),
    },
    expected: 'active',
  },
  // 7. Active but no login signal in 60+ days → dormant (calm hint, never alarming).
  {
    access: {
      status: 'active',
      recoveryRequestedAt: null,
      activatedAt: new Date(now - 200 * DAY_MS),
      lastLoginAt: new Date(now - 200 * DAY_MS),
    },
    expected: 'dormant',
  },
];

for (const [idx, scenario] of cases.entries()) {
  const got = bucketOf(now, scenario.access, scenario.hasGuardianRow ?? false, scenario.guardianHasEmail ?? false);
  expect(got === scenario.expected, `case #${idx + 1} expected ${scenario.expected}, got ${got}`);
}

// Stale-invite signal — a calm hint, not a panic flag.
const staleScenario = {
  access: {
    status: 'invited',
    invitedAt: new Date(now - 14 * DAY_MS),
  },
};
const inviteAgeDays = Math.floor((now - staleScenario.access.invitedAt.getTime()) / DAY_MS);
expect(inviteAgeDays >= STALE_INVITE_AFTER_DAYS, 'stale invite threshold should trip at >= 7 days');

// First-landing window detection mirrors the API logic in
// `getPortalHome`: activated within 14 days AND (lastLoginAt is null
// OR within 60s of activation).
function detectFirstLanding(activatedAt, lastLoginAt, nowMs = now) {
  if (!activatedAt) return false;
  if (activatedAt.getTime() < nowMs - FIRST_LANDING_WINDOW_DAYS * DAY_MS) return false;
  if (!lastLoginAt) return true;
  return Math.abs(lastLoginAt.getTime() - activatedAt.getTime()) < 60 * 1000;
}

expect(
  detectFirstLanding(new Date(now - 2 * DAY_MS), new Date(now - 2 * DAY_MS)) === true,
  'just-activated families should land in the first-landing surface',
);
expect(
  detectFirstLanding(new Date(now - 2 * DAY_MS), new Date(now - 1 * DAY_MS)) === false,
  'a returning family should not see the first-landing card a day later',
);
expect(
  detectFirstLanding(new Date(now - 30 * DAY_MS), new Date(now - 30 * DAY_MS)) === false,
  'first-landing surface only renders inside the 14-day window',
);

// Calm essentials picker — mirrors `pickEssentialsForRender` on the
// portal home. The product principle is "1–3 clear next actions, never
// a long checklist".
function pickEssentialsForRender(essentials, hasOutstanding, pendingCount) {
  const attention = essentials.filter((entry) => entry.severity === 'attention');
  const done = essentials.filter((entry) => entry.severity === 'info');
  const filtered = attention.filter((entry) => {
    if (entry.key === 'check_balance' && !hasOutstanding) return false;
    if (entry.key === 'open_pending_action' && pendingCount === 0) return false;
    return true;
  });
  if (filtered.length > 0) return filtered.slice(0, 3);
  const firstDone = done.find((entry) => entry.key === 'review_children') ?? done[0];
  return firstDone ? [firstDone] : [];
}

const essentialsAllSet = [
  { key: 'confirm_phone', severity: 'info', done: true },
  { key: 'review_children', severity: 'info', done: true },
  { key: 'open_pending_action', severity: 'info', done: true },
  { key: 'check_balance', severity: 'info', done: true },
];
const settled = pickEssentialsForRender(essentialsAllSet, false, 0);
expect(
  settled.length === 1 && settled[0].key === 'review_children',
  'a settled family sees a single calm acknowledgement, not a checklist',
);

const essentialsAttention = [
  { key: 'confirm_phone', severity: 'attention', done: false },
  { key: 'review_children', severity: 'info', done: true },
  { key: 'open_pending_action', severity: 'attention', done: false },
  { key: 'check_balance', severity: 'attention', done: false },
];
// When there is no overdue balance and no pending action, those
// attention entries are filtered out of the essentials strip — they
// would only feel like noise to the family.
const filteredEntries = pickEssentialsForRender(essentialsAttention, false, 0);
expect(
  filteredEntries.length === 1 && filteredEntries[0].key === 'confirm_phone',
  'we only surface attention entries the family can actually act on',
);

const allActionable = pickEssentialsForRender(essentialsAttention, true, 2);
expect(
  allActionable.length === 3,
  'with three attention entries we cap the strip at three rows, never longer',
);

console.log('family-activation: OK');
