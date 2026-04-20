/**
 * Parent Invite Delivery & Access Reliability Pack — pure-Node validator smoke.
 *
 * Mirrors the truthful invite-delivery contract in
 *   apps/api/src/modules/guardian-portal/invite-delivery.service.ts
 * and the access-summary projection in
 *   apps/api/src/modules/guardian-portal/guardian-portal.service.ts
 * exactly so we can gate every CI run alongside the existing
 * family-activation, club-updates, and parent-portal-v1.3 smokes — no
 * database required.
 *
 * The product principle this guards is "truth over illusion":
 *   - we never claim an invite was delivered without a real provider
 *     response;
 *   - the staff UX always has a calm fallback when delivery is not
 *     configured or a provider rejects the message;
 *   - a fresh invite never carries stale "sent" badges over from a
 *     previous attempt.
 */

function expect(condition, message) {
  if (!condition) {
    console.error(`parent-invite-delivery: ${message}`);
    process.exit(1);
  }
}

// 1. Readiness — "no SMTP_HOST" must yield `not_configured`, not a
//    silent default. The staff UI relies on this to render the
//    "delivery unavailable, share manually" guidance.
function getReadiness(env) {
  const host = (env.SMTP_HOST ?? '').trim() || null;
  const from = (env.SMTP_FROM ?? env.SMTP_USER ?? '').trim() || null;
  if (!host || !from) {
    return {
      available: false,
      provider: 'manual',
      state: 'not_configured',
      message: !host ? 'smtp_host_missing' : 'smtp_from_missing',
    };
  }
  return {
    available: true,
    provider: 'smtp',
    state: 'configured',
    message: null,
  };
}

const noSmtp = getReadiness({});
expect(noSmtp.available === false, 'no SMTP env yields available=false');
expect(noSmtp.state === 'not_configured', 'no SMTP env yields state=not_configured');
expect(noSmtp.provider === 'manual', 'no SMTP env yields manual provider');

const partial = getReadiness({ SMTP_HOST: 'smtp.example.com' });
expect(partial.available === false, 'partial SMTP env (no FROM) is still unavailable');
expect(partial.message === 'smtp_from_missing', 'partial SMTP env reports smtp_from_missing');

const full = getReadiness({ SMTP_HOST: 'smtp.example.com', SMTP_FROM: 'club@example.com' });
expect(full.available === true, 'full SMTP env yields available=true');
expect(full.state === 'configured', 'full SMTP env yields state=configured');
expect(full.provider === 'smtp', 'full SMTP env yields smtp provider');

// 2. Delivery state mapping — every attempt result must produce a
//    truthful state. The staff UI renders this verbatim, so we never
//    claim "sent" when the provider was unreachable.
function projectAttempt(attempt) {
  const allowed = new Set(['sent', 'failed', 'unavailable', 'pending', 'shared_manually']);
  if (!allowed.has(attempt.state)) {
    return null;
  }
  return {
    state: attempt.state,
    deliveredAt: attempt.state === 'sent' ? attempt.deliveredAt ?? null : null,
    sharedAt: attempt.state === 'shared_manually' ? attempt.sharedAt ?? null : null,
    attemptedAt: attempt.attemptedAt ?? null,
    provider: attempt.provider ?? null,
  };
}

const sent = projectAttempt({
  state: 'sent',
  provider: 'smtp',
  attemptedAt: new Date(),
  deliveredAt: new Date(),
});
expect(sent && sent.state === 'sent', 'sent attempt projects state=sent');
expect(sent && sent.deliveredAt !== null, 'sent attempt carries deliveredAt');

const failed = projectAttempt({
  state: 'failed',
  provider: 'smtp',
  attemptedAt: new Date(),
});
expect(failed && failed.state === 'failed', 'failed attempt projects state=failed');
expect(failed && failed.deliveredAt === null, 'failed attempt has no deliveredAt');

