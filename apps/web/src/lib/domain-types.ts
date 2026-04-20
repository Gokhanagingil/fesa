/** Client-side shapes mirroring API responses (subset). */

export type AthleteStatus = 'active' | 'paused' | 'inactive' | 'trial' | 'archived';
export type TrainingSessionStatus = 'planned' | 'completed' | 'cancelled';
export type AttendanceStatus = 'present' | 'absent' | 'excused' | 'late';
export type AthleteChargeStatus = 'pending' | 'partially_paid' | 'paid' | 'cancelled';
export type GuardianRelationshipType = 'mother' | 'father' | 'guardian' | 'other';
export type FamilyActionRequestType =
  | 'guardian_profile_update'
  | 'contact_details_completion'
  | 'consent_acknowledgement'
  | 'enrollment_readiness'
  | 'profile_correction';
export type FamilyActionRequestStatus =
  | 'open'
  | 'pending_family_action'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'closed';
export type FamilyActionActor = 'club' | 'family' | 'system';
export type FamilyReadinessStatus = 'complete' | 'incomplete' | 'awaiting_guardian_action' | 'awaiting_staff_review';
export type ActionCenterItemCategory = 'finance' | 'family' | 'readiness' | 'private_lessons' | 'training';
export type ActionCenterItemType =
  | 'finance_follow_up'
  | 'family_review'
  | 'guardian_response'
  | 'readiness_gap'
  | 'private_lesson_prep'
  | 'training_prep'
  | 'training_attendance';
export type ActionCenterItemUrgency = 'overdue' | 'today' | 'upcoming' | 'normal';
export type ActionCenterItemMutation = 'mark_read' | 'mark_unread' | 'dismiss' | 'complete' | 'snooze';
export type StaffPlatformRole = 'global_admin' | 'standard';
export type StaffUserStatus = 'active' | 'disabled';
export type TenantMembershipRole = 'club_admin' | 'staff' | 'coach';
export type ActionCenterView = 'notifications' | 'queue';

export type SportBranch = { id: string; code: string; name: string };
export type Coach = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  sportBranchId: string;
  sportBranch?: SportBranch;
  phone: string | null;
  email: string | null;
  specialties: string | null;
  isActive: boolean;
  notes: string | null;
};
export type ClubGroup = {
  id: string;
  name: string;
  sportBranchId: string;
  sportBranch?: SportBranch;
  headCoachId?: string | null;
  headCoach?: Coach | null;
  teams?: Pick<Team, 'id' | 'name'>[];
};
export type Team = {
  id: string;
  name: string;
  sportBranchId: string;
  groupId: string | null;
  code?: string | null;
  headCoachId?: string | null;
  headCoach?: Coach | null;
  sportBranch?: SportBranch;
  group?: ClubGroup | null;
};

export type Athlete = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  birthDate: string | null;
  gender: string | null;
  sportBranchId: string;
  primaryGroupId: string | null;
  status: AthleteStatus;
  jerseyNumber: string | null;
  shirtSize: string | null;
  notes: string | null;
  /** Wave 16 — Athlete Photo & Media Foundation v1. */
  photoFileName?: string | null;
  photoContentType?: string | null;
  photoSizeBytes?: number | null;
  photoUploadedAt?: string | null;
  sportBranch?: SportBranch;
  primaryGroup?: ClubGroup | null;
};

export type Guardian = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  notes?: string | null;
};

export type GuardianPortalAccessStatus = 'invited' | 'active' | 'disabled';

/**
 * Parent Invite Delivery & Access Reliability Pack — truthful invite
 * delivery state. The staff UI renders one of these states verbatim;
 * we never imply an invite was delivered when it was not.
 */
export type GuardianInviteDeliveryState =
  | 'pending'
  | 'sent'
  | 'failed'
  | 'shared_manually'
  | 'unavailable';

export type GuardianInviteDeliverySummary = {
  state: GuardianInviteDeliveryState | null;
  provider: string | null;
  detail: string | null;
  attemptedAt: string | null;
  deliveredAt: string | null;
  sharedAt: string | null;
  attemptCount: number;
  toneKey:
    | 'pages.guardians.portalAccess.deliveryTone.sent'
    | 'pages.guardians.portalAccess.deliveryTone.failed'
    | 'pages.guardians.portalAccess.deliveryTone.unavailable'
    | 'pages.guardians.portalAccess.deliveryTone.sharedManually'
    | 'pages.guardians.portalAccess.deliveryTone.pending';
};

