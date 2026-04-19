import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportsPage } from './ReportsPage';
import { renderWithRoute } from '../test/test-utils';
import type {
  CommandCenterResponse,
  ReportingDefinitionsResponse,
} from '../lib/domain-types';
import type { SavedReportViewListResponse } from '../lib/reporting-types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockUseTenant = vi.fn();
vi.mock('../lib/tenant-hooks', () => ({
  useTenant: () => mockUseTenant(),
}));

const mockListSavedViews = vi.fn();
const mockFetchStarterViews = vi.fn();
vi.mock('../lib/reporting-client', async () => {
  const actual = await vi.importActual<typeof import('../lib/reporting-client')>('../lib/reporting-client');
  return {
    ...actual,
    listSavedViews: (...args: Parameters<typeof actual.listSavedViews>) => mockListSavedViews(...args),
    fetchStarterViews: (...args: Parameters<typeof actual.fetchStarterViews>) => mockFetchStarterViews(...args),
  };
});

const mockApiGet = vi.fn();
vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    apiGet: (...args: Parameters<typeof actual.apiGet>) => mockApiGet(...args),
  };
});

function makeDefinitions(): ReportingDefinitionsResponse {
  return {
    items: [
      {
        key: 'collections-overview',
        titleKey: 'pages.reports.cards.collections.title',
        domains: ['Finance'],
      },
      {
        key: 'communication-audiences',
        titleKey: 'pages.reports.cards.communications.title',
        domains: ['Communication'],
      },
    ],
    presetCount: 2,
    messageKey: 'pages.reports.readyHint',
  };
}

function makeCommandCenter(): CommandCenterResponse {
  return {
    stats: {
      athletes: 12,
      guardians: 18,
      upcomingSessions: 4,
      totalSessions: 6,
      cancelledSessions: 0,
      outstandingTotal: '420.00',
      overdueTotal: '120.00',
      collectedTotal: '300.00',
    },
    attendance: { present: 10, late: 0, excused: 1, absent: 1 },
    groupDistribution: [],
    upcomingByGroup: [],
    recentPayments: [],
    topOutstandingAthletes: [],
    overdueCharges: [],
    upcomingPrivateLessons: [],
    communicationReadiness: {
      audienceAthletes: 6,
      reachableGuardians: 9,
      athletesWithOverdueBalance: 2,
      incompleteAthletes: 1,
      athletesAwaitingGuardianAction: 0,
      athletesAwaitingStaffReview: 0,
      athletesNeedingFollowUp: 2,
    },
    attendanceIntelligence: {
      windows: { recentDays: 30, followUpDays: 21, prepHours: 48 },
      thresholds: {
        minimumMarkedSessions: 3,
        declinePoints: 15,
        repeatAbsences: 2,
        trialStrongRate: 75,
      },
      counts: {
        watchlist: 0,
        trialMomentum: 0,
        followUp: 0,
        attendancePending: 0,
        upcomingAttention: 0,
      },
      watchlist: [],
      trialMomentum: [],
      followUp: [],
      coachLoad: [],
      lowAttendanceGroups: [],
      attendancePendingSessions: [],
      upcomingAttentionSessions: [],
    },
    familyWorkflow: {
      open: 0,
      pendingFamilyAction: 0,
      awaitingStaffReview: 0,
      incompleteAthletes: 0,
      completed: 0,
      athletesAwaitingGuardianAction: 0,
      athletesAwaitingStaffReview: 0,
      items: [],
    },
    actionCenter: {
      counts: {
        total: 0,
        unread: 0,
        overdue: 0,
        today: 0,
        byCategory: { finance: 0, family: 0, readiness: 0, private_lessons: 0, training: 0 },
        byUrgency: { overdue: 0, today: 0, upcoming: 0, normal: 0 },
      },
      items: [],
    },
  };
}

describe('ReportsPage smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTenant.mockReturnValue({
      tenants: [{ id: 'tenant-1', name: 'Kadikoy', slug: 'kadikoy', role: 'club_admin' }],
      tenantId: 'tenant-1',
      setTenantId: vi.fn(),
      loading: false,
      error: null,
      refresh: vi.fn(),
    });
    mockApiGet.mockImplementation(async (path: string) => {
      if (path === '/api/reporting/definitions') return makeDefinitions();
      if (path === '/api/reporting/command-center') return makeCommandCenter();
      return null;
    });
    mockListSavedViews.mockResolvedValue({ items: [] } satisfies SavedReportViewListResponse);
    mockFetchStarterViews.mockResolvedValue([]);
  });

  it('renders the launch panel with translated copy and never raw i18n keys', async () => {
    renderWithRoute(<ReportsPage />, {
      path: '/app/reports',
      initialEntry: '/app/reports',
    });

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/api/reporting/command-center');
    });

    expect(await screen.findByText('Move from signal to a calm next step.')).toBeInTheDocument();
    expect(screen.getByText('Reports launchpad')).toBeInTheDocument();
    expect(screen.getByText('Save & export when you need to')).toBeInTheDocument();
    expect(screen.getByText('Build something new')).toBeInTheDocument();
    expect(screen.getByText('Group and summarize')).toBeInTheDocument();
    expect(screen.getByText('Pick up where you left off')).toBeInTheDocument();
    expect(screen.getByText('No saved views yet')).toBeInTheDocument();

    // Definition action labels — these used to render as raw i18n keys.
    const openInBuilderLinks = screen.getAllByText(/Open in builder/);
    expect(openInBuilderLinks.length).toBeGreaterThan(0);

    // Hard guard: no raw i18n keys leaked into the DOM.
    const body = document.body.textContent ?? '';
    expect(body).not.toMatch(/pages\.reports\.launch\./);
    expect(body).not.toMatch(/pages\.reports\.continueEmpty/);
    expect(body).not.toMatch(/pages\.reports\.definitionActions\./);
    expect(body).not.toMatch(/pages\.reports\.communicationReadyContext/);
  });
});
