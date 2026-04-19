import { screen, waitFor, within } from '@testing-library/react';
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
        status: 'logged',
        sourceSurface: 'finance_overdue',
        sourceKey: null,
        templateKey: 'overdue_payment_reminder',
        topic: 'Overdue payment — May dues',
        messagePreview: 'Hello, gentle reminder for May.',
        recipientCount: 4,
        reachableGuardianCount: 4,
        audienceSnapshot: {
          audienceFilters: {
            financialState: 'overdue',
            primaryContactsOnly: true,
          },
          audienceSummary: { contextLabel: 'Finance · Overdue balance' },
        },
        note: null,
        createdByStaffUserId: null,
        createdByName: 'Coach Demo',
        createdAt: '2026-04-10T10:00:00.000Z',
        updatedAt: '2026-04-10T10:00:00.000Z',
      },
      {
        id: 'activity-2',
        channel: 'whatsapp',
        status: 'draft',
        sourceSurface: 'communications',
        sourceKey: 'needs_follow_up',
        templateKey: 'family_follow_up',
        topic: 'Family follow-up draft',
        messagePreview: 'Hello {{athleteName}} — quick check-in draft',
        recipientCount: 0,
        reachableGuardianCount: 0,
        audienceSnapshot: {
          audienceFilters: {
            needsFollowUp: true,
            primaryContactsOnly: true,
            athleteIds: ['athlete-2'],
          },
          audienceSummary: { contextLabel: 'Follow-up surface' },
        },
        note: null,
        createdByStaffUserId: null,
        createdByName: 'Coach Demo',
        // Intentionally several months old so the smoke test can verify
        // the gentle "still relevant?" stale-draft hint surfaces.
        createdAt: '2025-12-01T09:00:00.000Z',
        updatedAt: '2025-12-01T09:00:00.000Z',
      },
    ],
    counts: {
      total: 4,
      whatsapp: 4,
      phone: 0,
      email: 0,
      manual: 0,
      draft: 1,
      logged: 3,
      archived: 0,
    },
  };
}

function makeReadinessResponse(
  state: 'not_configured' | 'assisted_only' | 'partial' | 'direct_capable' | 'invalid' = 'assisted_only',
) {
  const directCapable = state === 'direct_capable';
  return {
    channel: 'whatsapp',
    whatsapp: {
      state,
      directSendAvailable: directCapable,
      cloudApiEnabled: state !== 'not_configured' && state !== 'assisted_only',
      configured: {
        phoneNumberId: state !== 'not_configured',
        businessAccountId: state !== 'not_configured',
        accessTokenRef: directCapable,
      },
      displayPhoneNumber: directCapable ? '+90 555 000 0000' : null,
      validation: {
        state: directCapable ? 'ok' : 'never_validated',
        message: null,
        validatedAt: null,
      },
      issues: state === 'partial' ? ['missing_access_token_ref'] : [],
    },
    plan: {
      preferredMode: directCapable ? 'direct' : 'assisted',
      fallbackMode: directCapable ? 'assisted' : null,
      capabilities: [],
    },
  };
}