export type GuardianInviteDeliveryReadiness = {
  available: boolean;
  provider: 'smtp' | 'manual';
  state: 'configured' | 'not_configured' | 'error';
  message: string | null;
  fromAddress: string | null;
  verified: boolean;
  verifiedAt: string | null;
};

export type GuardianPortalAccessSummary = {
  id: string;
  guardianId: string;
  guardianName: string;
  guardianEmail: string | null;
  status: GuardianPortalAccessStatus;
  invitedAt: string | null;
  activatedAt: string | null;
  lastLoginAt: string | null;
  portalEnabled: boolean;
  pendingActions: number;
  awaitingReview: number;
  linkedAthletes: number;
  inviteLink?: string;
  /** Parent Invite Delivery & Access Reliability Pack — absolute link for manual share. */
  absoluteInviteLink?: string;
  /** Parent Portal v1.2 — surfaced when a family used the public recovery form. */
  recoveryRequestedAt?: string | null;
  recoveryRequestCount?: number;
  /** Parent Invite Delivery & Access Reliability Pack — truthful state. */
  inviteDelivery?: GuardianInviteDeliverySummary;
  /** Same data, surfaced under `delivery` on invite mutations. */
  delivery?: GuardianInviteDeliverySummary;
};

export type GuardianPortalActionSubmissionInput = {
  responseText?: string;
  phone?: string;
  email?: string;
  notes?: string;
};

export type GuardianPortalActionReviewRequest = {
  decision: 'approved' | 'rejected';
  note?: string;
};

export type AthleteGuardianLink = {
  id: string;
  relationshipType: string;
  isPrimaryContact: boolean;
  notes?: string | null;
  guardian: Guardian;
  athlete?: Athlete;
};

export type TeamMembership = {
  id: string;
  startedAt: string | null;
  endedAt: string | null;
  team: Team;
};

export type TrainingSessionSeries = {
  id: string;
  title: string;
  sportBranchId: string;
  groupId: string;
  teamId: string | null;
  coachId?: string | null;
  startsOn: string;
  endsOn: string;
  weekdays: number[];
  sessionStartTime: string;
  sessionEndTime: string;
  location: string | null;
  status: TrainingSessionStatus;
  notes?: string | null;
};

export type TrainingSession = {
  id: string;
  title: string;
  sportBranchId: string;
  groupId: string;
  teamId: string | null;
  coachId?: string | null;
  seriesId?: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  location: string | null;
  status: TrainingSessionStatus;
  notes?: string | null;
  sportBranch?: SportBranch;
  group?: ClubGroup;
  team?: Team | null;
  coach?: Coach | null;
};

export type AttendanceRow = {
  id: string;
  status: AttendanceStatus;
  note: string | null;
  athlete: Athlete;
};

export type ChargeItem = {
  id: string;
  name: string;
  category: string;
  defaultAmount: string;
  currency: string;
  isActive: boolean;
};

export type AthleteCharge = {
  id: string;
  athleteId: string;
  chargeItemId: string;
  privateLessonId?: string | null;
  amount: string;
  dueDate: string | null;
  billingPeriodKey?: string | null;
  billingPeriodLabel?: string | null;
  status: AthleteChargeStatus;
  derivedStatus?: AthleteChargeStatus;
  allocatedAmount?: string;
  remainingAmount?: string;
  isOverdue?: boolean;
  chargeItem?: ChargeItem;
  athlete?: Athlete;
  notes?: string | null;
};

export type PrivateLesson = {
  id: string;
  athleteId: string;
  coachId: string;
  sportBranchId: string;
  focus: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  location: string | null;
  status: TrainingSessionStatus;
  attendanceStatus: AttendanceStatus | null;
  notes: string | null;
  athlete?: Athlete;
  coach?: Coach;
  charge?: AthleteCharge | null;
};

