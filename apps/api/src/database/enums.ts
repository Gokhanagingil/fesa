/** Shared enum values for PostgreSQL enums and API contracts. */

export enum AthleteStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  INACTIVE = 'inactive',
  TRIAL = 'trial',
  ARCHIVED = 'archived',
}

export enum TrainingSessionStatus {
  PLANNED = 'planned',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum AttendanceStatus {
  PRESENT = 'present',
  ABSENT = 'absent',
  EXCUSED = 'excused',
  LATE = 'late',
}

export enum AthleteChargeStatus {
  PENDING = 'pending',
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

export enum FamilyActionRequestType {
  GUARDIAN_PROFILE_UPDATE = 'guardian_profile_update',
  CONTACT_DETAILS_COMPLETION = 'contact_details_completion',
  CONSENT_ACKNOWLEDGEMENT = 'consent_acknowledgement',
  ENROLLMENT_READINESS = 'enrollment_readiness',
  PROFILE_CORRECTION = 'profile_correction',
}

export enum FamilyActionRequestStatus {
  OPEN = 'open',
  PENDING_FAMILY_ACTION = 'pending_family_action',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  COMPLETED = 'completed',
  CLOSED = 'closed',
}

export enum FamilyActionActor {
  CLUB = 'club',
  FAMILY = 'family',
  SYSTEM = 'system',
}

export enum FamilyReadinessStatus {
  COMPLETE = 'complete',
  INCOMPLETE = 'incomplete',
  AWAITING_GUARDIAN_ACTION = 'awaiting_guardian_action',
  AWAITING_STAFF_REVIEW = 'awaiting_staff_review',
}
