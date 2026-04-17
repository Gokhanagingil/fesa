import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CommunicationsPage } from './CommunicationsPage';
import { renderWithRoute } from '../test/test-utils';
import type {
  CommunicationAudienceResponse,
  CommunicationTemplatesResponse,
  OutreachActivityListResponse,
} from '../lib/domain-types';

const mockUseTenant = vi.fn();
vi.mock('../lib/tenant-hooks', () => ({
  useTenant: () => mockUseTenant(),
}));

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    apiGet: (...args: Parameters<typeof actual.apiGet>) => mockApiGet(...args),
    apiPost: (...args: Parameters<typeof actual.apiPost>) => mockApiPost(...args),
  };
});

function makeAudienceResponse(): CommunicationAudienceResponse {
  return {
    items: [
      {
        athleteId: 'athlete-1',
        athleteName: 'Deniz Kaya',
        athleteStatus: 'active',
        reasons: ['finance:overdue'],
        groupId: 'group-1',
        groupName: 'U14 Girls',
        teamIds: [],
        teamNames: [],
        guardians: [
          {
            guardianId: 'guardian-1',
            name: 'Ayşe Kaya',
            relationshipType: 'mother',
            phone: '+90 555 111 2233',
            email: 'ayse.kaya@example.com',
            isPrimaryContact: true,
          },
        ],
        outstandingAmount: '350.00',
        overdueAmount: '350.00',
        hasOverdueBalance: true,
        familyReadinessStatus: 'complete',
        pendingFamilyActions: 0,
        awaitingStaffReview: 0,
      },
      {
        athleteId: 'athlete-2',
        athleteName: 'Mert Demir',
        athleteStatus: 'active',
        reasons: ['family_action:pending'],
        groupId: 'group-2',
        groupName: 'U16 Boys',
        teamIds: [],
        teamNames: [],
        guardians: [
          {
            guardianId: 'guardian-2',
            name: 'Hakan Demir',
            relationshipType: 'father',
            phone: null,
            email: 'hakan.demir@example.com',
            isPrimaryContact: true,
          },
        ],
        outstandingAmount: '0.00',
        overdueAmount: '0.00',
        hasOverdueBalance: false,
        familyReadinessStatus: 'incomplete',
        pendingFamilyActions: 1,
        awaitingStaffReview: 0,
      },
    ],
    counts: {
      athletes: 2,
      guardians: 2,
      primaryContacts: 2,
      guardiansWithPhone: 1,
      guardiansWithEmail: 2,
      athletesWithPhoneReach: 1,
      athletesMissingPhone: 1,
      withOverdueBalance: 1,
      incompleteAthletes: 1,
      awaitingGuardianAction: 0,
      awaitingStaffReview: 0,
      needingFollowUp: 1,
    },
  };
}

function makeTemplatesResponse(): CommunicationTemplatesResponse {
  return {
    channels: ['whatsapp', 'phone', 'email', 'manual'],
    items: [
      {
        key: 'overdue_payment_reminder',
        defaultChannel: 'whatsapp',
        category: 'finance',
        titleKey: 'pages.communications.templates.overduePayment.title',
        bodyKey: 'pages.communications.templates.overduePayment.body',
        subjectKey: 'pages.communications.templates.overduePayment.subject',
        hintKey: 'pages.communications.templates.overduePayment.hint',
      },
      {
        key: 'family_follow_up',
        defaultChannel: 'whatsapp',
        category: 'general',
        titleKey: 'pages.communications.templates.familyFollowUp.title',
        bodyKey: 'pages.communications.templates.familyFollowUp.body',
        subjectKey: 'pages.communications.templates.familyFollowUp.subject',
        hintKey: 'pages.communications.templates.familyFollowUp.hint',
      },
    ],
  };
}

