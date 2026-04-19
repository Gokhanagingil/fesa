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
    athletesMissingPhone: number;
    withOverdueBalance: number;
    incompleteAthletes: number;
    awaitingGuardianAction: number;
    awaitingStaffReview: number;
    needingFollowUp: number;
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
};

export type OutreachStatus = 'draft' | 'logged' | 'archived';

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

export type GuardianPortalActivationStatus = {
  token: string;
  tenantId: string;
  tenantName: string;
  guardianId: string;
  guardianName: string;
  email: string;
  expiresAt: string;
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
  readiness: GuardianFamilyReadiness;
  linkedAthletes: GuardianPortalLinkedAthlete[];
  actions: FamilyActionRequest[];
  finance: {
    outstandingAthletes: number;
    overdueAthletes: number;
  };
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
