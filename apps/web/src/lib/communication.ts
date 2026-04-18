import type {
  CommunicationAudienceMember,
  CommunicationAudienceResponse,
  CommunicationChannel,
  LogOutreachInput,
  OutreachActivity,
  OutreachActivityListResponse,
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

/**
 * Per-recipient context used to resolve template tokens client-side.
 * Anything that is missing for a given recipient is rendered as a blank
 * string with a visible "—" placeholder so the operator can see what the
 * gap is before opening the chat.
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
 * training session, club name).
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
  return {
    athleteName: member.athleteName,
    guardianName: guardian?.name ?? null,
    groupName: member.groupName,
    teamName: member.teamNames[0] ?? null,
    coachName: extras.coachName ?? null,
    branchName: extras.branchName ?? null,
    sessionLocation: extras.sessionLocation ?? null,
    nextSession: extras.nextSession ?? null,
    outstandingAmount: member.outstandingAmount,
    overdueAmount: member.overdueAmount,
    clubName: extras.clubName ?? null,
  };
}
