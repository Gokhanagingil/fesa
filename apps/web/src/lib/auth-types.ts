export type StaffPlatformRole = 'global_admin' | 'standard';

export type TenantMembershipRole = 'club_admin' | 'staff' | 'coach';

export type StaffUserStatus = 'active' | 'disabled';

export type StaffSessionTenant = {
  id: string;
  name: string;
  slug: string;
  role: TenantMembershipRole;
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
  availableTenants: StaffSessionTenant[];
  activeTenantId: string | null;
};

export type StaffLoginRequest = {
  email: string;
  password: string;
};

export type StaffAuthSummary = StaffSession;