function setupApiMocks(
  audience = makeAudienceResponse(),
  readiness = makeReadinessResponse('assisted_only'),
) {
  mockApiGet.mockImplementation(async (path: string) => {
    if (path.startsWith('/api/communications/audiences')) return audience;
    if (path === '/api/communications/templates') return makeTemplatesResponse();
    if (path.startsWith('/api/communications/readiness')) return readiness;
    if (path.startsWith('/api/communications/outreach/activity-2')) {
      const history = makeHistoryResponse();
      return history.items[1];
    }
    if (path.startsWith('/api/communications/outreach/activity-1')) {
      const history = makeHistoryResponse();
      return history.items[0];
    }
    if (path.startsWith('/api/communications/outreach')) return makeHistoryResponse();
    if (path.startsWith('/api/groups')) return { items: [] };
    if (path.startsWith('/api/teams')) return { items: [] };
    if (path.startsWith('/api/coaches')) return { items: [] };
    if (path.startsWith('/api/training-sessions')) return { items: [] };
    return null;
  });
  mockApiPost.mockResolvedValue({ id: 'activity-new', status: 'logged' });
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
          audienceFilters: expect.objectContaining({
            primaryContactsOnly: true,
          }),
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

  it('persists a draft with the lifecycle status and surfaces the new state', async () => {
    mockApiPost.mockResolvedValueOnce({ id: 'activity-new', status: 'draft' });
    renderWithRoute(<CommunicationsPage />, {
      path: '/app/communications',
      initialEntry:
        '/app/communications?source=finance_overdue&channel=whatsapp&template=overdue_payment_reminder&primaryContactsOnly=true',
    });

    await screen.findByText('Deniz Kaya');
    const user = userEvent.setup();
    const draftButton = await screen.findByRole('button', { name: /Save as draft/i });
    await user.click(draftButton);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/api/communications/outreach',
        expect.objectContaining({
          status: 'draft',
          channel: 'whatsapp',
          sourceSurface: 'finance_overdue',
          audienceFilters: expect.objectContaining({
            primaryContactsOnly: true,
          }),
        }),
      );
    });

    expect(await screen.findByText(/Draft saved/i)).toBeInTheDocument();
  });

  it('lets the operator continue a saved draft from the history tab', async () => {
    renderWithRoute(<CommunicationsPage />, {
      path: '/app/communications',
      initialEntry: '/app/communications',
    });

    const user = userEvent.setup();
    const historyTab = await screen.findByRole('button', { name: 'Recent follow-ups' });
    await user.click(historyTab);

    const continueButton = await screen.findByRole('button', { name: /Continue this draft/i });
    await user.click(continueButton);

    await waitFor(() => {
      const calls = mockApiGet.mock.calls.map((args) => String(args[0]));
      expect(calls.some((path) => path.endsWith('/api/communications/outreach/activity-2'))).toBe(true);
    });

    expect(await screen.findByText(/Draft re-opened/i)).toBeInTheDocument();
  });

  it('reopens a saved draft with the same audience filters', async () => {
    renderWithRoute(<CommunicationsPage />, {
      path: '/app/communications',
      initialEntry: '/app/communications',
    });

    const user = userEvent.setup();
    const historyTab = await screen.findByRole('button', { name: 'Recent follow-ups' });
    await user.click(historyTab);

    const continueButton = await screen.findByRole('button', { name: /Continue this draft/i });
    await user.click(continueButton);

    await waitFor(() => {
      const calls = mockApiGet.mock.calls.map((args) => String(args[0]));
      expect(
        calls.some(
          (path) =>
            path.includes('/api/communications/audiences?') &&
            path.includes('needsFollowUp=true') &&
            path.includes('primaryContactsOnly=true') &&
            path.includes('athleteIds=athlete-2'),
        ),
      ).toBe(true);
    });
  });

  it('surfaces the gentle stale-draft hint and template filter in the history tab', async () => {
    renderWithRoute(<CommunicationsPage />, {
      path: '/app/communications',
      initialEntry: '/app/communications',
    });

    const user = userEvent.setup();
    const historyTab = await screen.findByRole('button', { name: 'Recent follow-ups' });
    await user.click(historyTab);

    expect(await screen.findByText(/Still relevant\?/i)).toBeInTheDocument();
    expect(
      await screen.findByText(/draft has been waiting more than/i),
    ).toBeInTheDocument();
    // Refining recent follow-ups by template should narrow the rendered list.
    const templateSelect = await screen.findByDisplayValue('Any template');
    await user.selectOptions(templateSelect, 'overdue_payment_reminder');
    expect(screen.queryByText('Family follow-up draft')).not.toBeInTheDocument();
  });

  it('lets the operator hide families without contact via the reachable-only toggle', async () => {
    renderWithRoute(<CommunicationsPage />, {
      path: '/app/communications',
      initialEntry: '/app/communications',
    });

    expect(await screen.findByText('Mert Demir')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(await screen.findByLabelText(/Show reachable only/i));
    await waitFor(() => {
      expect(screen.queryByText('Mert Demir')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Deniz Kaya')).toBeInTheDocument();
  });

  it('keeps Send via WhatsApp hidden when direct send is not configured', async () => {
    renderWithRoute(<CommunicationsPage />, {
      path: '/app/communications',
      initialEntry: '/app/communications',
    });
    await screen.findByText('Deniz Kaya');
    expect(screen.queryByRole('button', { name: 'Send via WhatsApp' })).not.toBeInTheDocument();
    // Assisted mode label is still visible on the delivery banner.
    expect(await screen.findByText('Assisted')).toBeInTheDocument();
  });

  it('renders the direct-send action when readiness reports direct_capable', async () => {
    setupApiMocks(makeAudienceResponse(), makeReadinessResponse('direct_capable'));
    renderWithRoute(<CommunicationsPage />, {
      path: '/app/communications',
      initialEntry: '/app/communications',
    });
    await screen.findByText('Deniz Kaya');
    expect(await screen.findByRole('button', { name: 'Send via WhatsApp' })).toBeInTheDocument();
    expect(await screen.findByText('Direct send')).toBeInTheDocument();
  });

  it('reports an honest partial-sent notice from a direct delivery attempt', async () => {
    setupApiMocks(makeAudienceResponse(), makeReadinessResponse('direct_capable'));
    mockApiPost.mockImplementation(async (path: string) => {
      if (path.endsWith('/deliver')) {
        return {
          id: 'activity-1',
          status: 'logged',
          delivery: {
            mode: 'direct',
            state: 'sent',
            provider: 'whatsapp_cloud_api',
            providerMessageId: 'wamid.x',
            detail: 'partial_sent:1_of_2',
            attemptedAt: '2026-04-19T10:00:00.000Z',
            completedAt: '2026-04-19T10:00:01.000Z',
            attemptCounts: { attempted: 2, sent: 1, failed: 1 },
          },
        };
      }
      return { id: 'activity-new', status: 'logged' };
    });
    renderWithRoute(<CommunicationsPage />, {
      path: '/app/communications',
      initialEntry: '/app/communications',
    });
    await screen.findByText('Deniz Kaya');
    const user = userEvent.setup();
    const sendButton = await screen.findByRole('button', { name: 'Send via WhatsApp' });
    await user.click(sendButton);
    expect(
      await screen.findByText(/Direct send completed for 1 of 2 families/i),
    ).toBeInTheDocument();
  });

  it('reports a calm fallback notice when the direct attempt rolls back to assisted', async () => {
    setupApiMocks(makeAudienceResponse(), makeReadinessResponse('direct_capable'));
    mockApiPost.mockImplementation(async (path: string) => {
      if (path.endsWith('/deliver')) {
        return {
          id: 'activity-1',
          status: 'logged',
          delivery: {
            mode: 'assisted',
            state: 'fallback',
            provider: 'assisted_whatsapp',
            providerMessageId: null,
            detail: 'direct_failed:token_invalid',
            attemptedAt: '2026-04-19T10:00:00.000Z',
            completedAt: '2026-04-19T10:00:01.000Z',
            attemptCounts: { attempted: 2, sent: 0, failed: 2 },
          },
        };
      }
      return { id: 'activity-new', status: 'logged' };
    });
    renderWithRoute(<CommunicationsPage />, {
      path: '/app/communications',
      initialEntry: '/app/communications',
    });
    await screen.findByText('Deniz Kaya');
    const user = userEvent.setup();
    const sendButton = await screen.findByRole('button', { name: 'Send via WhatsApp' });
    await user.click(sendButton);
    expect(await screen.findByText(/assisted fallback is ready/i)).toBeInTheDocument();
  });

  it('opens the original audience list with preserved filters from history', async () => {
    renderWithRoute(<CommunicationsPage />, {
      path: '/app/communications',
      initialEntry: '/app/communications',
    });

    const user = userEvent.setup();
    const historyTab = await screen.findByRole('button', { name: 'Recent follow-ups' });
    await user.click(historyTab);

    const financeActivity = await screen.findByText('Overdue payment — May dues');
    const financeRow = financeActivity.closest('li');
    expect(financeRow).toBeTruthy();
    const sourceLink = within(financeRow as HTMLElement).getByRole('link', {
      name: /Re-open the original list/i,
    });
    expect(sourceLink.getAttribute('href')).toContain('financialState=overdue');
    expect(sourceLink.getAttribute('href')).toContain('primaryContactsOnly=true');
    expect(sourceLink.getAttribute('href')).toContain('source=finance_overdue');
  });
});
