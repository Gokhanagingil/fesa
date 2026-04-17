import type { ReportRunResponse } from '@amateur/shared-types';

/**
 * Renders a ReportRunResponse as a CSV string with a UTF-8 BOM so Excel
 * picks up Turkish characters out of the box.
 */
export function renderCsv(response: ReportRunResponse, headerLabels: Record<string, string>): string {
  const headers = response.columns.map((key) => headerLabels[key] ?? key);
  const lines = [csvRow(headers)];
  for (const row of response.rows) {
    lines.push(csvRow(response.columns.map((key) => formatCell(row[key]))));
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

function csvRow(values: Array<string | number | boolean | null | undefined>): string {
  return values.map(escapeCsv).join(',');
}

function escapeCsv(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'string' ? value : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}