export type CommunicationAudienceMember = {
  athleteId: string;
  athleteName: string;
  athleteStatus: AthleteStatus;
  reasons: string[];
  groupId: string | null;
  groupName: string | null;
  teamIds: string[];
  teamNames: string[];
  sportBranchId?: string | null;
  sportBranchName?: string | null;
  guardians: Array<{
    guardianId: string;
    name: string;
    relationshipType: string;
    phone: string | null;
    email: string | null;
    isPrimaryContact: boolean;
    portalAccessStatus?: GuardianPortalAccessStatus | null;
  }>;
  outstandingAmount: string;
  overdueAmount: string;
  hasOverdueBalance: boolean;
  familyReadinessStatus: FamilyReadinessStatus;
  pendingFamilyActions: number;
  awaitingStaffReview: number;
};

export type CommunicationAudienceResponse = {
  items: CommunicationAudienceMember[];
  counts: {
    athletes: number;
    guardians: number;
    primaryContacts: number;
    guardiansWithPhone: number;
    guardiansWithEmail: number;
    athletesWithPhoneReach: number;
    athletesWithEmailReach?: number;
    athletesUnreachable?: number;
    athletesMissingPhone: number;
    withOverdueBalance: number;
    incompleteAthletes: number;
    awaitingGuardianAction: number;
    awaitingStaffReview: number;
    needingFollowUp: number;
  };
  meta?: {
    clubName?: string | null;
  };
};

export type CommunicationChannel = 'whatsapp' | 'phone' | 'email' | 'manual';

export type CommunicationTemplateCategory =
  | 'finance'
  | 'attendance'
  | 'trial'
  | 'session'
  | 'group'
  | 'general';

export type CommunicationTemplate = {
  key: string;
  defaultChannel: CommunicationChannel;
  category: CommunicationTemplateCategory;
  titleKey: string;
  bodyKey: string;
  subjectKey?: string;
  hintKey?: string;
};

export type CommunicationTemplateToken = {
  key: string;
  labelKey: string;
  hintKey: string;
  alwaysAvailable: boolean;
};

export type CommunicationTemplatesResponse = {
  channels: CommunicationChannel[];
  items: CommunicationTemplate[];
  tokens?: CommunicationTemplateToken[];
  lifecycle?: {
    /**
     * Drafts older than this many days surface a quiet "still relevant?"
     * hint in the history surface and at the top of the draft editor when
     * a stale draft is reopened.  Lifecycle stays intentionally tiny.
     */
    staleAfterDays: number;
  };
};

export type OutreachStatus = 'draft' | 'logged' | 'archived';

export type DeliveryMode = 'assisted' | 'direct';
export type DeliveryState = 'prepared' | 'sent' | 'failed' | 'fallback';

export type OutreachDeliveryAttemptCounts = {
  attempted: number;
  sent: number;
  failed: number;
};

export type OutreachDelivery = {
  mode: DeliveryMode;
  state: DeliveryState;
  provider: string | null;
  providerMessageId: string | null;
  detail: string | null;
  attemptedAt: string | null;
  completedAt: string | null;
  /** Counts from the most recent delivery attempt; null when never attempted. */
  attemptCounts?: OutreachDeliveryAttemptCounts | null;
};

export type OutreachActivity = {
  id: string;
  channel: CommunicationChannel | string;
  status?: OutreachStatus;
  sourceSurface: string;
  sourceKey: string | null;
  templateKey: string | null;
  topic: string;
  messagePreview: string | null;
  recipientCount: number;
  reachableGuardianCount: number;
  audienceSnapshot: Record<string, unknown>;
  note: string | null;
  createdByStaffUserId: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt?: string;
  delivery?: OutreachDelivery;
};

export type WhatsAppReadinessStateValue =
  | 'not_configured'
  | 'assisted_only'
  | 'partial'
  | 'direct_capable'
  | 'invalid';

export type WhatsAppReadinessSummary = {
  state: WhatsAppReadinessStateValue;
  directSendAvailable: boolean;
  cloudApiEnabled: boolean;
  configured: {
    phoneNumberId: boolean;
    businessAccountId: boolean;
    accessTokenRef: boolean;
  };
  displayPhoneNumber: string | null;
  validation: {
    state: 'ok' | 'pending' | 'invalid' | 'never_validated';
    message: string | null;
    validatedAt: string | null;
  };
  issues: string[];
};

