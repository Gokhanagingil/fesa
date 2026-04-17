import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReportBuilderPage } from './ReportBuilderPage';
import { DashboardPage } from './DashboardPage';
import { renderWithRoute } from '../test/test-utils';
import { DataExplorer } from '../components/reporting/DataExplorer';
import type {
  ReportCatalogResponse,
  SavedReportView,
  SavedReportViewListResponse,
  StarterReportView,
} from '../lib/reporting-types';
import type { CommandCenterResponse } from '../lib/domain-types';
import type { ClubOverviewResponse } from '../lib/overview-types';
import { buildStarterLink } from '../lib/report-deep-link';

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

const mockUseAuth = vi.fn();
vi.mock('../lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockReportingClient = vi.hoisted(() => ({
  fetchCatalog: vi.fn(),
  fetchStarterView: vi.fn(),
  fetchStarterViews: vi.fn(),
  listSavedViews: vi.fn(),
  getSavedView: vi.fn(),
  runReport: vi.fn(),
  createSavedView: vi.fn(),
  updateSavedView: vi.fn(),
  deleteSavedView: vi.fn(),
  exportReportCsv: vi.fn(),
}));

vi.mock('../lib/reporting-client', () => mockReportingClient);

const mockApiGet = vi.fn();
vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    apiGet: (...args: Parameters<typeof actual.apiGet>) => mockApiGet(...args),
  };
});

const catalog: ReportCatalogResponse = {
  entities: [
    {
      key: 'athletes',
      labelKey: 'pages.dashboard.stats.athletes',
      defaultColumns: ['athlete.firstName', 'athlete.lastName', 'athlete.primaryGroup'],
      defaultSort: { field: 'athlete.firstName', direction: 'asc' },
      exportRowLimit: 500,
      fields: [
        {
          key: 'athlete.firstName',
          entity: 'athletes',
          labelKey: 'pages.reports.fields.athlete.firstName',
          type: 'string',
          operators: ['contains', 'is'],
          selectable: true,
          sortable: true,
        },
        {
          key: 'athlete.lastName',
          entity: 'athletes',
          labelKey: 'pages.reports.fields.athlete.lastName',
          type: 'string',
          operators: ['contains', 'is'],
          selectable: true,
          sortable: true,
        },
        {
          key: 'athlete.primaryGroup',
          entity: 'athletes',
          labelKey: 'pages.reports.fields.athlete.primaryGroup',
          type: 'string',
          operators: ['is', 'contains'],
          selectable: true,
          sortable: true,
          groupable: true,
        },
        {
          key: 'athlete.outstandingTotal',
          entity: 'athletes',
          labelKey: 'pages.reports.fields.athlete.outstandingTotal',
          type: 'currency',
          operators: ['gt', 'gte'],
          selectable: true,
          sortable: true,
          aggregations: ['sum', 'avg', 'max'],
        },
      ],
    },
    {
      key: 'private_lessons',
      labelKey: 'app.nav.privateLessons',
      defaultColumns: ['lesson.athleteName', 'lesson.coachName'],
      defaultSort: { field: 'lesson.scheduledStart', direction: 'asc' },
      exportRowLimit: 500,
      fields: [
        {
          key: 'lesson.athleteName',
          entity: 'private_lessons',
          labelKey: 'pages.reports.fields.lesson.athleteName',
          type: 'string',
          operators: ['contains', 'is'],
          selectable: true,
          sortable: true,
        },
        {
          key: 'lesson.coachName',
          entity: 'private_lessons',
          labelKey: 'pages.reports.fields.lesson.coachName',
          type: 'string',
          operators: ['contains', 'is'],
          selectable: true,
          sortable: true,
          groupable: true,
        },
        {
          key: 'lesson.chargeRemaining',
          entity: 'private_lessons',
          labelKey: 'pages.reports.fields.lesson.chargeRemaining',
          type: 'currency',
          operators: ['gt', 'gte'],
          selectable: true,
          sortable: true,
          aggregations: ['sum', 'avg', 'max'],
        },
      ],
    },
    {
      key: 'finance_charges',
      labelKey: 'pages.dashboard.cardFinance',
      defaultColumns: ['charge.athleteName', 'charge.amount'],
      defaultSort: { field: 'charge.amount', direction: 'desc' },
      exportRowLimit: 500,
      fields: [
        {
          key: 'charge.athleteName',
          entity: 'finance_charges',
          labelKey: 'pages.reports.fields.charge.athleteName',
          type: 'string',
          operators: ['contains', 'is'],
          selectable: true,
          sortable: true,
        },
        {
          key: 'charge.amount',
          entity: 'finance_charges',
          labelKey: 'pages.reports.fields.charge.amount',
          type: 'currency',
          operators: ['gt', 'gte'],
          selectable: true,
          sortable: true,
          aggregations: ['sum', 'avg', 'max'],
        },
        {
          key: 'charge.itemCategory',
          entity: 'finance_charges',
          labelKey: 'pages.reports.fields.charge.itemCategory',
          type: 'string',
          operators: ['is', 'contains'],
          selectable: true,
          sortable: true,
          groupable: true,
        },
      ],
    },
  ],
};

