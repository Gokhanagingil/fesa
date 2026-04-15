export type PlatformOverviewResponse = {
  items: Array<{
    id: string;
    name: string;
    slug: string;
    counts: {
      athletes: number;
      guardians: number;
      coaches: number;
      groups: number;
      teams: number;
    };
  }>;
  total: number;
};

export type ClubOverviewResponse = {
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
  accessRole: 'global_admin' | 'club_admin' | 'staff' | 'coach' | null;
  counts: {
    athletes: number;
    guardians: number;
    coaches: number;
    groups: number;
    teams: number;
    portalAccess: number;
  };
};
