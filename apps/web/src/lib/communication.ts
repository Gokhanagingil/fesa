import type { TFunction } from 'i18next';
import type {
  CommunicationAudienceMember,
  CommunicationAudienceResponse,
  CommunicationChannel,
  CommunicationReadinessResponse,
  DeliverOutreachInput,
  DeliveryMode,
  DeliveryState,
  LogOutreachInput,
  OutreachActivity,
  OutreachActivityListResponse,
  OutreachDelivery,
  WhatsAppReadinessSummary,
} from './domain-types';
import { apiGet, apiPatch, apiPost, apiPut } from './api';

/** Strip everything except + and digits — matches the wa.me phone format. */
export function normalizePhoneForWhatsApp(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned) return null;
  return cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
}

/** Returns a wa.me link for a single recipient, or null when phone is unreachable. */
export function buildWhatsAppLink(
  phone: string | null | undefined,
  message?: string | null,
): string | null {
  const normalized = normalizePhoneForWhatsApp(phone);
  if (!normalized) return null;
  const encoded = message?.trim() ? `?text=${encodeURIComponent(message.trim())}` : '';
  return `https://wa.me/${normalized}${encoded}`;
}

/** Returns a generic wa.me share link without a target phone (good for batch share). */
export function buildWhatsAppShareLink(message: string | null | undefined): string | null {
  if (!message?.trim()) return null;
  return `https://wa.me/?text=${encodeURIComponent(message.trim())}`;
}

export function buildMailtoLink(
  email: string | null | undefined,
  subject?: string | null,
  body?: string | null,
): string | null {
  if (!email) return null;
  const params: string[] = [];
  if (subject?.trim()) params.push(`subject=${encodeURIComponent(subject.trim())}`);
  if (body?.trim()) params.push(`body=${encodeURIComponent(body.trim())}`);
  return `mailto:${email}${params.length ? `?${params.join('&')}` : ''}`;
}

export function buildPhoneLink(phone: string | null | undefined): string | null {
  const normalized = normalizePhoneForWhatsApp(phone);
  if (!normalized) return null;
  return `tel:+${normalized}`;
}

export function isReachableForChannel(
  guardian: CommunicationAudienceMember['guardians'][number],
  channel: CommunicationChannel,
): boolean {
  if (channel === 'whatsapp' || channel === 'phone') return Boolean(guardian.phone);
  if (channel === 'email') return Boolean(guardian.email);
  return Boolean(guardian.phone || guardian.email);
}

export function pickBestGuardian(
  member: CommunicationAudienceMember,
  channel: CommunicationChannel,
): CommunicationAudienceMember['guardians'][number] | null {
  const candidates = member.guardians.filter((guardian) => isReachableForChannel(guardian, channel));
  if (candidates.length === 0) return null;
  return candidates.find((guardian) => guardian.isPrimaryContact) ?? candidates[0];
}

export function countReachable(
  audience: CommunicationAudienceResponse | null,
  channel: CommunicationChannel,
): { athletes: number; guardians: number } {
  if (!audience) return { athletes: 0, guardians: 0 };
  let athletes = 0;
  let guardians = 0;
  for (const member of audience.items) {
    const reachable = member.guardians.filter((guardian) => isReachableForChannel(guardian, channel));
    if (reachable.length > 0) {
      athletes += 1;
      guardians += reachable.length;
    }
  }
  return { athletes, guardians };
}

export function listOutreach(params: {
  status?: 'draft' | 'logged' | 'archived';
  limit?: number;
} = {}): Promise<OutreachActivityListResponse> {
  const search = new URLSearchParams();
  search.set('limit', String(params.limit ?? 25));
  if (params.status) search.set('status', params.status);
  return apiGet<OutreachActivityListResponse>(
    `/api/communications/outreach?${search.toString()}`,
  );
}

export function logOutreach(payload: LogOutreachInput): Promise<OutreachActivity> {
  return apiPost<OutreachActivity>('/api/communications/outreach', payload);
}

export function getOutreach(id: string): Promise<OutreachActivity> {
  return apiGet<OutreachActivity>(`/api/communications/outreach/${id}`);
}

export function updateOutreach(id: string, payload: LogOutreachInput): Promise<OutreachActivity> {
  return apiPut<OutreachActivity>(`/api/communications/outreach/${id}`, payload);
}

export function setOutreachStatus(
  id: string,
  status: 'draft' | 'logged' | 'archived',
): Promise<OutreachActivity> {
  return apiPatch<OutreachActivity>(`/api/communications/outreach/${id}/status`, { status });
}

export function getCommunicationReadiness(
  channel: CommunicationChannel = 'whatsapp',
): Promise<CommunicationReadinessResponse> {
  const params = new URLSearchParams({ channel });
  return apiGet<CommunicationReadinessResponse>(
    `/api/communications/readiness?${params.toString()}`,
  );
}