const starterViews: StarterReportView[] = [
  {
    id: 'athletes.outstandingBalance',
    entity: 'athletes',
    titleKey: 'pages.reports.starter.athletes.outstandingBalance.title',
    descriptionKey: 'pages.reports.starter.athletes.outstandingBalance.description',
    categoryKey: 'pages.reports.starter.categories.finance',
    category: 'Finance',
    filter: {
      type: 'group',
      combinator: 'and',
      children: [
        {
          type: 'condition',
          field: 'athlete.outstandingTotal',
          operator: 'gt',
          value: 0,
        },
      ],
    },
    columns: ['athlete.firstName', 'athlete.lastName', 'athlete.outstandingTotal'],
    sort: [{ field: 'athlete.outstandingTotal', direction: 'desc' }],
    managementPack: true,
  },
  {
    id: 'lessons.byCoach',
    entity: 'private_lessons',
    titleKey: 'pages.reports.starter.lessons.byCoach.title',
    descriptionKey: 'pages.reports.starter.lessons.byCoach.description',
    categoryKey: 'pages.reports.starter.categories.management',
    category: 'Management',
    filter: null,
    columns: ['lesson.coachName', 'lesson.chargeRemaining'],
    sort: [],
    groupBy: {
      field: 'lesson.coachName',
      measures: [
        { op: 'count', alias: 'count' },
        { op: 'sum', field: 'lesson.chargeRemaining', alias: 'sum_chargeRemaining' },
      ],
      sort: { alias: 'count', direction: 'desc' },
      limit: 25,
    },
    managementPack: true,
  },
  {
    id: 'finance.overdue',
    entity: 'finance_charges',
    titleKey: 'pages.reports.starter.finance.overdue.title',
    descriptionKey: 'pages.reports.starter.finance.overdue.description',
    categoryKey: 'pages.reports.starter.categories.finance',
    category: 'Finance',
    filter: null,
    columns: ['charge.athleteName', 'charge.amount'],
    sort: [{ field: 'charge.amount', direction: 'desc' }],
    managementPack: true,
  },
];

const baseSavedViews: SavedReportView[] = [
  {
    id: 'view-1',
    tenantId: 'tenant-1',
    entity: 'athletes',
    name: 'Outstanding balance - weekly',
    description: 'Weekly balance review',
    filter: starterViews[0].filter,
    columns: ['athlete.firstName', 'athlete.lastName', 'athlete.outstandingTotal'],
    sort: [{ field: 'athlete.outstandingTotal', direction: 'desc' }],
    search: null,
    visibility: 'private',
    ownerStaffUserId: 'staff-1',
    ownerName: 'Coach Demo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    groupBy: null,
    derivedFromStarterId: 'athletes.outstandingBalance',
  },
];

function makeRowsResponse(entity: 'athletes' | 'finance_charges' = 'athletes') {
  if (entity === 'finance_charges') {
    return {
      entity,
      total: 2,
      limit: 25,
      offset: 0,
      columns: ['charge.athleteName', 'charge.amount'],
      rows: [
        { 'charge.athleteName': 'Deniz Kaya', 'charge.amount': 400 },
        { 'charge.athleteName': 'Ece Demir', 'charge.amount': 175 },
      ],
    };
  }
  return {
    entity,
    total: 2,
    limit: 25,
    offset: 0,
    columns: ['athlete.firstName', 'athlete.lastName', 'athlete.outstandingTotal'],
    rows: [
      { 'athlete.firstName': 'Deniz', 'athlete.lastName': 'Kaya', 'athlete.outstandingTotal': 400 },
      { 'athlete.firstName': 'Ece', 'athlete.lastName': 'Demir', 'athlete.outstandingTotal': 175 },
    ],
  };
}

function makeGroupedResponse() {
  return {
    entity: 'private_lessons' as const,
    total: 2,
    limit: 25,
    offset: 0,
    columns: ['lesson.coachName', 'count', 'sum_chargeRemaining'],
    rows: [
      { 'lesson.coachName': 'Coach Ada', count: 3, sum_chargeRemaining: 520 },
      { 'lesson.coachName': 'Coach Mert', count: 2, sum_chargeRemaining: 240 },
    ],
    groupBy: starterViews[1].groupBy,
    columnLabels: [
      { key: 'lesson.coachName', labelKey: 'pages.reports.fields.lesson.coachName' },
      { key: 'count', label: 'Count', isMeasure: true },
      { key: 'sum_chargeRemaining', label: 'Sum chargeRemaining', isMeasure: true },
    ],
  };
}

