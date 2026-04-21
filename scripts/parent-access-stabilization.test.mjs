/**
 * Parent Access + Family Journey Stabilization Pass — pure-Node validator.
 *
 * Mirrors the small but high-value correctness contracts hardened by
 * the stabilization pass so we can gate every CI run alongside the
 * existing parent-invite-delivery, family-activation, and parent-portal
 * smokes — no database required.
 *
 * The product principle this guards is:
 *   "Every state the parent or staff sees must remain coherent across
 *    the whole invite -> activation -> recovery -> landing chain."
 *
 * Specifically:
 *   1. `getActivationStatus` and `activate` distinguish three truthful
 *      error codes: `invite_link_invalid`, `invite_link_expired`,
 *      `portal_access_disabled`.
 *   2. A successful `activate()` must clear the recovery flag and the
 *      stale invite-delivery state — the row graduates out of those
 *      questions entirely.
 *   3. The staff-side activation overview's activation-rate denominator
 *      excludes paused (disabled) rows on purpose; including them was
 *      pessimistic and hid genuine progress.
 *   4. The staff InviteLinkPanel surfaces the manual fallback as the
 *      primary CTA exactly when the email path is not working
 *      (pending / unavailable / failed) and demotes it to a quiet
 *      secondary in the calmer (sent) state. It hides the fallback
 *      entirely once a row is already `shared_manually`.
 */

function expect(condition, message) {
  if (!condition) {
    console.error(`parent-access-stabilization: ${message}`);
    process.exit(1);
  }
}

// 1. Activation token error code mapping ---------------------------------

function classifyActivationError(access, nowMs) {
  if (!access) return 'invite_link_invalid';
  if (!access.inviteTokenExpiresAt) return 'invite_link_invalid';
  if (access.inviteTokenExpiresAt.getTime() < nowMs) return 'invite_link_expired';
  if (access.status === 'disabled') return 'portal_access_disabled';
  return 'ok';
}

const now = new Date('2026-04-21T12:00:00Z').getTime();

expect(
  classifyActivationError(null, now) === 'invite_link_invalid',
  'unknown token returns invite_link_invalid (never leaks "no such row" wording)',
);
expect(
  classifyActivationError(
    { inviteTokenExpiresAt: new Date(now - 60_000), status: 'invited' },
    now,
  ) === 'invite_link_expired',
  'matched-but-expired token returns invite_link_expired',
);
expect(
  classifyActivationError(
    { inviteTokenExpiresAt: new Date(now + 60_000), status: 'disabled' },
    now,
  ) === 'portal_access_disabled',
  'token on a paused access returns portal_access_disabled',
);
expect(
  classifyActivationError(
    { inviteTokenExpiresAt: new Date(now + 60_000), status: 'invited' },
    now,
  ) === 'ok',
  'fresh token on an invited access is ok',
);

// 2. Activation clears recovery + stale delivery state -------------------

function applyActivation(access, nowDate) {
  return {
    ...access,
    status: 'active',
    activatedAt: access.activatedAt ?? nowDate,
    inviteTokenHash: null,
    inviteTokenExpiresAt: null,
    disabledAt: null,
    lastLoginAt: nowDate,
    recoveryRequestedAt: null,
    recoveryRequestCount: 0,
    inviteDeliveryState: null,
    inviteDeliveryDetail: null,
    inviteDeliveryProvider: null,
    inviteDeliveryAttemptedAt: null,
    inviteDeliveredAt: null,
    inviteSharedAt: null,
  };
}

const beforeActivation = {
  status: 'invited',
  recoveryRequestedAt: new Date(now - 24 * 60 * 60 * 1000),
  recoveryRequestCount: 2,
  inviteDeliveryState: 'shared_manually',
  inviteSharedAt: new Date(now - 60 * 60 * 1000),
  inviteTokenHash: 'abc',
  inviteTokenExpiresAt: new Date(now + 60 * 60 * 1000),
  activatedAt: null,
};
const afterActivation = applyActivation(beforeActivation, new Date(now));
expect(afterActivation.status === 'active', 'activation flips status to active');
expect(
  afterActivation.recoveryRequestedAt === null && afterActivation.recoveryRequestCount === 0,
  'activation clears recoveryRequestedAt + recoveryRequestCount so staff banner disappears',
);
expect(
  afterActivation.inviteDeliveryState === null && afterActivation.inviteSharedAt === null,
  'activation clears stale invite-delivery state so the access row stops claiming "shared/sent"',
);
expect(
  afterActivation.inviteTokenHash === null && afterActivation.inviteTokenExpiresAt === null,
  'activation clears the invite token so an old activation link cannot be reused',
);

// 3. Activation rate denominator excludes paused rows --------------------

function activationRatePercent(totals) {
  const totalActive = totals.active + totals.dormant;
  const denominator = Math.max(0, totals.guardiansWithAccess - totals.disabled);
  if (denominator <= 0) return 0;
  return Math.round((totalActive / denominator) * 100);
}

expect(
  activationRatePercent({
    guardiansWithAccess: 10,
    active: 5,
    dormant: 1,
    disabled: 4,
  }) === 100,
  '5+1 active out of (10 - 4 paused) = 6 → 100% (paused rows must not deflate the rate)',
);
expect(
  activationRatePercent({
    guardiansWithAccess: 4,
    active: 1,
    dormant: 0,
    disabled: 0,
  }) === 25,
  '1 of 4 with no paused rows → 25%',
);
expect(
  activationRatePercent({
    guardiansWithAccess: 2,
    active: 0,
    dormant: 0,
    disabled: 2,
  }) === 0,
  'all rows paused → 0% (denominator clamps to 0, never NaN)',
);

// 4. InviteLinkPanel CTA hierarchy ---------------------------------------

function panelCtaHierarchy(deliveryState) {
  const fallbackIsPrimary =
    deliveryState === 'unavailable' ||
    deliveryState === 'failed' ||
    deliveryState === 'pending';
  const showMarkShared = deliveryState !== 'shared_manually';
  return {
    copyVariant: fallbackIsPrimary ? 'ghost' : 'primary',
    fallbackVariant: fallbackIsPrimary ? 'primary' : 'ghost',
    showMarkShared,
  };
}

const pendingPanel = panelCtaHierarchy('pending');
expect(
  pendingPanel.fallbackVariant === 'primary' && pendingPanel.showMarkShared === true,
  'pending → manual fallback is primary',
);
const failedPanel = panelCtaHierarchy('failed');
expect(
  failedPanel.fallbackVariant === 'primary' && failedPanel.showMarkShared === true,
  'failed → manual fallback is primary',
);
const unavailablePanel = panelCtaHierarchy('unavailable');
expect(
  unavailablePanel.fallbackVariant === 'primary' && unavailablePanel.showMarkShared === true,
  'unavailable → manual fallback is primary',
);
const sentPanel = panelCtaHierarchy('sent');
expect(
  sentPanel.copyVariant === 'primary' && sentPanel.fallbackVariant === 'ghost',
  'sent → copy is primary, fallback is the calmer secondary',
);
const sharedPanel = panelCtaHierarchy('shared_manually');
expect(
  sharedPanel.showMarkShared === false,
  'shared_manually → fallback button hides itself (no double-stamp)',
);

console.log('parent-access-stabilization: OK');
