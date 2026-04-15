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
    withOverdueBalance: number;
    incompleteAthletes: number;
    awaitingGuardianAction: number;
    awaitingStaffReview: number;
    needingFollowUp: number;
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
