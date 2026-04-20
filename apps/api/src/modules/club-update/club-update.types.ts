/**
 * Parent Portal v1.1 — Club Updates layer (controlled, not a CMS).
 *
 * The club updates API is intentionally tiny so it can stay calm in the
 * portal: short cards, no rich text, no per-family targeting, no
 * comments. See `club-update.entity.ts` for the persistence rationale.
 */
export type ClubUpdateCategory = 'announcement' | 'event' | 'reminder';
export type ClubUpdateStatus = 'draft' | 'published' | 'archived';

export const CLUB_UPDATE_CATEGORIES: ClubUpdateCategory[] = [
  'announcement',
  'event',
  'reminder',
];

export const CLUB_UPDATE_STATUSES: ClubUpdateStatus[] = [
  'draft',
  'published',
  'archived',
];

/** Hard cap on what a parent ever sees in one render. Keeps the strip calm. */
export const PARENT_PORTAL_MAX_CLUB_UPDATES = 5;

/** Hard cap on what staff manage in one screen — the surface stays scrollable. */
export const STAFF_CLUB_UPDATES_LIMIT = 50;

export type ClubUpdatePayload = {
  id: string;
  tenantId: string;
  category: ClubUpdateCategory;
  status: ClubUpdateStatus;
  title: string;
  body: string;
  linkUrl: string | null;
  linkLabel: string | null;
  publishedAt: string | null;
  expiresAt: string | null;
  pinnedUntil: string | null;
  pinned: boolean;
  expired: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ClubUpdateInput = {
  category?: ClubUpdateCategory;
  status?: ClubUpdateStatus;
  title?: string;
  body?: string;
  linkUrl?: string | null;
  linkLabel?: string | null;
  publishedAt?: string | null;
  expiresAt?: string | null;
  pinnedUntil?: string | null;
};

/** Parent-facing summary shape — same fields, smaller surface intent. */
export type ClubUpdateParentSummary = {
  id: string;
  category: ClubUpdateCategory;
  title: string;
  body: string;
  linkUrl: string | null;
  linkLabel: string | null;
  publishedAt: string | null;
  pinned: boolean;
};
