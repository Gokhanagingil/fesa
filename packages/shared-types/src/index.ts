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

// —— Reporting Foundation v1 (Executive Demo & Reporting Foundation Pack) ——

/**
 * Logical reporting domains exposed in the Reportable Field Catalog.
 * Each entity is a base for advanced filtering, exports, and Report Builder v1.
 */
export type ReportEntityKey =
  | 'athletes'
  | 'guardians'
  | 'private_lessons'
  | 'finance_charges'
  | 'training_sessions';

/** Field data types supported by the universal filter grammar. */
export type ReportFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'enum'
  | 'uuid'
  | 'currency';

/** Operators supported by the universal filter grammar. */
export type ReportFilterOperator =
  | 'is'
  | 'isNot'
  | 'in'
  | 'notIn'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'isEmpty'
  | 'isNotEmpty'
  | 'exists'
  | 'notExists';

/** Field option (for enums) the UI can render in selects. */
export interface ReportFieldOption {
  value: string;
  /** i18n key for display label (frontend resolves). */
  labelKey?: string;
  /** Literal label fallback when no i18n key applies. */
  label?: string;
}

/**
 * Metadata describing one reportable/filterable field.
 * The catalog is metadata-driven so that new fields can be registered in one place.
 */
export interface ReportFieldDefinition {
  /** Stable dotted key, e.g. "athlete.firstName" or "guardians.exists". */
  key: string;
  /** Logical entity this field belongs to. */
  entity: ReportEntityKey;
  /** i18n key under reports.fields.* preferred. */
  labelKey: string;
  /** Optional shorter label fallback. */
  label?: string;
  type: ReportFieldType;
  /** Operators supported in the filter UI. */
  operators: ReportFilterOperator[];
  /** Whether this column may appear in the column picker. */
  selectable?: boolean;
  /** Whether sorting is permitted on this field. */
  sortable?: boolean;
  /** Whether the field is safe to include in CSV export. */
  exportable?: boolean;
  /** Whether the field participates in quick-search. */
  quickSearch?: boolean;
  /** Enum value choices for select-style operators. */
  options?: ReportFieldOption[];
  /** Currency suffix hint for currency fields. */
  currency?: string;
  /** Indicates the field is a relation existence check (operators must be exists/notExists). */
  relationCheck?: boolean;
  /** Optional description for tooltip / hint text in the UI. */
  hintKey?: string;
  /**
   * v2: Whether this field can be used as a `groupBy` dimension by the lightweight
   * aggregation compiler. Only meaningful for short, low-cardinality dimensions
   * (status, gender, group name, coach, etc.).
   */
  groupable?: boolean;
  /**
   * v2: Aggregations supported on this field as a measure. `count` is implicit on
   * the base entity and never needs to be listed here; this whitelists numeric/
   * currency fields like `athlete.outstandingTotal` for `sum` / `avg` use.
   */
  aggregations?: ReportAggregateOp[];
}

/** Catalog snapshot for an entity. */
export interface ReportCatalogEntity {
  key: ReportEntityKey;
  /** i18n key under reports.entities.* */
  labelKey: string;
  /** Default columns rendered when the explorer first opens. */
  defaultColumns: string[];
  /** Default sort clause applied when the explorer first opens. */
  defaultSort?: ReportSortClause;
  /** Soft cap on rows the export endpoint will include. */
  exportRowLimit: number;
  fields: ReportFieldDefinition[];
}

export interface ReportCatalogResponse {
  entities: ReportCatalogEntity[];
}

/** Filter tree leaf — a single condition. */
export interface ReportFilterCondition {
  type: 'condition';
  /** Field catalog key. */
  field: string;
  operator: ReportFilterOperator;
  /** Value depends on operator: string|number|boolean|null|array|tuple. */
  value?: unknown;
}

/** Filter tree group — recursively combines children. */
export interface ReportFilterGroup {
  type: 'group';
  combinator: 'and' | 'or';
  /**
   * If true, the whole group is negated (NOT(...)); useful for "athletes NOT in team A"
   * combined with other conditions inside.
   */
  not?: boolean;
  children: ReportFilterNode[];
}

export type ReportFilterNode = ReportFilterCondition | ReportFilterGroup;

export interface ReportSortClause {
  /** Field catalog key. */
  field: string;
  direction: 'asc' | 'desc';
}