export type ProviderCapability = {
  provider: string;
  mode: DeliveryMode;
  channels: CommunicationChannel[];
  state: 'direct_capable' | 'partial' | 'assisted_only' | 'not_configured' | 'invalid';
  message: string | null;
};

export type CommunicationReadinessResponse = {
  channel: CommunicationChannel;
  whatsapp: WhatsAppReadinessSummary;
  plan: {
    preferredMode: DeliveryMode;
    fallbackMode: DeliveryMode | null;
    capabilities: ProviderCapability[];
  };
};

export type DeliverOutreachInput = {
  mode?: DeliveryMode;
  recipients: Array<{
    athleteId: string;
    athleteName: string;
    guardianId?: string | null;
    guardianName?: string | null;
    phone?: string | null;
    email?: string | null;
    message: string;
    subject?: string | null;
  }>;
};

export type OutreachActivityListResponse = {
  items: OutreachActivity[];
  counts: {
    total: number;
    whatsapp: number;
    phone: number;
    email: number;
    manual: number;
    draft?: number;
    logged?: number;
    archived?: number;
  };
};

export type LogOutreachInput = {
  channel: CommunicationChannel;
  status?: OutreachStatus;
  sourceSurface: string;
  sourceKey?: string;
  templateKey?: string;
  topic: string;
  messagePreview?: string;
  athleteIds?: string[];
  guardianIds?: string[];
  audienceFilters?: Record<string, unknown>;
  recipientCount?: number;
  reachableGuardianCount?: number;
  audienceSummary?: {
    athletes?: number;
    guardians?: number;
    primaryContacts?: number;
    withOverdueBalance?: number;
    needingFollowUp?: number;
    contextLabel?: string;
  };
  note?: string;
};

/**
 * Parent Portal & Tenant Branding Foundation v1 — controlled brand payload.
 *
 * Layout, typography, spacing, component structure, and interaction patterns
 * stay shared across all tenants. The fields below are the only brand
 * surface area the portal renders per club.
 */
export type TenantBrandingPayload = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  displayName: string;
  tagline: string | null;
  primaryColor: string;
  accentColor: string;
  /** Effective logo URL (uploaded asset or external URL). Parents see this. */
  logoUrl: string | null;
  /** Externally hosted, free-form logo URL. */
  externalLogoUrl?: string | null;
  /** True when the tenant has uploaded a logo asset via Brand Admin v1.1. */
  hasUploadedLogo?: boolean;
  welcomeTitle: string | null;
  welcomeMessage: string | null;
  /**
   * Parent Portal v1.1 — staff-side contrast advisory. The portal still
   * picks readable ink colours automatically; this is purely a hint for
   * the brand admin so club staff can see when a colour choice would
   * land below WCAG AA against either ink colour.
   */
  contrast?: {
    primaryInk: 'light' | 'dark';
    accentInk: 'light' | 'dark';
    primaryRatio: number;
    accentRatio: number;
    primaryReadable: boolean;
    accentReadable: boolean;
  };
  isCustomized: boolean;
  updatedAt: string | null;
};

/**
 * Parent Portal v1.1 — Club Updates (parent-facing summary).
 *
 * Deliberately small: title, body, optional safe link, category pill, and
 * a calmly-rendered timestamp. Parents never see drafts, expired cards,
 * or scheduled-but-not-yet-published cards.
 */
export type ClubUpdateCategory = 'announcement' | 'event' | 'reminder';
export type ClubUpdateStatus = 'draft' | 'published' | 'archived';

/**
 * Parent Portal v1.2 — Targeted announcements.
 * The audience model is intentionally tiny — single scope per card and
 * at most one targeting id.
 */
export type ClubUpdateAudienceScope = 'all' | 'sport_branch' | 'group' | 'team';

export type ClubUpdateAudience = {
  scope: ClubUpdateAudienceScope;
  sportBranchId: string | null;
  groupId: string | null;
  teamId: string | null;
  /** Resolved label for staff/parent rendering, e.g. "U14 Kızlar". */
  label: string | null;
};

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

