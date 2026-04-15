const STORAGE_KEY = 'amateur.tenantId';

export function getStoredTenantId(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setStoredTenantId(id: string): void {
  localStorage.setItem(STORAGE_KEY, id);
}

function headers(): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const tid = getStoredTenantId();
  if (tid) h['X-Tenant-Id'] = tid;
  return h;
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body.message === 'string') return body.message;
    if (Array.isArray(body?.message)) return body.message.join(', ');
  } catch {
    /* ignore */
  }
  return res.statusText || 'Request failed';
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: headers(), credentials: 'include' });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(body),
    credentials: 'include',
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<T>;
}

export async function apiPatchNoBody<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: 'PATCH', headers: headers(), credentials: 'include' });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<T>;
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(path, { method: 'DELETE', headers: headers(), credentials: 'include' });
  if (!res.ok) throw new Error(await parseError(res));
}
