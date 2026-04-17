/**
 * Frontend mirror of the API reporting types from @amateur/shared-types.
 *
 * We duplicate a small subset here (instead of importing the package) to avoid
 * pulling the shared-types build pipeline into the Vite client at this stage.
 * Field names and shapes must stay in sync with packages/shared-types/src/index.ts.
 */

export type ReportEntityKey = 'athletes' | 'guardians' | 'private_lessons' | 'finance_charges';

export type ReportFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'enum'
  | 'uuid'
  | 'currency';

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

export interface ReportFieldOption {
  value: string;
  labelKey?: string;
  label?: string;
}

export interface ReportFieldDefinition {
  key: string;
  entity: ReportEntityKey;
  labelKey: string;
  label?: string;
  type: ReportFieldType;
  operators: ReportFilterOperator[];
  selectable?: boolean;
  sortable?: boolean;
  exportable?: boolean;
  quickSearch?: boolean;
  options?: ReportFieldOption[];
  currency?: string;
  relationCheck?: boolean;
  hintKey?: string;
  groupable?: boolean;
  aggregations?: ReportAggregateOp[];
}

export type ReportAggregateOp = 'count' | 'sum' | 'avg' | 'min' | 'max';

export interface ReportAggregateMeasure {
  op: ReportAggregateOp;
  field?: string;
  alias?: string;
}

export interface ReportGroupBy {
  field: string;
  measures: ReportAggregateMeasure[];
  sort?: { alias: string; direction: 'asc' | 'desc' };
  limit?: number;
}

export interface ReportSortClause {
  field: string;
  direction: 'asc' | 'desc';
}

export interface ReportCatalogEntity {
  key: ReportEntityKey;
  labelKey: string;
  defaultColumns: string[];
  defaultSort?: ReportSortClause;
  exportRowLimit: number;
  fields: ReportFieldDefinition[];
}

export interface ReportCatalogResponse {
  entities: ReportCatalogEntity[];
}

export interface ReportFilterCondition {
  type: 'condition';
  field: string;
  operator: ReportFilterOperator;
  value?: unknown;
}

export interface ReportFilterGroup {
  type: 'group';
  combinator: 'and' | 'or';
  not?: boolean;
  children: ReportFilterNode[];
}

export type ReportFilterNode = ReportFilterCondition | ReportFilterGroup;

export interface ReportRunRequest {
  entity: ReportEntityKey;
  search?: string;
  filter?: ReportFilterNode | null;
  columns?: string[];
  sort?: ReportSortClause[];
  limit?: number;
  offset?: number;
  groupBy?: ReportGroupBy;
}

export type ReportRunRow = Record<string, string | number | boolean | null>;

export interface ReportRunResponse {
  entity: ReportEntityKey;
  total: number;
  limit: number;
  offset: number;
  columns: string[];
  rows: ReportRunRow[];
  groupBy?: ReportGroupBy;
  columnLabels?: Array<{ key: string; labelKey?: string; label?: string; isMeasure?: boolean }>;
}

export interface StarterReportView {
  id: string;
  entity: ReportEntityKey;
  titleKey: string;
  descriptionKey: string;
  categoryKey: string;
  category: string;
  filter: ReportFilterNode | null;
  columns: string[];
  sort: ReportSortClause[];
  search?: string | null;
  groupBy?: ReportGroupBy;
  managementPack?: boolean;
}

export interface StarterReportListResponse {
  items: StarterReportView[];
}

export interface SavedReportView {
  id: string;
  tenantId: string;
  entity: ReportEntityKey;
  name: string;
  description?: string | null;
  filter: ReportFilterNode | null;
  columns: string[];
  sort: ReportSortClause[];
  search?: string | null;
  visibility: 'private' | 'shared';
  ownerStaffUserId?: string | null;
  ownerName?: string | null;
  createdAt: string;
  updatedAt: string;
  groupBy?: ReportGroupBy | null;
  derivedFromStarterId?: string | null;
}

export interface SavedReportViewListResponse {
  items: SavedReportView[];
}

export function emptyGroup(combinator: 'and' | 'or' = 'and'): ReportFilterGroup {
  return { type: 'group', combinator, children: [] };
}

export function isFilterEmpty(node: ReportFilterNode | null | undefined): boolean {
  if (!node) return true;
  if (node.type === 'condition') return false;
  return node.children.length === 0;
}