export type ClubUpdate = {
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
 * Parent Portal v1.2 — staff editor catalog of targeting handles.
 * Returned by `GET /api/club-updates/audience-options`.
 */
export type ClubUpdateAudienceOptions = {
  sportBranches: Array<{ id: string; name: string }>;
  groups: Array<{ id: string; name: string; sportBranchId: string | null }>;
  teams: Array<{ id: string; name: string; sportBranchId: string | null; groupId: string | null }>;
};

export type GuardianPortalActivationStatus = {
  token: string;
  tenantId: string;
  tenantName: string;
  guardianId: string;
  guardianName: string;
  email: string;
  expiresAt: string;
  branding?: TenantBrandingPayload;
};

export type GuardianPortalLinkedAthlete = {
  linkId: string;
  athleteId: string;
  relationshipType: string;
  isPrimaryContact: boolean;
  athleteName: string;
  groupName: string | null;
  status: AthleteStatus | null;
  outstandingAmount: string;
  overdueAmount: string;
  nextTraining: Array<{
    id: string;
    title: string;
    scheduledStart: string;
  }>;
  nextPrivateLesson: {
    id: string;
    scheduledStart: string;
    coachName: string | null;
  } | null;
  /** Parent Portal v1.2 — open inventory assignments for this athlete. */
  inventoryInHand?: Array<{
    id: string;
    itemName: string;
    variantLabel: string;
    quantity: number;
    assignedAt: string;
  }>;
};

export type GuardianPortalTodayItem = {
  id: string;
  title?: string;
  scheduledStart: string;
  location?: string | null;
  athleteId?: string;
  athleteName?: string;
  coachName?: string | null;
};

/**
 * Parent Portal v1.2 — "this week" merged digest item. Either a training
 * session ("training") or a private lesson ("lesson"). The portal sorts
 * by `scheduledStart` and caps the list at 5 entries to keep the home
 * scannable.
 */
export type GuardianPortalWeekItem = {
  kind: 'training' | 'lesson';
  id: string;
  title: string | null;
  scheduledStart: string;
  location: string | null;
  athleteId: string | null;
  athleteName: string | null;
  coachName: string | null;
};

export type GuardianPortalEssentialKey =
  | 'confirm_phone'
  | 'review_children'
  | 'open_pending_action'
  | 'check_balance';

export type GuardianPortalEssential = {
  key: GuardianPortalEssentialKey;
  severity: 'info' | 'attention';
  done: boolean;
};

/**
 * Family Activation & Landing Pack v1 — calm landing payload.
 *
 * The portal home renders a warm "first landing" welcome card on the
 * first session after activation, plus a tiny essentials strip that
 * surfaces the few high-value next actions for the family. Both fields
 * are entirely optional; the home hides them whenever they have nothing
 * meaningful to show, so returning families stay on the calm shell.
 */
export type GuardianPortalLandingSummary = {
  firstLanding: boolean;
  windowDays: number;
  essentials: GuardianPortalEssential[];
  essentialsAttentionCount: number;
};

/**
 * Parent Portal v1.3 — Payment Readiness layer.
 *
 * Calm family-facing finance surface. Never a collections / dunning
 * surface. The portal renders this block as a dedicated card with
 * three states: "all clear", "open balance", and "needs attention".
 */
export type GuardianPortalPaymentReadinessCharge = {
  id: string;
  athleteId: string;
  athleteName: string;
  itemName: string;
  amount: string;
  remainingAmount: string;
  dueDate: string | null;
  status: 'overdue' | 'dueSoon' | 'open';
  isOverdue: boolean;
  currency: string;
  billingPeriodLabel: string | null;
};

export type GuardianPortalPaymentReadiness = {
  currency: string;
  totals: {
    outstandingAmount: string;
    overdueAmount: string;
    openCount: number;
    overdueCount: number;
    dueSoonCount: number;
  };
  /** Tone hint computed by the API. The portal copies are calm in every state. */
  tone: 'clear' | 'open' | 'attention';
  /** "Soon" window the API used to classify dueSoon entries. */
  windowDays: number;
  nextDue: {
    chargeId: string;
    athleteId: string;
    athleteName: string;
    itemName: string;
    amount: string;
    remainingAmount: string;
    dueDate: string | null;
    currency: string;
  } | null;
  charges: GuardianPortalPaymentReadinessCharge[];
  perAthlete: Array<{
    athleteId: string;
    athleteName: string;
    outstanding: string;
    overdue: string;
  }>;
};

/**
 * Parent Portal v1.3 — Communication Continuity layer.
 *
 * A single calm strip carrying the small slice of recent club->family
 * context the parent should be aware of. We never expose internal
 * staff workflow noise here — only published club updates and
 * family-action moments the parent already has visibility into.
 */
export type GuardianPortalContinuityMoment = {
  id: string;
  kind: 'club_update' | 'family_request';
  occurredAt: string;
  title: string;
  summary: string | null;
  athleteName: string | null;
  status:
    | 'published'
    | 'open'
    | 'pending_family_action'
    | 'submitted'
    | 'under_review'
    | 'approved'
    | 'rejected'
    | 'completed'
    | 'closed'
    | null;
  actionId: string | null;
  audienceLabel: string | null;
};

export type GuardianPortalCommunicationContinuity = {
  windowDays: number;
  moments: GuardianPortalContinuityMoment[];
  hasOpenFamilyRequest: boolean;
};

export type GuardianPortalHome = {
  guardian: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
  access: {
    status: GuardianPortalAccessStatus;
    activatedAt: string | null;
    lastLoginAt: string | null;
  };
  branding?: TenantBrandingPayload;
  readiness: GuardianFamilyReadiness;
  linkedAthletes: GuardianPortalLinkedAthlete[];
  actions: FamilyActionRequest[];
  finance: {
    outstandingAthletes: number;
    overdueAthletes: number;
  };
  /** Parent Portal v1.3 — calm payment readiness card. */
  paymentReadiness?: GuardianPortalPaymentReadiness;
  /** Parent Portal v1.3 — recent club->family communication continuity. */
  communication?: GuardianPortalCommunicationContinuity;
  today?: {
    training: GuardianPortalTodayItem[];
    privateLessons: GuardianPortalTodayItem[];
  };
  thisWeek?: {
    items: GuardianPortalWeekItem[];
  };
  clubUpdates?: ClubUpdateParentSummary[];
  landing?: GuardianPortalLandingSummary;
};

export type FamilyActionEvent = {
  id: string;
  actor: FamilyActionActor;
  eventType: string;
  fromStatus: FamilyActionRequestStatus | null;
  toStatus: FamilyActionRequestStatus | null;
  note: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type FamilyActionRequest = {
  id: string;
  athleteId: string;
  athleteName: string;
  guardianId: string | null;
  guardianName: string | null;
  type: FamilyActionRequestType;
  status: FamilyActionRequestStatus;
  title: string;
  description: string | null;
  dueDate: string | null;
  payload: Record<string, unknown>;
  latestResponseText: string | null;
  decisionNote: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  latestEventAt: string | null;
  eventCount: number;
  events: FamilyActionEvent[];
};

export type AthleteFamilyReadiness = {
  athleteId: string;
  status: FamilyReadinessStatus;
  issueCodes: string[];
  summary: {
    guardiansLinked: number;
    primaryContacts: number;
    guardiansMissingContactDetails: number;
    missingItems: number;
    pendingFamilyActions: number;
    awaitingStaffReview: number;
    completedActions: number;
    openActions: number;
  };
  actions: FamilyActionRequest[];
};

export type GuardianFamilyReadiness = {
  guardianId: string;
  status: FamilyReadinessStatus;
  issueCodes: string[];
  summary: {
    linkedAthletes: number;
    primaryRelationships: number;
    athletesAwaitingGuardianAction: number;
    athletesAwaitingStaffReview: number;
  };
  actions: FamilyActionRequest[];
};

export type FamilyActionWorkflowSummary = {
  counts: {
    open: number;
    pendingFamilyAction: number;
    awaitingStaffReview: number;
    completed: number;
    incompleteAthletes: number;
    athletesAwaitingGuardianAction: number;
    athletesAwaitingStaffReview: number;
  };
  items: FamilyActionRequest[];
};

export type Payment = {
  id: string;
  athleteId: string;
  amount: string;
  currency: string;
  paidAt: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
  athlete?: Athlete;
};

export type AthleteFinanceAggregate = {
  athlete: Athlete;
  totalCharged: number;
  totalCollected: number;
  totalOutstanding: number;
  totalOverdue: number;
  unpaidCount: number;
  partialCount: number;
  overdueCount: number;
};

export type AthleteFinanceSummaryResponse = {
  totals: {
    totalCharged: string;
    totalCollected: string;
    totalOutstanding: string;
    totalOverdue: string;
  };
  charges: AthleteCharge[];
  recentPayments: Payment[];
  athletes: AthleteFinanceAggregate[];
  privateLessons?: PrivateLesson[];
};

export type DashboardSummary = {
  stats: {
    athletes: number;
    guardians?: number;
    upcomingSessions: number;
    totalSessions: number;
    cancelledSessions: number;
    activeCoaches?: number;
    privateLessonsThisWeek?: number;
    outstandingTotal: string;
    overdueTotal: string;
    collectedTotal: string;
  };
  attendance: Partial<Record<AttendanceStatus, number>>;
  groupDistribution: Array<{ name: string | null; count: number }>;
  upcomingByGroup: Array<{ name: string; count: number }>;
  recentPayments: Payment[];
  topOutstandingAthletes: AthleteFinanceAggregate[];
};

export type AttendanceIntelligenceSummary = {
  windows: {
    recentDays: number;
    followUpDays: number;
    prepHours: number;
  };
  thresholds: {
    minimumMarkedSessions: number;
    declinePoints: number;
    repeatAbsences: number;
    trialStrongRate: number;
  };
  counts: {
    watchlist: number;
    trialMomentum: number;
    followUp: number;
    attendancePending: number;
    upcomingAttention: number;
  };
  watchlist: Array<Record<string, string | number | boolean | null>>;
  trialMomentum: Array<Record<string, string | number | boolean | null>>;
  followUp: Array<Record<string, string | number | boolean | null>>;
  lowAttendanceGroups: Array<{
    dim_session_groupName: string | null;
    sessionCount: number;
    avgAttendanceRate: number | null;
  }>;
  coachLoad: Array<{
    dim_session_coachName: string | null;
    sessionCount: number;
    avgRosterSize: number | null;
  }>;
  attendancePendingSessions: Array<Record<string, string | number | boolean | null>>;
  upcomingAttentionSessions: Array<Record<string, string | number | boolean | null>>;
};

export type ReportingDefinitionsResponse = {
  items: Array<{
    key: string;
    titleKey: string;
    domains: string[];
  }>;
  presetCount: number;
  messageKey: string;
};

export type CommandCenterResponse = DashboardSummary & {
  overdueCharges: AthleteCharge[];
  upcomingPrivateLessons?: PrivateLesson[];
  coachesByLoad?: Array<{ coach: Coach; upcomingCount: number; privateLessonCount: number }>;
  attendanceIntelligence?: AttendanceIntelligenceSummary;
  communicationReadiness?: {
    audienceAthletes: number;
    reachableGuardians: number;
    athletesWithOverdueBalance: number;
    incompleteAthletes: number;
    athletesAwaitingGuardianAction: number;
    athletesAwaitingStaffReview: number;
    athletesNeedingFollowUp: number;
  };
  familyWorkflow?: FamilyActionWorkflowSummary['counts'] & {
    items: FamilyActionRequest[];
  };
  actionCenter?: ActionCenterSummary;
};

export type ActionCenterItem = {
  itemKey: string;
  snapshotToken: string;
  category: ActionCenterItemCategory;
  type: ActionCenterItemType;
  urgency: ActionCenterItemUrgency;
  subjectId: string;
  subjectName: string;
  relatedName: string | null;
  count: number;
  amount: string | null;
  currency: string | null;
  dueAt: string | null;
  occurredAt: string | null;
  deepLink: string;
  communicationLink: string | null;
  context: Record<string, string | number | boolean | string[] | null>;
  read: boolean;
  snoozedUntil: string | null;
};

export type ActionCenterSummary = {
  counts: {
    total: number;
    unread: number;
    overdue: number;
    today: number;
    byCategory: Record<ActionCenterItemCategory, number>;
    byUrgency: Record<ActionCenterItemUrgency, number>;
  };
  groups?: ActionCenterItemGroup[];
  items: ActionCenterItem[];
};

export type ActionCenterCategorySummary = {
  category: ActionCenterItemCategory;
  count: number;
  unread: number;
  overdue: number;
  today: number;
};

export type ActionCenterItemGroup = {
  category: ActionCenterItemCategory;
  count: number;
  unread: number;
  overdue: number;
  today: number;
  items: ActionCenterItem[];
};

export type ActionCenterResponse = ActionCenterSummary & {
  meta: {
    view: ActionCenterView;
    includeRead: boolean;
    categorySummaries: ActionCenterCategorySummary[];
  };
};

export type StaffMembershipSummary = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: TenantMembershipRole;
  isActive: boolean;
};

export type StaffIdentity = {
  id: string;
  fullName: string;
  email: string;
  platformRole: StaffPlatformRole;
  status: StaffUserStatus;
};

export type StaffSessionSummary = {
  user: StaffIdentity;
  memberships: StaffMembershipSummary[];
  activeTenantId: string | null;
  allowedTenants: Array<{ id: string; name: string; slug: string }>;
};

export type PeriodicChargeTargetScope = 'selected' | 'group' | 'team';

export type PeriodicChargeTargetPreview = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  status: AthleteStatus;
  primaryGroupId: string | null;
};

