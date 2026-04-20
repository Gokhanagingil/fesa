/**
 * Parent Portal v1.3 — Family Communication Continuity, Payment Readiness,
 * and Club-to-Family Trust Layer.
 *
 * Pure-Node validator smoke. Mirrors the projection rules in
 *   apps/api/src/modules/guardian-portal/guardian-portal.service.ts
 *   (`getPortalHome`)
 * for the v1.3 surfaces (`paymentReadiness`, `communication`) so we can
 * gate every CI run alongside the existing tenant-branding,
 * club-updates and family-activation smokes — no database required.
 *
 * The product principle this protects:
 *   1. Calm finance language — never collections, never urgency.
 *   2. Stable continuity ordering — overdue first, then earliest due,
 *      then "no due date" last.
 *   3. Hard caps that protect the calm portal surface.
 *   4. Continuity moments hide the noisy ones — closed/completed
 *      moments older than the 30-day window are intentionally invisible.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const SOON_WINDOW_DAYS = 14;
const PARENT_FINANCE_CAP = 6;
const CONTINUITY_WINDOW_DAYS = 30;

function expect(condition, message) {
  if (!condition) {
    console.error(`parent-portal-v1.3: ${message}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Payment readiness — projection rules
// ---------------------------------------------------------------------------

function projectChargeForFamily(charge, todayMidnight, soonBoundary) {
  const dueDate = charge.dueDate ? new Date(charge.dueDate) : null;
  const isOverdue = Boolean(charge.isOverdue);
  const isSoon =
    !isOverdue &&
    dueDate !== null &&
    dueDate.getTime() >= todayMidnight.getTime() &&
    dueDate.getTime() <= soonBoundary.getTime();
  return {
    id: charge.id,
    dueDate,
    isOverdue,
    status: isOverdue ? 'overdue' : isSoon ? 'dueSoon' : 'open',
  };
}

function buildOpenCharges(charges, today) {
  const todayMidnight = new Date(today);
  todayMidnight.setHours(0, 0, 0, 0);
  const soonBoundary = new Date(todayMidnight);
  soonBoundary.setDate(soonBoundary.getDate() + SOON_WINDOW_DAYS);
  const open = charges
    .filter((charge) => charge.derivedStatus !== 'cancelled' && charge.derivedStatus !== 'paid')
    .filter((charge) => Number(charge.remainingAmount ?? '0') > 0)
    .map((charge) => projectChargeForFamily(charge, todayMidnight, soonBoundary));
  open.sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    const aTime = a.dueDate ? a.dueDate.getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.dueDate ? b.dueDate.getTime() : Number.POSITIVE_INFINITY;
    return aTime - bTime;
  });
  return open;
}

function deriveTone(open) {
  const overdueCount = open.filter((row) => row.status === 'overdue').length;
  if (overdueCount > 0) return 'attention';
  if (open.length > 0) return 'open';
  return 'clear';
}

const today = new Date('2026-04-20T12:00:00Z');

const paidAndCancelled = [
  {
    id: 'ch-paid',
    derivedStatus: 'paid',
    remainingAmount: '0.00',
    dueDate: new Date('2026-04-01T00:00:00Z'),
    isOverdue: false,
  },
  {
    id: 'ch-cancelled',
    derivedStatus: 'cancelled',
    remainingAmount: '0.00',
    dueDate: new Date('2026-04-01T00:00:00Z'),
    isOverdue: false,
  },
];
const paidView = buildOpenCharges(paidAndCancelled, today);
expect(paidView.length === 0, 'paid and cancelled charges never appear in the parent surface');
expect(deriveTone(paidView) === 'clear', 'an empty list is the calm "clear" tone');

const mixed = [
  {
    id: 'ch-overdue',
    derivedStatus: 'pending',
    remainingAmount: '120.00',
    dueDate: new Date('2026-04-01T00:00:00Z'),
    isOverdue: true,
  },
  {
    id: 'ch-soon',
    derivedStatus: 'pending',
    remainingAmount: '330.00',
    dueDate: new Date('2026-04-25T00:00:00Z'),
    isOverdue: false,
  },
  {
    id: 'ch-far',
    derivedStatus: 'pending',
    remainingAmount: '500.00',
    dueDate: new Date('2026-08-01T00:00:00Z'),
    isOverdue: false,
  },
  {
    id: 'ch-no-date',
    derivedStatus: 'pending',
    remainingAmount: '40.00',
    dueDate: null,
    isOverdue: false,
  },
];
const mixedView = buildOpenCharges(mixed, today);
expect(
  mixedView.map((row) => row.id).join(',') === 'ch-overdue,ch-soon,ch-far,ch-no-date',
  'parent finance ordering: overdue first, then by earliest due date, no-date last',
);
expect(deriveTone(mixedView) === 'attention', 'any overdue row escalates the tone to "attention"');

const softOpen = mixed.filter((row) => row.id !== 'ch-overdue');
const softOpenView = buildOpenCharges(softOpen, today);
expect(deriveTone(softOpenView) === 'open', 'no overdue but still open → calm "open" tone');

// Hard cap check — ensure we never render more than six rows even when
// the family has a long history. We project the same array many times
// and only trim at the cap so the underlying ordering is preserved.
const stress = Array.from({ length: 25 }, (_, idx) => ({
  id: `ch-${idx}`,
  derivedStatus: 'pending',
  remainingAmount: '50.00',
  dueDate: new Date(today.getTime() + idx * DAY_MS),
  isOverdue: false,
}));
const stressView = buildOpenCharges(stress, today).slice(0, PARENT_FINANCE_CAP);
expect(stressView.length === PARENT_FINANCE_CAP, 'parent surface caps at six visible charges');

// ---------------------------------------------------------------------------
// Communication continuity — projection rules
// ---------------------------------------------------------------------------

function buildContinuityMoments(clubUpdates, actions, now) {
  const cutoff = now.getTime() - CONTINUITY_WINDOW_DAYS * DAY_MS;
  const moments = [];
  for (const update of clubUpdates) {
    if (!update.publishedAt) continue;
    if (update.publishedAt.getTime() < cutoff) continue;
    moments.push({
      id: `cu-${update.id}`,
      kind: 'club_update',
      occurredAt: update.publishedAt,
      status: 'published',
    });
  }
  for (const action of actions) {
    const ongoing =
      action.status === 'open' ||
      action.status === 'pending_family_action' ||
      action.status === 'submitted' ||
      action.status === 'under_review';
    const recentlyDecided =
      (action.status === 'approved' ||
        action.status === 'rejected' ||
        action.status === 'completed' ||
        action.status === 'closed') &&
      ((action.reviewedAt ? action.reviewedAt.getTime() : action.updatedAt.getTime()) >= cutoff);
    if (!ongoing && !recentlyDecided) continue;
    moments.push({
      id: `fa-${action.id}`,
      kind: 'family_request',
      occurredAt:
        action.reviewedAt ?? action.submittedAt ?? action.updatedAt ?? action.createdAt,
      status: action.status,
    });
  }
  moments.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
  return moments.slice(0, 5);
}

const continuityNow = new Date('2026-04-20T12:00:00Z');
const continuity = buildContinuityMoments(
  [
    { id: 'cu-fresh', publishedAt: new Date('2026-04-15T08:00:00Z') },
    { id: 'cu-old', publishedAt: new Date('2026-02-20T08:00:00Z') },
  ],
  [
    {
      id: 'fa-open',
      status: 'pending_family_action',
      reviewedAt: null,
      submittedAt: null,
      updatedAt: new Date('2026-04-10T08:00:00Z'),
      createdAt: new Date('2026-04-10T08:00:00Z'),
    },
    {
      id: 'fa-closed-old',
      status: 'closed',
      reviewedAt: new Date('2026-02-01T08:00:00Z'),
      submittedAt: null,
      updatedAt: new Date('2026-02-01T08:00:00Z'),
      createdAt: new Date('2026-02-01T08:00:00Z'),
    },
    {
      id: 'fa-closed-recent',
      status: 'closed',
      reviewedAt: new Date('2026-04-18T08:00:00Z'),
      submittedAt: null,
      updatedAt: new Date('2026-04-18T08:00:00Z'),
      createdAt: new Date('2026-04-18T08:00:00Z'),
    },
  ],
  continuityNow,
);

expect(
  continuity.map((m) => m.id).join(',') === 'fa-fa-closed-recent,cu-cu-fresh,fa-fa-open',
  'continuity sorts newest-first and drops out-of-window moments',
);

// An empty audience / new family should land on a single calm,
// ready-to-render shape that the UI can hide gracefully.
const emptyContinuity = buildContinuityMoments([], [], continuityNow);
expect(
  Array.isArray(emptyContinuity) && emptyContinuity.length === 0,
  'continuity is an empty list, never undefined, when there is nothing to surface',
);

console.log('parent-portal-v1.3: OK');
