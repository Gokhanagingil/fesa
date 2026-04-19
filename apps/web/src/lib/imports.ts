import { apiGet, apiPost } from './api';

export type ImportEntityKey = 'athletes' | 'guardians' | 'athlete_guardians' | 'groups';

export type ImportFieldType = 'string' | 'enum' | 'date' | 'email' | 'phone' | 'boolean';

export interface ImportFieldDefinition {
  key: string;
  labelKey: string;
  required: boolean;
  aliases: string[];
  type: ImportFieldType;
  maxLength?: number;
  enumValues?: string[];
  hintKey?: string;
}

export interface ImportEntityDefinition {
  entity: ImportEntityKey;
  labelKey: string;
  descriptionKey: string;
  sample: Array<Record<string, string>>;
  fields: ImportFieldDefinition[];
}

export type ImportIssueSeverity = 'error' | 'warning' | 'info';

export interface ImportRowIssue {
  field?: string;
  severity: ImportIssueSeverity;
  message: string;
}

export type ImportRowOutcome = 'create' | 'update' | 'skip' | 'reject';

export interface ImportRowReport {
  rowNumber: number;
  outcome: ImportRowOutcome;
  resolved: Record<string, string | boolean | null>;
  displayLabel: string;
  issues: ImportRowIssue[];
}

export interface ImportSummaryCounts {
  total: number;
  createReady: number;
  updateReady: number;
  skipReady: number;
  rejected: number;
  warnings: number;
}

export interface ImportPreviewReport {
  entity: ImportEntityKey;
  counts: ImportSummaryCounts;
  rows: ImportRowReport[];
  missingRequired: Array<{ field: string; rowCount: number }>;
  canCommit: boolean;
  hints: string[];
}

export interface ImportCommitReport {
  entity: ImportEntityKey;
  counts: ImportSummaryCounts & {
    created: number;
    updated: number;
    skipped: number;
  };
  rows: ImportRowReport[];
  durationMs: number;
}

export interface ImportPreviewPayload {
  entity: ImportEntityKey;
  columnMapping: Record<string, string>;
  rows: Array<{ rowNumber: number; cells: Record<string, string> }>;
  defaultSportBranchId?: string;
}

export async function fetchImportDefinitions(): Promise<ImportEntityDefinition[]> {
  const res = await apiGet<{ items: ImportEntityDefinition[] }>('/api/imports/definitions');
  return res.items;
}

export async function previewImport(payload: ImportPreviewPayload): Promise<ImportPreviewReport> {
  return apiPost<ImportPreviewReport>('/api/imports/preview', payload);
}

export async function commitImport(payload: ImportPreviewPayload): Promise<ImportCommitReport> {
  return apiPost<ImportCommitReport>('/api/imports/commit', payload);
}

export function buildTemplateUrl(entity: ImportEntityKey): string {
  return `/api/imports/template?entity=${entity}`;
}

/**
 * Lightweight CSV parser. Handles quoted fields, escaped quotes, CRLF, and
 * trailing newlines. Returns the header row and an array of row objects keyed
 * by header. Rejects files with no header row.
 */
export function parseCsv(input: string): {
  headers: string[];
  rows: Array<{ rowNumber: number; cells: Record<string, string> }>;
} {
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const fields: string[][] = [];
  let current: string[] = [];
  let buffer = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          buffer += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        buffer += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      current.push(buffer);
      buffer = '';
      continue;
    }
    if (ch === '\n') {
      current.push(buffer);
      buffer = '';
      fields.push(current);
      current = [];
      continue;
    }
    buffer += ch;
  }
  if (buffer.length > 0 || current.length > 0) {
    current.push(buffer);
    fields.push(current);
  }
  const cleanedRows = fields.filter((row) => row.some((cell) => cell.trim() !== ''));
  if (cleanedRows.length === 0) {
    return { headers: [], rows: [] };
  }
  const headers = cleanedRows[0].map((header) => header.trim());
  const rows: Array<{ rowNumber: number; cells: Record<string, string> }> = [];
  for (let r = 1; r < cleanedRows.length; r += 1) {
    const row = cleanedRows[r];
    const cells: Record<string, string> = {};
    for (let c = 0; c < headers.length; c += 1) {
      const value = row[c] ?? '';
      cells[headers[c]] = value.trim();
    }
    rows.push({ rowNumber: r + 1, cells });
  }
  return { headers, rows };
}

