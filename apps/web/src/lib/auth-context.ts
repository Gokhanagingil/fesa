import { createContext, useContext } from 'react';
import type { StaffAuthSummary, StaffLoginRequest } from './auth-types';

export type AuthContextValue = {
  session: StaffAuthSummary | null;
  user: StaffAuthSummary['user'] | null;
  staffUser: StaffAuthSummary['user'] | null;
  memberships: StaffAuthSummary['availableTenants'];
  loading: boolean;
  isAuthenticated: boolean;
  authenticated: boolean;
  canAccessCrossTenant: boolean;
  login: (payload: StaffLoginRequest) => Promise<StaffAuthSummary>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setSession: (session: StaffAuthSummary | null) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
