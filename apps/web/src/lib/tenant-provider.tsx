import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  apiGet,
  clearStoredTenantId,
  getStoredTenantId,
  setStoredTenantId,
} from './api';
import { TenantContext, type TenantRow } from './tenant-context';
import { useAuth } from './auth-context';
import type { StaffAuthSummary } from './auth-types';

/** Matches demo seed slug (`npm run seed:demo`) so first-run picks the curated tenant when present. */
const PREFERRED_DEMO_TENANT_SLUG = 'kadikoy-genc-spor';

export function TenantProvider({ children }: { children: ReactNode }) {
  const { session, loading: authLoading } = useAuth();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [tenantId, setTenantIdState] = useState<string | null>(getStoredTenantId());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mapSessionTenants = useCallback(
    (currentSession: StaffAuthSummary | null): TenantRow[] =>
      currentSession?.accessibleTenants.map((tenant) => ({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        role: tenant.role,
        isDefault: tenant.isDefault,
      })) ?? [],
    [],
  );

  const reconcileTenantId = useCallback(
    (list: TenantRow[], preferredTenantId?: string | null) => {
      const stored = getStoredTenantId();
      if (stored && list.some((tenant) => tenant.id === stored)) {
        return stored;
      }
      if (preferredTenantId && list.some((tenant) => tenant.id === preferredTenantId)) {
        return preferredTenantId;
      }

      const explicitDefault = list.find((tenant) => tenant.isDefault);
      if (explicitDefault) {
        return explicitDefault.id;
      }

      const preferredDemo = list.find((tenant) => tenant.slug === PREFERRED_DEMO_TENANT_SLUG);
      return preferredDemo?.id ?? list[0]?.id ?? null;
    },
    [],
  );

  const applyTenantState = useCallback(
    (list: TenantRow[], preferredTenantId?: string | null) => {
      setTenants(list);
      const nextTenantId = reconcileTenantId(list, preferredTenantId);
      if (nextTenantId) {
        setStoredTenantId(nextTenantId);
        setTenantIdState(nextTenantId);
      } else {
        clearStoredTenantId();
        setTenantIdState(null);
      }
    },
    [reconcileTenantId],
  );

  const refresh = useCallback(async () => {
    if (authLoading) {
      return;
    }
    if (!session) {
      setTenants([]);
      setTenantIdState(null);
      clearStoredTenantId();
      setLoading(false);
      setError(null);
      return;
    }

    const fallbackTenants = mapSessionTenants(session);
    applyTenantState(fallbackTenants, session.defaultTenantId);
    setLoading(true);
    setError(null);
    try {
      const list = await apiGet<TenantRow[]>('/api/tenants');
      applyTenantState(list, session.defaultTenantId);
    } catch (e) {
      if (fallbackTenants.length === 0) {
        applyTenantState([], null);
      }
      setError(e instanceof Error ? e.message : 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  }, [applyTenantState, authLoading, mapSessionTenants, session]);

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
