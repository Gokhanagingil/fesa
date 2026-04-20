import { screen, waitFor } from '@testing-library/react';
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
      },
      {
        key: 'sport_branches',
        titleKey: 'pages.onboarding.steps.sport_branches.title',
        hintKey: 'pages.onboarding.steps.sport_branches.hint',
        importEntity: 'sport_branches',
        count: 0,
        status: 'not_started',
        blocked: false,
        blockedBy: [],
        optional: false,
      },
      {
        key: 'go_live',
        titleKey: 'pages.onboarding.steps.go_live.title',
        hintKey: 'pages.onboarding.steps.go_live.hint',
        importEntity: null,
        count: 0,
        status: 'not_started',
        blocked: false,
        blockedBy: [],
        optional: false,
      },
    ],
    progress: {
      requiredCompleted: 0,
      requiredTotal: 2,
      totalCompleted: 0,
      totalSteps: 3,
      state: 'fresh',
    },
    nextStepKey: 'club_basics',
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
    expect(screen.getByText(/Just getting started/i)).toBeInTheDocument();
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
  });
});