/**
 * Auto-detect a column → field mapping using both literal name match and the
 * declared aliases on each field. Falls back to "ignore" when no field claims
 * the column.
 */
export function autoMapColumns(
  headers: string[],
  fields: ImportFieldDefinition[],
): { mapping: Record<string, string>; auto: Set<string> } {
  const mapping: Record<string, string> = {};
  const auto = new Set<string>();
  const usedTargets = new Set<string>();
  for (const header of headers) {
    const lowered = header.toLowerCase().trim();
    if (!lowered) continue;
    for (const field of fields) {
      if (usedTargets.has(field.key)) continue;
      const matches =
        field.key.toLowerCase() === lowered ||
        field.aliases.some((alias) => alias.toLowerCase() === lowered);
      if (matches) {
        mapping[header] = field.key;
        usedTargets.add(field.key);
        auto.add(header);
        break;
      }
    }
  }
  return { mapping, auto };
}

/**
 * Render a CSV string from a header row and an array of row objects keyed by
 * the same header. Returns a UTF-8 BOM-prefixed string so Excel handles
 * Turkish characters cleanly.
 */
export function renderCsvFromRows(
  headers: string[],
  rows: Array<Record<string, unknown>>,
): string {
  const lines = [csvRow(headers)];
  for (const row of rows) {
    lines.push(csvRow(headers.map((header) => formatCell(row[header]))));
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/**
 * Lightweight, per-tenant import history. Stored in localStorage so staff can
 * see "what we last brought in" without us having to operate a server-side
 * audit log just yet. Capped to the most recent entries to keep storage
 * tiny and predictable.
 */
export interface ImportHistoryEntry {
  id: string;
  entity: ImportEntityKey;
  /** ISO timestamp of the commit. */
  committedAt: string;
  filename?: string;
  counts: {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    rejected: number;
  };
  /** Human-readable label, typically the source filename or "Pasted CSV". */
  source: string;
}

const HISTORY_LIMIT = 10;
const HISTORY_PREFIX = 'amateur.imports.history';

function historyKey(tenantId: string): string {
  return `${HISTORY_PREFIX}.${tenantId}`;
}

export function loadImportHistory(tenantId: string | null | undefined): ImportHistoryEntry[] {
  if (!tenantId || typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(historyKey(tenantId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is ImportHistoryEntry => {
      return (
        !!entry &&
        typeof entry === 'object' &&
        typeof (entry as ImportHistoryEntry).id === 'string' &&
        typeof (entry as ImportHistoryEntry).entity === 'string' &&
        typeof (entry as ImportHistoryEntry).committedAt === 'string' &&
        typeof (entry as ImportHistoryEntry).counts === 'object'
      );
    });
  } catch {
    return [];
  }
}

export function recordImportHistory(
  tenantId: string | null | undefined,
  entry: Omit<ImportHistoryEntry, 'id' | 'committedAt'> & { committedAt?: string },
): ImportHistoryEntry[] {
  if (!tenantId || typeof window === 'undefined') return [];
  const next: ImportHistoryEntry = {
    ...entry,
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    committedAt: entry.committedAt ?? new Date().toISOString(),
  };
  const existing = loadImportHistory(tenantId);
  const combined = [next, ...existing].slice(0, HISTORY_LIMIT);
  try {
    window.localStorage.setItem(historyKey(tenantId), JSON.stringify(combined));
  } catch {
    // localStorage may be unavailable / full — silently drop.
  }
  return combined;
}

export function clearImportHistory(tenantId: string | null | undefined): void {
  if (!tenantId || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(historyKey(tenantId));
  } catch {
    // ignore
  }
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function csvRow(values: Array<string | null | undefined>): string {
  return values.map((value) => formatCell(value)).join(',');
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