function makeCommandCenterResponse(): CommandCenterResponse {
  return {
    stats: {
      athletes: 48,
      guardians: 70,
      upcomingSessions: 11,
      totalSessions: 14,
      cancelledSessions: 1,
      outstandingTotal: '1250.00',
      overdueTotal: '480.00',
      collectedTotal: '920.00',
    },
    attendance: {
      present: 20,
      late: 1,
      excused: 2,
      absent: 1,
    },
    groupDistribution: [],
    upcomingByGroup: [],
    recentPayments: [],
    topOutstandingAthletes: [],
    overdueCharges: [],
    upcomingPrivateLessons: [],
    communicationReadiness: {
      audienceAthletes: 15,
      reachableGuardians: 22,
      athletesWithOverdueBalance: 4,
      incompleteAthletes: 2,
      athletesAwaitingGuardianAction: 1,
      athletesAwaitingStaffReview: 1,
      athletesNeedingFollowUp: 4,
    },
    familyWorkflow: {
      open: 3,
      pendingFamilyAction: 2,
      awaitingStaffReview: 1,
      incompleteAthletes: 2,
      completed: 5,
      athletesAwaitingGuardianAction: 1,
      athletesAwaitingStaffReview: 1,
      items: [],
    },
    actionCenter: {
      counts: {
        total: 5,
        unread: 2,
        overdue: 1,
        today: 1,
        byCategory: {
          finance: 2,
          family: 1,
          readiness: 1,
          private_lessons: 1,
          training: 0,
        },
        byUrgency: {
          overdue: 1,
          today: 1,
          upcoming: 2,
          normal: 1,
        },
      },
      items: [],
    },
  };
}

function makeClubOverview(): ClubOverviewResponse {
  return {
    tenant: {
      id: 'tenant-1',
      name: 'Kadikoy',
      slug: 'kadikoy',
    },
    accessRole: 'club_admin',
    counts: {
      athletes: 48,
      guardians: 70,
      coaches: 6,
      groups: 4,
      teams: 3,
      portalAccess: 22,
    },
  };
}

function setBuilderDefaults(savedViews: SavedReportView[] = baseSavedViews) {
  mockUseTenant.mockReturnValue({
    tenants: [{ id: 'tenant-1', name: 'Kadikoy', slug: 'kadikoy', role: 'club_admin' }],
    tenantId: 'tenant-1',
    setTenantId: vi.fn(),
    loading: false,
    error: null,
    refresh: vi.fn(),
  });
  mockUseAuth.mockReturnValue({
    canAccessCrossTenant: false,
  });
  mockNavigate.mockReset();
  mockReportingClient.fetchCatalog.mockResolvedValue(catalog);
  mockReportingClient.fetchStarterViews.mockResolvedValue(starterViews);
  mockReportingClient.fetchStarterView.mockImplementation(async (id: string) => {
    const match = starterViews.find((view) => view.id === id);
    if (!match) throw new Error(`Unknown starter ${id}`);
    return match;
  });
  mockReportingClient.listSavedViews.mockImplementation(async (entity?: string): Promise<SavedReportViewListResponse> => ({
    items: savedViews.filter((view) => !entity || view.entity === entity),
  }));
  mockReportingClient.getSavedView.mockImplementation(async (id: string) => {
    const match = savedViews.find((view) => view.id === id);
    if (!match) throw new Error(`Unknown saved view ${id}`);
    return match;
  });
  mockReportingClient.runReport.mockImplementation(async (request: { entity: 'athletes' | 'private_lessons' | 'finance_charges'; groupBy?: unknown }) => {
    if (request.groupBy) {
      return makeGroupedResponse();
    }
    if (request.entity === 'finance_charges') {
      return makeRowsResponse('finance_charges');
    }
    return makeRowsResponse('athletes');
  });
  mockReportingClient.createSavedView.mockImplementation(async (input: Partial<SavedReportView> & { entity: string; name: string }) => ({
    ...baseSavedViews[0],
    id: 'view-created',
    entity: input.entity as SavedReportView['entity'],
    name: input.name,
    description: input.description ?? null,
    visibility: (input.visibility as SavedReportView['visibility']) ?? 'private',
    groupBy: (input.groupBy as SavedReportView['groupBy']) ?? null,
    derivedFromStarterId: (input.derivedFromStarterId as string | null | undefined) ?? null,
  }));
  mockReportingClient.updateSavedView.mockImplementation(async (id: string, input: Partial<SavedReportView>) => ({
    ...savedViews[0],
    id,
    name: input.name ?? savedViews[0].name,
    description: input.description ?? savedViews[0].description,
    visibility: input.visibility ?? savedViews[0].visibility,
  }));
  mockReportingClient.deleteSavedView.mockResolvedValue(undefined);
  mockReportingClient.exportReportCsv.mockResolvedValue(undefined);
}

