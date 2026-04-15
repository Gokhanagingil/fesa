import { createContext } from 'react';

export type TenantRow = {
  id: string;
  name: string;
  slug: string;
  role?: 'club_admin' | 'staff' | 'coach' | null;
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