export function saveWhatsAppReadiness(payload: {
  cloudApiEnabled?: boolean;
  phoneNumberId?: string | null;
  businessAccountId?: string | null;
  accessTokenRef?: string | null;
  displayPhoneNumber?: string | null;
}): Promise<WhatsAppReadinessSummary> {
  return apiPut<WhatsAppReadinessSummary>('/api/communications/readiness/whatsapp', payload);
}

export function validateWhatsAppReadiness(
  mode: 'local' | 'live' = 'local',
): Promise<WhatsAppReadinessSummary> {
  return apiPost<WhatsAppReadinessSummary>(
    '/api/communications/readiness/whatsapp/validate',
    { mode },
  );
}

export function attemptOutreachDelivery(
  id: string,
  payload: DeliverOutreachInput,
): Promise<OutreachActivity> {
  return apiPost<OutreachActivity>(`/api/communications/outreach/${id}/deliver`, payload);
}

/**
 * Determine the delivery mode that should be offered to the operator
 * for a given channel given the readiness response.  Direct send only
 * surfaces when the WhatsApp Cloud API plan reports `direct_capable`.
 *
 * Kept intentionally tiny — UX wording is decided by the page.
 */
export function resolvePreferredDeliveryMode(
  readiness: CommunicationReadinessResponse | null | undefined,
  channel: CommunicationChannel,
): DeliveryMode {
  if (!readiness) return 'assisted';
  if (readiness.channel !== channel) return 'assisted';
  return readiness.plan.preferredMode;
}

export function describeDelivery(
  t: TFunction,
  delivery: OutreachDelivery | null | undefined,
): string {
  if (!delivery) return t('pages.communications.delivery.history.prepared');
  const key = `pages.communications.delivery.history.${delivery.state}`;
  return t(key, { defaultValue: t('pages.communications.delivery.history.prepared') });
}

export function describeDeliveryTone(
  state: DeliveryState | undefined,
): 'success' | 'info' | 'danger' | 'warning' | 'default' {
  switch (state) {
    case 'sent':
      return 'success';
    case 'failed':
      return 'danger';
    case 'fallback':
      return 'warning';
    case 'prepared':
      return 'info';
    default:
      return 'default';
  }
}

/**
 * Per-recipient context used to resolve template tokens client-side.
 * Anything that is missing for a given recipient is rendered as a blank
 * string with a visible "—" placeholder so the operator can see what the
 * gap is before opening the chat.
 *
 * The catalog only grows with tokens that we can resolve reliably; we
 * never invent values.
 */
export type TokenContext = {
  athleteName: string;
  guardianName?: string | null;
  groupName?: string | null;
  teamName?: string | null;
  coachName?: string | null;
  branchName?: string | null;
  sessionLocation?: string | null;
  nextSession?: string | null;
  outstandingAmount?: string | null;
  overdueAmount?: string | null;
  clubName?: string | null;
};

/**
 * The reachability story we present to the operator before they open
 * WhatsApp.  We keep it intentionally small and human:
 *
 *  - `whatsapp` — best case, a primary phone is on file
 *  - `phone`    — phone is present but the operator picked a non-WhatsApp channel
 *  - `email`    — only an email is on file (WhatsApp is hidden as fallback)
 *  - `unreachable` — no guardian, or no usable contact at all
 */
export type RecipientReachState = 'whatsapp' | 'phone' | 'email' | 'unreachable';

/**
 * Compute the most accurate reachability label for a member.  This is
 * the single source of truth used by the recipient card chip, the
 * audience banner, and the bulk preview so the language stays consistent.
 */
export function classifyMemberReach(
  member: CommunicationAudienceMember,
  channel: CommunicationChannel,
): RecipientReachState {
  if (member.guardians.length === 0) return 'unreachable';
  const anyPhone = member.guardians.some((guardian) => Boolean(guardian.phone));
  const anyEmail = member.guardians.some((guardian) => Boolean(guardian.email));
  if (channel === 'whatsapp' || channel === 'phone') {
    if (anyPhone) return channel === 'whatsapp' ? 'whatsapp' : 'phone';
    if (anyEmail) return 'email';
    return 'unreachable';
  }
  if (channel === 'email') {
    if (anyEmail) return 'email';
    if (anyPhone) return 'whatsapp';
    return 'unreachable';
  }
  if (anyPhone) return 'whatsapp';
  if (anyEmail) return 'email';
  return 'unreachable';
}

const TOKEN_PATTERN = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
const MISSING_TOKEN_PLACEHOLDER = '—';

/** Tokens that we know how to resolve in v1.1 (alias `name` → `athleteName`). */
export const SUPPORTED_TEMPLATE_TOKENS: ReadonlyArray<keyof TokenContext | 'name'> = [
  'athleteName',
  'name',
  'guardianName',
  'groupName',
  'teamName',
  'coachName',
  'branchName',
  'sessionLocation',
  'nextSession',
  'outstandingAmount',
  'overdueAmount',
  'clubName',
];