export type PeriodicChargePreviewResponse = {
  targetCount: number;
  createCount: number;
  skippedCount: number;
  amount: string;
  currency: string;
  billingPeriodKey: string;
  billingPeriodLabel: string;
  targets: PeriodicChargeTargetPreview[];
  skippedAthleteIds: string[];
};

export type PeriodicChargeGenerateResponse = PeriodicChargePreviewResponse & {
  createdIds: string[];
};

// —— Inventory & Assignment Pack v1 ——

export type InventoryCategory = 'apparel' | 'balls' | 'equipment' | 'gear' | 'other';

export type InventoryMovementType =
  | 'stock_added'
  | 'stock_removed'
  | 'stock_adjusted'
  | 'assigned'
  | 'returned'
  | 'retired';

export type InventoryVariantSummary = {
  id: string;
  inventoryItemId: string;
  size: string | null;
  number: string | null;
  color: string | null;
  isDefault: boolean;
  stockOnHand: number;
  assignedCount: number;
  available: number;
  effectiveLowStockThreshold: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
  isActive: boolean;
};

export type InventoryItemSummary = {
  id: string;
  name: string;
  category: InventoryCategory;
  sportBranchId: string | null;
  sportBranchName: string | null;
  hasVariants: boolean;
  trackAssignment: boolean;
  description: string | null;
  isActive: boolean;
  lowStockThreshold: number;
  totalStock: number;
  totalAssigned: number;
  totalAvailable: number;
  variantCount: number;
  lowStockVariantCount: number;
  outOfStockVariantCount: number;
  activeAssignmentCount: number;
  variants: InventoryVariantSummary[];
  createdAt: string;
  updatedAt: string;
};

export type InventoryAssignmentSummary = {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  inventoryItemCategory: InventoryCategory;
  inventoryVariantId: string;
  variantLabel: string;
  size: string | null;
  number: string | null;
  color: string | null;
  athleteId: string;
  athleteName: string;
  athletePrimaryGroupId: string | null;
  quantity: number;
  assignedAt: string;
  returnedAt: string | null;
  isOpen: boolean;
  notes: string | null;
};

export type InventoryMovementSummary = {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  inventoryVariantId: string;
  variantLabel: string;
  type: InventoryMovementType;
  quantity: number;
  athleteId: string | null;
  athleteName: string | null;
  note: string | null;
  createdAt: string;
};

export type InventoryListResponse = {
  items: InventoryItemSummary[];
  total: number;
  counts: {
    activeItems: number;
    inactiveItems: number;
    lowStockItems: number;
    outOfStockItems: number;
    totalAssignments: number;
    byCategory: Record<InventoryCategory, number>;
  };
};

export type InventoryItemDetailResponse = {
  item: InventoryItemSummary;
  activeAssignments: InventoryAssignmentSummary[];
  recentMovements: InventoryMovementSummary[];
};
