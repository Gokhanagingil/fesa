/**
 * Shared contracts for the amateur platform API and clients.
 * Keep payloads small and evolution-friendly.
 */

export type Uuid = string;

/** Tenant boundary for multi-tenant data (future: resolved from auth/subdomain). */
export interface TenantRef {
  id: Uuid;
}

/** Sport discipline within a club (e.g. basketball, volleyball). */
export interface SportBranchRef {
  id: Uuid;
  tenantId: Uuid;
  code: string;
}

/** Age bracket used for grouping athletes (e.g. birth year range). */
export interface AgeGroupRef {
  id: Uuid;
  tenantId: Uuid;
  label: string;
}

/**
 * A cohort / training bucket (e.g. “2015 birth year group”).
 * Athletes may belong here without being on a competitive team.
 */
export interface GroupRef {
  id: Uuid;
  tenantId: Uuid;
  sportBranchId: Uuid;
  ageGroupId?: Uuid;
  name: string;
}

/**
 * A competitive or named squad within optional group context.
 * Teams and groups are distinct: one group may host several teams.
 */
export interface TeamRef {
  id: Uuid;
  tenantId: Uuid;
  sportBranchId: Uuid;
  groupId?: Uuid;
  name: string;
  code?: string;
}

export interface CoachRef {
  id: Uuid;
  tenantId: Uuid;
  firstName: string;
  lastName: string;
  preferredName?: string;
  sportBranchId: Uuid;
  phone?: string;
  email?: string;
  specialties?: string;
  isActive: boolean;
}

// —— Reporting & bulk operations (placeholders, not runtime logic) ——

/** Identifier for a report definition (versioned later). */
export type ReportDefinitionId = string;

export interface ReportDefinitionMeta {
  id: ReportDefinitionId;
  /** i18n key under reports.* */
  titleKey: string;
  /** Domains this report touches (for RBAC / navigation later). */
  domains: string[];
}

/** Saved filter preset for list or report contexts (export-ready lists). */
export interface SavedFilterPreset {
  id: Uuid;
  tenantId: Uuid;
  name: string;
  /** Opaque filter payload; validated per surface in later waves. */
  payload: Record<string, unknown>;
}

/** Bulk action kinds for future queue/worker execution. */
export type BulkActionKind =
  | 'EXPORT_CSV'
  | 'ARCHIVE'
  | 'ASSIGN_TAG'
  | 'CUSTOM';

export interface BulkActionRequest {
  id: Uuid;
  tenantId: Uuid;
  kind: BulkActionKind;
  targetEntity: string;
  /** Selected row ids or query snapshot ref — defined in later waves. */
  selection: Record<string, unknown>;
}

// —— Wave two: operational core (subset for clients; API is source of truth) ——

export type AthleteStatus = 'active' | 'paused' | 'inactive' | 'trial' | 'archived';

export interface AthleteSummary {
  id: Uuid;
  tenantId: Uuid;
  firstName: string;
  lastName: string;
  preferredName?: string;
  sportBranchId: Uuid;
  primaryGroupId?: Uuid;
  status: AthleteStatus;
}

export interface GuardianSummary {
  id: Uuid;
  tenantId: Uuid;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
}

export type TrainingSessionStatus = 'planned' | 'completed' | 'cancelled';

export interface TrainingSessionSummary {
  id: Uuid;
  tenantId: Uuid;
  title: string;
  sportBranchId: Uuid;
  groupId: Uuid;
  teamId?: Uuid;
  coachId?: Uuid;
  scheduledStart: string;
  scheduledEnd: string;
  status: TrainingSessionStatus;
}

export type AttendanceStatus = 'present' | 'absent' | 'excused' | 'late';

export type AthleteChargeStatus = 'pending' | 'partially_paid' | 'paid' | 'cancelled';

export interface PrivateLessonSummary {
  id: Uuid;
  tenantId: Uuid;
  athleteId: Uuid;
  coachId: Uuid;
  sportBranchId: Uuid;
  focus?: string;
  scheduledStart: string;
  scheduledEnd: string;
  location?: string;
  status: TrainingSessionStatus;
  attendanceStatus?: AttendanceStatus;
}

export interface ChargeItemSummary {
  id: Uuid;
  tenantId: Uuid;
  name: string;
  category: string;
  defaultAmount: string;
  currency: string;
  isActive: boolean;
}
