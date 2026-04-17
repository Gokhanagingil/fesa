import type {
  ReportEntityKey,
  ReportFilterNode,
  ReportGroupBy,
  ReportSortClause,
} from './reporting-types';

/**
 * Encodes an explorer initial state into a URL-friendly base64 payload that
 * the Report Builder page hydrates from `?preset=...`.
 *
 * This is the canonical mechanism for dashboard cards / action chips to drop
 * the user into a meaningful, pre-filtered report — no ad hoc URL hacks.
 */
export type DeepLinkPreset = {
  entity: ReportEntityKey;
  filter?: ReportFilterNode | null;
  columns?: string[];
  sort?: ReportSortClause[];
  search?: string | null;
  groupBy?: ReportGroupBy | null;
  contextLabel?: string;
};

export function buildReportBuilderLink(preset: DeepLinkPreset): string {
  const json = JSON.stringify(preset);
  // base64 with unicode safety
  const encoded = window.btoa(unescape(encodeURIComponent(json)));
  return `/app/report-builder?preset=${encodeURIComponent(encoded)}`;
}

export function buildStarterLink(starterId: string): string {
  return `/app/report-builder?starter=${encodeURIComponent(starterId)}`;
}
