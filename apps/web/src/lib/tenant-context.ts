import { createContext } from 'react';
import type { TenantMembershipRole } from './auth-types';

export type TenantRow = {
  id: string;
  name: string;
  slug: string;
  role?: TenantMembershipRole | null;
  isDefault?: boolean;
};

export type TenantContextValue = {
  tenants: TenantRow[];
  tenantId: string | null;
  setTenantId: (id: string) => void;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export const TenantContext = createContext<TenantContextValue | null>(null);