function makeHistoryResponse(): OutreachActivityListResponse {
  return {
    items: [
      {
        id: 'activity-1',
        channel: 'whatsapp',
        sourceSurface: 'finance_overdue',
        sourceKey: null,
        templateKey: 'overdue_payment_reminder',
        topic: 'Overdue payment — May dues',
        messagePreview: 'Hello, gentle reminder for May.',
        recipientCount: 4,
        reachableGuardianCount: 4,
        audienceSnapshot: { audienceSummary: { contextLabel: 'Finance · Overdue balance' } },
        note: null,
        createdByStaffUserId: null,
        createdByName: 'Coach Demo',
        createdAt: '2026-04-10T10:00:00.000Z',
      },
    ],
    counts: {
      total: 3,
      whatsapp: 3,
      phone: 0,
      email: 0,
      manual: 0,
    },
  };
}

function setupApiMocks(audience = makeAudienceResponse()) {
  mockApiGet.mockImplementation(async (path: string) => {
    if (path.startsWith('/api/communications/audiences')) return audience;
    if (path === '/api/communications/templates') return makeTemplatesResponse();
    if (path.startsWith('/api/communications/outreach')) return makeHistoryResponse();
    if (path.startsWith('/api/groups')) return { items: [] };
    if (path.startsWith('/api/teams')) return { items: [] };
    if (path.startsWith('/api/coaches')) return { items: [] };
    if (path.startsWith('/api/training-sessions')) return { items: [] };
    return null;
  });
  mockApiPost.mockResolvedValue({ ok: true });
}

describe('communications follow-up smoke coverage', () => {
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
    setupApiMocks();
  });

  it('renders the WhatsApp-first follow-up surface with audience and recipient cards', async () => {
    renderWithRoute(<CommunicationsPage />, {
      path: '/app/communications',
      initialEntry: '/app/communications',
    });

    expect(await screen.findByText(/Move from a club signal/i)).toBeInTheDocument();
    expect(await screen.findByText('Common follow-ups')).toBeInTheDocument();
    expect(await screen.findByText('Deniz Kaya')).toBeInTheDocument();
    const whatsappLinks = await screen.findAllByRole('link', { name: 'Open WhatsApp' });
    expect(whatsappLinks.length).toBeGreaterThan(0);
    expect(whatsappLinks[0].getAttribute('href')).toMatch(/^https:\/\/wa\.me\//);
  });

  it('hydrates audience source from a deep link with template and channel', async () => {
    renderWithRoute(<CommunicationsPage />, {
      path: '/app/communications',
      initialEntry:
        '/app/communications?financialState=overdue&primaryContactsOnly=true&channel=whatsapp&template=overdue_payment_reminder&source=finance_overdue',
    });

    expect(await screen.findByText('Finance · Overdue balance')).toBeInTheDocument();
    await waitFor(() => {
      const calls = mockApiGet.mock.calls.map((args) => String(args[0]));
      expect(calls.some((path) => path.includes('financialState=overdue'))).toBe(true);
    });
  });

  it('logs a follow-up when the operator saves the draft', async () => {
    renderWithRoute(<CommunicationsPage />, {
      path: '/app/communications',
      initialEntry:
        '/app/communications?source=finance_overdue&channel=whatsapp&template=overdue_payment_reminder&primaryContactsOnly=true',
    });

    await screen.findByText('Deniz Kaya');
    const user = userEvent.setup();
    const saveButton = await screen.findByRole('button', { name: /Save to follow-up log/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/api/communications/outreach',
        expect.objectContaining({
          channel: 'whatsapp',
          sourceSurface: 'finance_overdue',
          templateKey: 'overdue_payment_reminder',
        }),
      );
    });
  });

  it('shows the recent follow-up history with channel chips and source labels', async () => {
    renderWithRoute(<CommunicationsPage />, {
      path: '/app/communications',
      initialEntry: '/app/communications',
    });

    const user = userEvent.setup();
    const historyTab = await screen.findByRole('button', { name: 'Recent follow-ups' });
    await user.click(historyTab);

    expect(await screen.findByText('Overdue payment — May dues')).toBeInTheDocument();
    const sourceLabels = await screen.findAllByText(/Finance · Overdue balance/i);
    expect(sourceLabels.length).toBeGreaterThan(0);
  });
});