describe('reporting frontend smoke coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setBuilderDefaults();
  });

  it('renders the report builder landing', async () => {
    renderWithRoute(<ReportBuilderPage />, {
      path: '/app/report-builder',
      initialEntry: '/app/report-builder',
    });

    expect(await screen.findByText('Build a report in three calm steps.')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Athletes' })).toBeInTheDocument();
    expect(await screen.findByText('Open a ready-made report')).toBeInTheDocument();
    expect(await screen.findByPlaceholderText('Quick search')).toBeInTheDocument();
  });

  it('loads the starter panel and opens a starter report', async () => {
    renderWithRoute(<ReportBuilderPage />, {
      path: '/app/report-builder',
      initialEntry: '/app/report-builder',
    });

    const user = userEvent.setup();
    const starterSection = await screen.findByText('Open a ready-made report');
    const starterCard = starterSection.closest('section');
    const openButtons = starterCard ? starterCard.querySelectorAll('button') : [];
    await user.click(openButtons[0] as HTMLButtonElement);

    expect(await screen.findByText('Athletes with outstanding balance')).toBeInTheDocument();
    expect(await screen.findByText('Deniz')).toBeInTheDocument();
  });

  it('enables grouping and renders a grouped result', async () => {
    renderWithRoute(<ReportBuilderPage />, {
      path: '/app/report-builder',
      initialEntry: '/app/report-builder',
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Private lessons' }));
    await waitFor(() => {
      expect(mockReportingClient.runReport).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'private_lessons',
        }),
      );
    });
    await user.click(await screen.findByRole('button', { name: 'Group' }));

    expect(await screen.findByText('Group & summarize')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockReportingClient.runReport).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'private_lessons',
          groupBy: expect.objectContaining({
            field: 'lesson.coachName',
          }),
        }),
      );
    });

    expect(await screen.findByText('Coach Ada')).toBeInTheDocument();
    expect(await screen.findByText('2 groups')).toBeInTheDocument();
  });

  it('covers save as new and duplicate from starter', async () => {
    renderWithRoute(<ReportBuilderPage />, {
      path: '/app/report-builder',
      initialEntry: buildStarterLink('athletes.outstandingBalance'),
    });

    const user = userEvent.setup();

    await screen.findByText('Athletes with outstanding balance');
    await user.click(await screen.findByRole('button', { name: 'Save view' }));

    const nameInput = await screen.findByLabelText('Name');
    await user.type(nameInput, 'My weekly balance check');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockReportingClient.createSavedView).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My weekly balance check',
          derivedFromStarterId: 'athletes.outstandingBalance',
        }),
      );
    });
    expect(await screen.findByText('View saved: My weekly balance check')).toBeInTheDocument();
  });

  it('covers delete existing saved view', async () => {
    renderWithRoute(
      <DataExplorer
        entity="athletes"
        initialState={{
          activeViewId: 'view-1',
          contextLabel: 'Outstanding balance - weekly',
        }}
        embed
      />,
      {
        path: '/',
        initialEntry: '/',
      },
    );

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /Save view|Update view/ }));
    await user.click(await screen.findByRole('button', { name: 'Delete view' }));

    await waitFor(() => {
      expect(mockReportingClient.deleteSavedView).toHaveBeenCalledWith('view-1');
    });
  });

  it('opens dashboard drill-down into the intended reporting context', async () => {
    mockApiGet.mockImplementation(async (path: string) => {
      if (path === '/api/reporting/command-center') return makeCommandCenterResponse();
      if (path === '/api/guardians?limit=1') return { total: 18 };
      if (path === '/api/coaches?limit=50&isActive=true') return { items: [] };
      if (path === '/api/private-lessons?limit=5') return { items: [] };
      if (path === '/api/auth/club-overview') return makeClubOverview();
      return null;
    });

    renderWithRoute(<DashboardPage />, {
      path: '/app/dashboard',
      initialEntry: '/app/dashboard',
    });

    const overdueLink = await screen.findByRole('link', { name: /Overdue charges/i });
    expect(overdueLink.getAttribute('href')).toBe(buildStarterLink('finance.overdue'));
    const financeReportLink = await screen.findByRole('link', { name: /Finance.*Reusable charge items and assigned athlete fees/i });
    expect(financeReportLink).toHaveAttribute('href', expect.stringContaining('/app/report-builder?preset='));
  });
});
