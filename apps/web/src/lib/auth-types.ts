export type StaffPlatformRole = 'global_admin' | 'standard';

export type TenantMembershipRole = 'club_admin' | 'staff' | 'coach';

export type StaffUserStatus = 'active' | 'disabled';

export type StaffSessionMembership = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: TenantMembershipRole;
  isDefault: boolean;
};

export type StaffSessionTenantAccess = {
  id: string;
  name: string;
  slug: string;
  role: TenantMembershipRole | null;
  isDefault: boolean;
};

export type StaffSessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  platformRole: StaffPlatformRole;
  status: StaffUserStatus;
};

export type StaffSession = {
  user: StaffSessionUser;
  memberships: StaffSessionMembership[];
  accessibleTenants: StaffSessionTenantAccess[];
  defaultTenantId: string | null;
};

export type StaffLoginRequest = {
  email: string;
  password: string;
};

export type StaffAuthSummary = StaffSession;