/** Universal query payload sent to /api/reporting/run and /api/reporting/export. */
export interface ReportRunRequest {
  entity: ReportEntityKey;
  /** Optional quick-search applied to fields marked quickSearch. */
  search?: string;
  filter?: ReportFilterNode;
  /** Selected columns; defaults to entity.defaultColumns. */
  columns?: string[];
  sort?: ReportSortClause[];
  limit?: number;
  offset?: number;
  /**
   * v2: when present, the run/export endpoint returns grouped/aggregated rows
   * instead of raw rows. The `columns` and `sort` clauses are ignored in that
   * case (the dimension + measures define the response shape).
   */
  groupBy?: ReportGroupBy;
}

/**
 * v2: aggregate operators supported by the lightweight grouping engine. We
 * intentionally keep this list small so the product does not turn into a full
 * pivot-table BI tool. `count` is the implicit row count of the base entity.
 */
export type ReportAggregateOp = 'count' | 'sum' | 'avg' | 'min' | 'max';

/**
 * v2: a single measure requested in a grouped report. `field` is omitted only
 * for `op = 'count'`. Each measure produces one column in the response.
 */
export interface ReportAggregateMeasure {
  op: ReportAggregateOp;
  /** Field key from the catalog (omit for plain `count`). */
  field?: string;
  /** Optional caller-provided alias used as the response column key. */
  alias?: string;
}

/**
 * v2: optional grouping payload added to ReportRunRequest. Lightweight on
 * purpose: a single dimension, a small set of measures, and an optional
 * direction-only sort by alias.
 */
export interface ReportGroupBy {
  /** One groupable field key (must have `groupable: true` in the catalog). */
  field: string;
  /** Measures to compute. `count` is added automatically if list is empty. */
  measures: ReportAggregateMeasure[];
  /** Sort by one alias (a measure alias, or the dimension key); defaults to count desc. */
  sort?: { alias: string; direction: 'asc' | 'desc' };
  /** Hard cap on returned groups (defaults to 50, max 200). */
  limit?: number;
}

/** A single row returned by /api/reporting/run; values are primitives or null. */
export type ReportRunRow = Record<string, string | number | boolean | null>;

export interface ReportRunResponse {
  entity: ReportEntityKey;
  total: number;
  limit: number;
  offset: number;
  columns: string[];
  rows: ReportRunRow[];
  /** v2: included when the request used `groupBy`. Mirrors the request. */
  groupBy?: ReportGroupBy;
  /** v2: column descriptors for grouped responses (label keys for headers). */
  columnLabels?: Array<{ key: string; labelKey?: string; label?: string; isMeasure?: boolean }>;
}

/**
 * v2: a curated, ready-made starter report that is shipped with the platform
 * and surfaced in the Report Builder so the experience is never empty. Each
 * starter view is deterministic, tenant-safe, and uses only catalog-supported
 * filters / fields.
 */
export interface StarterReportView {
  /** Stable id, e.g. "athletes.activeWithoutTeam". */
  id: string;
  entity: ReportEntityKey;
  /** i18n key under reports.starter.<id>.title. */
  titleKey: string;
  /** i18n key under reports.starter.<id>.description. */
  descriptionKey: string;
  /** i18n key under reports.starter.categories.<value> for grouping in the UI. */
  categoryKey: string;
  /** Short marketing-friendly category string (en label fallback). */
  category: string;
  filter: ReportFilterNode | null;
  columns: string[];
  sort: ReportSortClause[];
  search?: string | null;
  /** v2: optional grouped/aggregate definition for "management pack" starter reports. */
  groupBy?: ReportGroupBy;
  /** Whether the catalog suggests this for the management/executive pack on Reports page. */
  managementPack?: boolean;
}

export interface StarterReportListResponse {
  items: StarterReportView[];
}

/** Saved view / report definition persisted per tenant. */
export interface SavedReportView {
  id: Uuid;
  tenantId: Uuid;
  /** Logical entity the view targets. */
  entity: ReportEntityKey;
  name: string;
  description?: string | null;
  filter: ReportFilterNode | null;
  columns: string[];
  sort: ReportSortClause[];
  search?: string | null;
  /** "private" = owner only, "shared" = visible to all club staff. */
  visibility: 'private' | 'shared';
  ownerStaffUserId?: string | null;
  ownerName?: string | null;
  createdAt: string;
  updatedAt: string;
  /** v2: lightweight group/aggregate definition (when present, view is grouped). */
  groupBy?: ReportGroupBy | null;
  /** v2: optional starter-view id that this saved view was forked from. */
  derivedFromStarterId?: string | null;
}

export interface SavedReportViewListResponse {
  items: SavedReportView[];
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
