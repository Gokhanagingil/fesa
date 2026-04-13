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
