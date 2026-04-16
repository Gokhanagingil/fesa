export type PlatformOverviewResponse = {
  items: Array<{
    id: string;
    name: string;
    slug: string;
    membershipRole: 'global_admin' | 'club_admin' | 'staff' | 'coach' | null;
    counts: {
      athletes: number;
      guardians: number;
      coaches: number;
      groups: number;
      teams: number;
      unreadActions: number;
      overdueActions: number;
      followUpActions: number;
    };
    actionCenter: {
      counts: {
        total: number;
        unread: number;
        overdue: number;
        today: number;
      };
      topCategories: Array<{
        category: 'finance' | 'family' | 'readiness' | 'private_lessons' | 'training';
        count: number;
      }>;
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