function resolveToken(token: string, ctx: TokenContext): { value: string; missing: boolean } {
  const lookup: Record<string, string | null | undefined> = {
    athleteName: ctx.athleteName,
    name: ctx.athleteName,
    guardianName: ctx.guardianName,
    groupName: ctx.groupName,
    teamName: ctx.teamName,
    coachName: ctx.coachName,
    branchName: ctx.branchName,
    sessionLocation: ctx.sessionLocation,
    nextSession: ctx.nextSession,
    outstandingAmount: ctx.outstandingAmount,
    overdueAmount: ctx.overdueAmount,
    clubName: ctx.clubName,
  };
  if (!(token in lookup)) {
    return { value: `{{${token}}}`, missing: true };
  }
  const value = lookup[token];
  if (value === undefined || value === null || String(value).trim() === '') {
    return { value: MISSING_TOKEN_PLACEHOLDER, missing: true };
  }
  return { value: String(value), missing: false };
}

/**
 * Render a template body for one recipient.  Returns the personalised
 * message plus the list of token names that could not be resolved so
 * the UI can warn the operator before they open WhatsApp.
 */
export function renderTemplate(
  template: string,
  ctx: TokenContext,
): { text: string; missing: string[] } {
  const missing: string[] = [];
  const text = template.replace(TOKEN_PATTERN, (_match, token: string) => {
    const result = resolveToken(token, ctx);
    if (result.missing) missing.push(token);
    return result.value;
  });
  return { text, missing: Array.from(new Set(missing)) };
}

/** Tokens referenced by a template body (regardless of whether we can fill them). */
export function extractTokens(template: string): string[] {
  const seen = new Set<string>();
  for (const match of template.matchAll(TOKEN_PATTERN)) {
    seen.add(match[1]);
  }
  return Array.from(seen);
}

/**
 * Build the per-recipient TokenContext from an audience member plus any
 * draft-level extras the editor knows about (eg. selected coach, next
 * training session, club name).  We prefer the per-member sport branch
 * over the optional draft-level branch fallback so each recipient sees
 * their own real branch when the audience spans multiple branches.
 */
export function buildTokenContext(
  member: CommunicationAudienceMember,
  extras: {
    coachName?: string | null;
    branchName?: string | null;
    sessionLocation?: string | null;
    nextSession?: string | null;
    clubName?: string | null;
  } = {},
): TokenContext {
  const guardian =
    member.guardians.find((g) => g.isPrimaryContact) ?? member.guardians[0] ?? null;
  const branchName = member.sportBranchName ?? extras.branchName ?? null;
  return {
    athleteName: member.athleteName,
    guardianName: guardian?.name ?? null,
    groupName: member.groupName,
    teamName: member.teamNames[0] ?? null,
    coachName: extras.coachName ?? null,
    branchName,
    sessionLocation: extras.sessionLocation ?? null,
    nextSession: extras.nextSession ?? null,
    outstandingAmount: member.outstandingAmount,
    overdueAmount: member.overdueAmount,
    clubName: extras.clubName ?? null,
  };
}

/**
 * Days between two ISO timestamps, rounded down to whole days.  Used for
 * the gentle stale-draft hint surfaced in the history list and at the
 * top of the editor when an old draft is reopened.
 */
export function daysBetween(fromIso: string | null | undefined, now: Date = new Date()): number {
  if (!fromIso) return 0;
  const ms = now.getTime() - new Date(fromIso).getTime();
  if (Number.isNaN(ms) || ms < 0) return 0;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/**
 * Returns true when a draft is older than the configured stale window.
 * The window is small on purpose — we want a calm "still relevant?"
 * nudge, never a blocking warning.
 */
export function isOutreachStale(
  activity: { status?: string; updatedAt?: string | null; createdAt?: string | null },
  staleAfterDays: number,
  now: Date = new Date(),
): boolean {
  if (!activity || activity.status !== 'draft') return false;
  if (!Number.isFinite(staleAfterDays) || staleAfterDays <= 0) return false;
  const ts = activity.updatedAt ?? activity.createdAt ?? null;
  return daysBetween(ts, now) >= staleAfterDays;
}

/**
 * Pick the human "drafted X ago" / "logged X ago" label for an activity.
 * Stays warm and short — never CRM-like.
 */
export function describeActivityAge(
  t: TFunction,
  activity: { status?: string; updatedAt?: string | null; createdAt?: string | null },
  now: Date = new Date(),
): string {
  const ts = activity.updatedAt ?? activity.createdAt ?? null;
  const days = daysBetween(ts, now);
  const status = activity.status === 'draft' ? 'draft' : 'logged';
  if (status === 'draft') {
    if (days <= 0) return t('pages.communications.lifecycle.draftedToday');
    if (days === 1) return t('pages.communications.lifecycle.draftedYesterday');
    return t('pages.communications.lifecycle.draftedAgo', { count: days });
  }
  if (days <= 0) return t('pages.communications.lifecycle.draftedToday');
  return t('pages.communications.lifecycle.loggedAgo', { count: Math.max(days, 1) });
}
