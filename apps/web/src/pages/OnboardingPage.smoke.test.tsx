import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingPage } from './OnboardingPage';
import { renderWithRoute } from '../test/test-utils';

const mockUseTenant = vi.fn();
vi.mock('../lib/tenant-hooks', () => ({
  useTenant: () => mockUseTenant(),
}));

const mockApiGet = vi.fn();
vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    apiGet: (...args: Parameters<typeof actual.apiGet>) => mockApiGet(...args),
  };
});

const mockFetchDefinitions = vi.fn();
const mockFetchOnboardingState = vi.fn();
vi.mock('../lib/imports', async () => {
  const actual = await vi.importActual<typeof import('../lib/imports')>('../lib/imports');
  return {
    ...actual,
    fetchImportDefinitions: () => mockFetchDefinitions(),
    fetchOnboardingState: () => mockFetchOnboardingState(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mockUseTenant.mockReturnValue({
    tenants: [{ id: 'tenant-1', name: 'Demo Club', slug: 'demo', role: 'club_admin' }],
    tenantId: 'tenant-1',
    setTenantId: vi.fn(),
    loading: false,
    error: null,
    refresh: vi.fn(),
  });
  mockApiGet.mockResolvedValue([]);
  mockFetchDefinitions.mockResolvedValue([
    {
      entity: 'sport_branches',
      labelKey: 'pages.imports.entities.sportBranches.title',
      descriptionKey: 'pages.imports.entities.sportBranches.description',
      sample: [],
      fields: [
        {
          key: 'name',
          labelKey: 'pages.imports.fields.sportBranches.name',
          required: true,
          type: 'string',
          aliases: ['name'],
        },
        {
          key: 'code',
          labelKey: 'pages.imports.fields.sportBranches.code',
          required: true,
          type: 'string',
          aliases: ['code'],
        },
      ],
    },
  ]);
  mockFetchOnboardingState.mockResolvedValue({
    tenantId: 'tenant-1',
    tenantName: 'Demo Club',
    brandConfigured: false,
    steps: [
      {
        key: 'club_basics',
        titleKey: 'pages.onboarding.steps.club_basics.title',
        hintKey: 'pages.onboarding.steps.club_basics.hint',
        importEntity: null,
        count: 0,
        status: 'not_started',
        blocked: false,
        blockedBy: [],
        optional: false,
        lastImport: null,
      },
      {
        key: 'sport_branches',
        titleKey: 'pages.onboarding.steps.sport_branches.title',
        hintKey: 'pages.onboarding.steps.sport_branches.hint',
        importEntity: 'sport_branches',
        count: 2,
        status: 'completed',
        blocked: false,
        blockedBy: [],
        optional: false,
        lastImport: {
          batchId: 'batch-1',
          status: 'success',
          committedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          source: 'branches.csv',
          totalRows: 2,
          createdRows: 2,
          updatedRows: 0,
          skippedRows: 0,
          rejectedRows: 0,
          warningRows: 0,
          triggeredBy: 'Demo Admin',
        },
      },
      {
        key: 'go_live',
        titleKey: 'pages.onboarding.steps.go_live.title',
        hintKey: 'pages.onboarding.steps.go_live.hint',
        importEntity: null,
        count: 0,
        status: 'in_progress',
        blocked: false,
        blockedBy: [],
        optional: false,
        lastImport: null,
      },
    ],
    progress: {
      requiredCompleted: 1,
      requiredTotal: 2,
      totalCompleted: 1,
      totalSteps: 3,
      state: 'in_progress',
    },
    nextStepKey: 'club_basics',
    readiness: {
      tone: 'almost_ready',
      headlineKey: 'pages.onboarding.readiness.headline.almost_ready',
      subtitleKey: 'pages.onboarding.readiness.subtitle.almost_ready',
      outstandingRequiredSteps: ['club_basics'],
      outstandingOptionalSteps: [],
      signals: [
        {
          key: 'brand_missing',
          tone: 'info',
          messageKey: 'pages.onboarding.readiness.signals.brandMissing',
          stepKey: 'club_basics',
        },
      ],
    },
    recentImports: [
      {
        id: 'batch-1',
        entity: 'sport_branches',
        status: 'success',
        committedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        source: 'branches.csv',
        totalRows: 2,
        createdRows: 2,
        updatedRows: 0,
        skippedRows: 0,
        rejectedRows: 0,
        warningRows: 0,
        durationMs: 120,
        triggeredBy: 'Demo Admin',
      },
    ],
    generatedAt: new Date().toISOString(),
  });
});

describe('OnboardingPage smoke coverage', () => {
  it('renders the wizard rail and lands on the first incomplete step', async () => {
    renderWithRoute(<OnboardingPage />, {
      path: '/app/onboarding',
      initialEntry: '/app/onboarding',
    });

    expect(await screen.findByText(/Welcome, Demo Club/i)).toBeInTheDocument();
    expect(await screen.findByText(/Confirm your club identity/i)).toBeInTheDocument();
    expect(screen.getByText(/Sport branches/i)).toBeInTheDocument();
    expect(screen.getAllByText(/In progress/i).length).toBeGreaterThan(0);
  });

  it('switches to a different step when the user clicks it', async () => {
    renderWithRoute(<OnboardingPage />, {
      path: '/app/onboarding',
      initialEntry: '/app/onboarding',
    });

    const user = userEvent.setup();
    const branchStep = await screen.findByRole('button', { name: /Sport branches/i });
    await user.click(branchStep);

    await waitFor(() => {
      expect(screen.getByText(/List the sports your club runs\./i)).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /Download CSV template/i })).toBeInTheDocument();
    // Last import card should surface the source filename for confidence.
    expect(screen.getByText(/Last import for this step/i)).toBeInTheDocument();
    expect(screen.getByText(/branches\.csv/i)).toBeInTheDocument();
  });

  it('shows the go-live readiness summary, checklist and recent imports', async () => {
    renderWithRoute(<OnboardingPage />, {
      path: '/app/onboarding',
      initialEntry: '/app/onboarding?step=go_live',
    });

    const readiness = await screen.findByLabelText(/Go-live readiness summary/i);
    expect(within(readiness).getByText(/Almost ready/i)).toBeInTheDocument();
    expect(
      within(readiness).getByText(/A couple of things still need attention/i),
    ).toBeInTheDocument();
    expect(within(readiness).getByText(/Add a club name/i)).toBeInTheDocument();

    expect(screen.getAllByText(/Required steps/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Recent imports/i)).toBeInTheDocument();
    expect(screen.getByText(/branches\.csv/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Demo Admin/i).length).toBeGreaterThan(0);
  });
});
