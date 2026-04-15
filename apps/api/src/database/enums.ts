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
