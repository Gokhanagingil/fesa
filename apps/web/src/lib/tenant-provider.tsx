import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiGet, getStoredTenantId, setStoredTenantId } from './api';
import { TenantContext, type TenantRow } from './tenant-context';
import { useAuth } from './auth-context';

/** Matches demo seed slug (`npm run seed:demo`) so first-run picks the curated tenant when present. */
const PREFERRED_DEMO_TENANT_SLUG = 'kadikoy-genc-spor';

export function TenantProvider({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [tenantId, setTenantIdState] = useState<string | null>(getStoredTenantId());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (authLoading) {
      return;
    }
    if (!session) {
      setTenants([]);
      setTenantIdState(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await apiGet<TenantRow[]>('/api/tenants');
      setTenants(list);
      const stored = getStoredTenantId();
      if (stored && list.some((t) => t.id === stored)) {
        setTenantIdState(stored);
      } else if (list.length > 0) {
        const sessionDefault = session?.defaultTenantId
          ? list.find((tenant) => tenant.id === session.defaultTenantId)
          : null;
        const explicitDefault = list.find((tenant) => tenant.isDefault);
        const preferred = list.find((tenant) => tenant.slug === PREFERRED_DEMO_TENANT_SLUG);
        const next = sessionDefault?.id ?? explicitDefault?.id ?? preferred?.id ?? list[0].id;
        setStoredTenantId(next);
        setTenantIdState(next);
      } else {
        setTenantIdState(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  }, [authLoading, session]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setTenantId = useCallback((id: string) => {
    setStoredTenantId(id);
    setTenantIdState(id);
  }, []);

  const value = useMemo(
    () => ({ tenants, tenantId, setTenantId, loading, error, refresh }),
    [tenants, tenantId, setTenantId, loading, error, refresh],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}
