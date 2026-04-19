import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuardianPortalHomePage } from './GuardianPortalHomePage';
import { renderWithRoute } from '../test/test-utils';
import type { GuardianPortalHome } from '../lib/domain-types';

const mockApiGet = vi.fn();

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    apiGet: (...args: Parameters<typeof actual.apiGet>) => mockApiGet(...args),
  };
});

function makeHome(overrides: Partial<GuardianPortalHome> = {}): GuardianPortalHome {
  return {
    guardian: {
      id: 'g-1',
      name: 'Ayşe Kaya',
      email: 'ayse@example.com',
      phone: null,
    },
    access: {
      status: 'active',
      activatedAt: '2026-04-10T08:00:00.000Z',
      lastLoginAt: '2026-04-19T08:00:00.000Z',
    },
    branding: {
      tenantId: 'tenant-1',
      tenantName: 'Kadıköy Gençlik Spor Kulübü',
      tenantSlug: 'kadikoy-genc-spor',
      displayName: 'Kadıköy Gençlik Spor',
      tagline: 'Aileye yakın, sporcuya odaklı.',
      primaryColor: '#0d4a3c',
      accentColor: '#1f8f6b',
      logoUrl: null,
      welcomeTitle: 'Hoş geldiniz, Kadıköy ailesi',
      welcomeMessage: 'Aileniz için bu hafta öne çıkanlar burada.',
      isCustomized: true,
      updatedAt: '2026-04-18T08:00:00.000Z',
    },
    readiness: {
      guardianId: 'g-1',
      status: 'complete',
      issueCodes: [],
      summary: {
        linkedAthletes: 1,
        primaryRelationships: 1,
        athletesAwaitingGuardianAction: 0,
        athletesAwaitingStaffReview: 0,
      },
      actions: [],
    },
    linkedAthletes: [
      {
        linkId: 'link-1',
        athleteId: 'athlete-1',
        relationshipType: 'mother',
        isPrimaryContact: true,
        athleteName: 'Deniz Kaya',
        groupName: 'U14 Girls',
        status: 'active',
        outstandingAmount: '0.00',
        overdueAmount: '0.00',
        nextTraining: [],
        nextPrivateLesson: null,
      },
    ],
    actions: [],
    finance: {
      outstandingAthletes: 0,
      overdueAthletes: 0,
    },
    today: {
      training: [],
      privateLessons: [],
    },
    ...overrides,
  };
}

beforeEach(() => {
  mockApiGet.mockReset();
});

describe('GuardianPortalHomePage', () => {
  it('renders the warm greeting, brand display name and family card', async () => {
    mockApiGet.mockResolvedValueOnce(makeHome());

    renderWithRoute(<GuardianPortalHomePage />, { path: '/portal' });

    await waitFor(() => expect(screen.getByText(/Hi Ayşe,/)).toBeInTheDocument());
    expect(screen.getAllByText('Kadıköy Gençlik Spor').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Hoş geldiniz, Kadıköy ailesi').length).toBeGreaterThan(0);
    expect(screen.getByText('Deniz Kaya')).toBeInTheDocument();
    // No attention surface should appear when nothing needs the parent's
    // attention — the calm "all caught up" copy is shown instead.
    expect(screen.getByText(/All caught up/)).toBeInTheDocument();
  });

  it('renders pending action and finance summary lines when relevant', async () => {
    mockApiGet.mockResolvedValueOnce(
      makeHome({
        actions: [
          {
            id: 'fa-1',
            athleteId: 'athlete-1',
            athleteName: 'Deniz Kaya',
            guardianId: 'g-1',
            guardianName: 'Ayşe Kaya',
            type: 'guardian_profile_update',
            status: 'pending_family_action',
            title: 'Confirm your phone number',
            description: 'Please confirm the number we have on file.',
            dueDate: null,
            payload: {},
            latestResponseText: null,
            decisionNote: null,
            submittedAt: null,
            reviewedAt: null,
            resolvedAt: null,
            createdAt: '2026-04-10T08:00:00.000Z',
            updatedAt: '2026-04-10T08:00:00.000Z',
            latestEventAt: null,
            eventCount: 0,
            events: [],
          },
        ],
        finance: { outstandingAthletes: 1, overdueAthletes: 1 },
        linkedAthletes: [
          {
            linkId: 'link-1',
            athleteId: 'athlete-1',
            relationshipType: 'mother',
            isPrimaryContact: true,
            athleteName: 'Deniz Kaya',
            groupName: 'U14 Girls',
            status: 'active',
            outstandingAmount: '350.00',
            overdueAmount: '350.00',
            nextTraining: [],
            nextPrivateLesson: null,
          },
        ],
      }),
    );

    renderWithRoute(<GuardianPortalHomePage />, { path: '/portal' });

    await waitFor(() =>
      expect(screen.getByText(/What needs your attention/)).toBeInTheDocument(),
    );
    expect(screen.getAllByText('Confirm your phone number').length).toBeGreaterThan(0);
    expect(screen.getByText(/has an open balance/)).toBeInTheDocument();
  });
});
