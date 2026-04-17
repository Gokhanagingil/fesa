import { apiDelete, apiGet, apiPatch, apiPost } from './api';
import type {
  ReportCatalogResponse,
  ReportEntityKey,
  ReportRunRequest,
  ReportRunResponse,
  SavedReportView,
  SavedReportViewListResponse,
  StarterReportListResponse,
  StarterReportView,
} from './reporting-types';

let catalogCache: ReportCatalogResponse | null = null;

export async function fetchCatalog(force = false): Promise<ReportCatalogResponse> {
  if (catalogCache && !force) return catalogCache;
  catalogCache = await apiGet<ReportCatalogResponse>('/api/reporting/catalog');
  return catalogCache;
}

export function resetCatalogCache() {
  catalogCache = null;
}

export function runReport(request: ReportRunRequest): Promise<ReportRunResponse> {
  return apiPost<ReportRunResponse>('/api/reporting/run', request);
}

export async function exportReportCsv(request: ReportRunRequest, fileName?: string): Promise<void> {
  const tenantId = localStorage.getItem('amateur.tenantId');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (tenantId) headers['X-Tenant-Id'] = tenantId;

  const res = await fetch('/api/reporting/export', {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
    credentials: 'include',
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (typeof body?.message === 'string') message = body.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || `amateur-${request.entity}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function listSavedViews(entity?: ReportEntityKey): Promise<SavedReportViewListResponse> {
  const path = entity ? `/api/reporting/saved-views?entity=${entity}` : '/api/reporting/saved-views';
  return apiGet<SavedReportViewListResponse>(path);
}

export function createSavedView(input: Partial<SavedReportView> & { entity: ReportEntityKey; name: string }) {
  return apiPost<SavedReportView>('/api/reporting/saved-views', input);
}

export function updateSavedView(id: string, input: Partial<SavedReportView>) {
  return apiPatch<SavedReportView>(`/api/reporting/saved-views/${id}`, input);
}

export function deleteSavedView(id: string) {
  return apiDelete(`/api/reporting/saved-views/${id}`);
}

let starterCache: StarterReportView[] | null = null;
export async function fetchStarterViews(force = false): Promise<StarterReportView[]> {
  if (starterCache && !force) return starterCache;
  const res = await apiGet<StarterReportListResponse>('/api/reporting/starter-views');
  starterCache = res.items;
  return starterCache;
}

export function fetchStarterView(id: string): Promise<StarterReportView> {
  return apiGet<StarterReportView>(`/api/reporting/starter-views/${id}`);
}
