const STORAGE_KEY = 'amateur.tenantId';

export class ApiError extends Error {
  /**
   * Parent Access Stabilization Pass — calm error codes.
   *
   * Some endpoints (notably the guardian-portal activation flow) tag
   * their errors with a stable string `code` so the UI can pick warmer
   * copy (e.g. "your invite link expired" vs "your invite link does not
   * match anything on file"). The legacy `message` path is still the
   * default.
   */
  public readonly code: string | null;

  constructor(
    public readonly status: number,
    message: string,
    code?: string | null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code ?? null;
  }
}

export function getStoredTenantId(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setStoredTenantId(id: string): void {
  localStorage.setItem(STORAGE_KEY, id);
}

export function clearStoredTenantId(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function headers(): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const tid = getStoredTenantId();
  if (tid) h['X-Tenant-Id'] = tid;
  return h;
}

type ParsedError = { message: string; code: string | null };

async function parseError(res: Response): Promise<ParsedError> {
  try {
    const body = await res.json();
    let nested: unknown = body?.message;
    let code: string | null = typeof body?.code === 'string' ? body.code : null;
    // Nest's UnauthorizedException({ message, code }) puts the object on
    // body.message — unwrap that so the UI can route on `.code`.
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const inner = nested as { message?: unknown; code?: unknown };
      if (typeof inner.code === 'string') code = inner.code;
      if (typeof inner.message === 'string') nested = inner.message;
    }
    if (typeof nested === 'string') return { message: nested, code };
    if (Array.isArray(nested)) return { message: nested.join(', '), code };
  } catch {
    /* ignore */
  }
  return { message: res.statusText || 'Request failed', code: null };
}

async function assertOk(res: Response): Promise<void> {
  if (!res.ok) {
    const parsed = await parseError(res);
    throw new ApiError(res.status, parsed.message, parsed.code);
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: headers(), credentials: 'include' });
  await assertOk(res);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
    credentials: 'include',
  });
  await assertOk(res);
  return res.json() as Promise<T>;
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(body),
    credentials: 'include',
  });
  await assertOk(res);
  return res.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(body),
    credentials: 'include',
  });
  await assertOk(res);
  return res.json() as Promise<T>;
}

export async function apiPatchNoBody<T>(path: string): Promise<T> {
  const res = await fetch(path, { method: 'PATCH', headers: headers(), credentials: 'include' });
  await assertOk(res);
  return res.json() as Promise<T>;
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(path, { method: 'DELETE', headers: headers(), credentials: 'include' });
  await assertOk(res);
}
