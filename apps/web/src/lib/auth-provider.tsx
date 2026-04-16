import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiGet, apiPost } from './api';
import { AuthContext } from './auth-context';
import type { StaffAuthSummary, StaffLoginRequest } from './auth-types';

const SESSION_BOOTSTRAP_FAILED = 'SESSION_BOOTSTRAP_FAILED';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StaffAuthSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await apiGet<StaffAuthSummary>('/api/auth/me');
      setSession(next);
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (payload: StaffLoginRequest) => {
      const loginResult = await apiPost<StaffAuthSummary>('/api/auth/login', payload);
      setSession(loginResult);
      try {
        const verified = await apiGet<StaffAuthSummary>('/api/auth/me');
        setSession(verified);
        return verified;
      } catch {
        return loginResult;
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await apiPost('/api/auth/logout', {});
    } finally {
      setSession(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      staffUser: session?.user ?? null,
      memberships: session?.memberships ?? [],
      loading,
      isAuthenticated: Boolean(session),
      authenticated: Boolean(session),
      canAccessCrossTenant: session?.user.platformRole === 'global_admin',
      login,
      logout,
      refresh,
      setSession,
    }),
    [loading, login, logout, refresh, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { SESSION_BOOTSTRAP_FAILED };
