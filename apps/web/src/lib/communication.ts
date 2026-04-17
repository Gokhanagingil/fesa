import type {
  CommunicationAudienceMember,
  CommunicationAudienceResponse,
  CommunicationChannel,
  LogOutreachInput,
  OutreachActivityListResponse,
} from './domain-types';
import { apiGet, apiPost } from './api';

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

export function listOutreach(): Promise<OutreachActivityListResponse> {
  return apiGet<OutreachActivityListResponse>('/api/communications/outreach?limit=25');
}

export function logOutreach(payload: LogOutreachInput): Promise<unknown> {
  return apiPost('/api/communications/outreach', payload);
}