const unavailable = projectAttempt({
  state: 'unavailable',
  provider: 'manual',
  attemptedAt: new Date(),
});
expect(
  unavailable && unavailable.state === 'unavailable',
  'unavailable attempt is preserved (never silently re-classified as sent)',
);

const shared = projectAttempt({
  state: 'shared_manually',
  provider: 'manual',
  attemptedAt: new Date(),
  sharedAt: new Date(),
});
expect(shared && shared.sharedAt !== null, 'shared_manually attempt carries sharedAt');

// 3. Resend semantics — each fresh invite resets delivery state so the
//    UI never carries a stale "sent" badge across attempts.
function applyResend(prevRow) {
  return {
    ...prevRow,
    inviteDeliveryState: 'pending',
    inviteDeliveryProvider: null,
    inviteDeliveryDetail: null,
    inviteDeliveryAttemptedAt: null,
    inviteDeliveredAt: null,
    inviteSharedAt: null,
    inviteAttemptCount: (prevRow.inviteAttemptCount ?? 0) + 1,
  };
}

const after = applyResend({
  inviteDeliveryState: 'sent',
  inviteDeliveryProvider: 'smtp',
  inviteDeliveryDetail: 'provider_accepted:abc',
  inviteDeliveredAt: new Date(),
  inviteSharedAt: null,
  inviteAttemptCount: 1,
});
expect(after.inviteDeliveryState === 'pending', 'resend clears the sent badge to pending');
expect(after.inviteDeliveredAt === null, 'resend clears the previous deliveredAt stamp');
expect(after.inviteAttemptCount === 2, 'resend increments the attempt counter');

// 4. Tone-key mapping — the staff UX renders one i18n key per state.
//    A drift here would silently reintroduce raw-key copy in the UI.
function toneKeyForState(state) {
  switch (state) {
    case 'sent':
      return 'pages.guardians.portalAccess.deliveryTone.sent';
    case 'failed':
      return 'pages.guardians.portalAccess.deliveryTone.failed';
    case 'unavailable':
      return 'pages.guardians.portalAccess.deliveryTone.unavailable';
    case 'shared_manually':
      return 'pages.guardians.portalAccess.deliveryTone.sharedManually';
    case 'pending':
    default:
      return 'pages.guardians.portalAccess.deliveryTone.pending';
  }
}

for (const [state, expected] of [
  ['sent', 'pages.guardians.portalAccess.deliveryTone.sent'],
  ['failed', 'pages.guardians.portalAccess.deliveryTone.failed'],
  ['unavailable', 'pages.guardians.portalAccess.deliveryTone.unavailable'],
  ['shared_manually', 'pages.guardians.portalAccess.deliveryTone.sharedManually'],
  ['pending', 'pages.guardians.portalAccess.deliveryTone.pending'],
  [null, 'pages.guardians.portalAccess.deliveryTone.pending'],
]) {
  expect(
    toneKeyForState(state) === expected,
    `tone key for ${state ?? 'null'} should be ${expected}`,
  );
}

// 5. Manual fallback rule — `markInviteShared` must require an active
//    invite token. We never let the UI flip a "delivered" badge on a
//    family that doesn't have a working activation link yet.
function markShared(access) {
  if (!access.inviteTokenHash) {
    throw new Error('No active invite token to share');
  }
  return {
    ...access,
    inviteDeliveryState: 'shared_manually',
    inviteSharedAt: new Date(),
    inviteDeliveryProvider: access.inviteDeliveryProvider ?? 'manual',
  };
}

let threw = false;
try {
  markShared({ inviteTokenHash: null });
} catch {
  threw = true;
}
expect(threw, 'markShared refuses to stamp when there is no active invite token');

const safeShared = markShared({ inviteTokenHash: 'abc', inviteDeliveryProvider: null });
expect(
  safeShared.inviteDeliveryState === 'shared_manually',
  'markShared flips state to shared_manually when a token exists',
);
expect(safeShared.inviteDeliveryProvider === 'manual', 'markShared defaults provider to manual');

console.log('parent-invite-delivery: OK');
