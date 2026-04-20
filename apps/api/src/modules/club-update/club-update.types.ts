/**
 * Parent Portal v1.1 — Club Updates layer (controlled, not a CMS).
 *
 * The club updates API is intentionally tiny so it can stay calm in the
 * portal: short cards, no rich text, no per-family targeting, no
 * comments. See `club-update.entity.ts` for the persistence rationale.
 */
export type ClubUpdateCategory = 'announcement' | 'event' | 'reminder';
export type ClubUpdateStatus = 'draft' | 'published' | 'archived';

/**
 * Parent Portal v1.2 — Targeted announcements.
 *
 * The audience model is intentionally tiny: a single scope per card and
 * at most one targeting id. This avoids a giant audience builder while
 * already covering the relevance asks ("just the U14 girls", "only
 * volleyball families") clubs actually have.
 */
export type ClubUpdateAudienceScope = 'all' | 'sport_branch' | 'group' | 'team';

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

export const CLUB_UPDATE_AUDIENCE_SCOPES: ClubUpdateAudienceScope[] = [
  'all',
  'sport_branch',
  'group',
  'team',
];

/** Hard cap on what a parent ever sees in one render. Keeps the strip calm. */
export const PARENT_PORTAL_MAX_CLUB_UPDATES = 5;

/** Hard cap on what staff manage in one screen — the surface stays scrollable. */
export const STAFF_CLUB_UPDATES_LIMIT = 50;

export type ClubUpdateAudience = {
  scope: ClubUpdateAudienceScope;
  sportBranchId: string | null;
  groupId: string | null;
  teamId: string | null;
  /** Resolved label for staff list rendering, e.g. "U14 Kızlar" or "Volleyball families". */
  label: string | null;
};

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
  audience: ClubUpdateAudience;
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
  audienceScope?: ClubUpdateAudienceScope;
  audienceSportBranchId?: string | null;
  audienceGroupId?: string | null;
  audienceTeamId?: string | null;
};

/**
 * Parent-facing summary shape — same fields, smaller surface intent.
 * Includes the resolved audience label so the parent UI can render a
 * subtle "for U14 girls" hint without re-deriving anything.
 */
export type ClubUpdateParentSummary = {
  id: string;
  category: ClubUpdateCategory;
  title: string;
  body: string;
  linkUrl: string | null;
  linkLabel: string | null;
  publishedAt: string | null;
  pinned: boolean;
  audience: ClubUpdateAudience;
};

/**
 * The set of audience identifiers a parent currently belongs to (across
 * all linked athletes). The portal computes this once and intersects it
 * against every published card before deciding what to render.
 */
export type ParentAudienceSet = {
  sportBranchIds: Set<string>;
  groupIds: Set<string>;
  teamIds: Set<string>;
};

/** Pure helper so server, smoke tests and any future caller agree on the rule. */
export function clubUpdateMatchesParentAudience(
  card: Pick<ClubUpdatePayload, 'audience'> | { audience: ClubUpdateAudience },
  audience: ParentAudienceSet,
): boolean {
  const { scope, sportBranchId, groupId, teamId } = card.audience;
  if (scope === 'all') return true;
  if (scope === 'sport_branch') {
    return Boolean(sportBranchId && audience.sportBranchIds.has(sportBranchId));
  }
  if (scope === 'group') {
    return Boolean(groupId && audience.groupIds.has(groupId));
  }
  if (scope === 'team') {
    return Boolean(teamId && audience.teamIds.has(teamId));
  }
  return false;
}
