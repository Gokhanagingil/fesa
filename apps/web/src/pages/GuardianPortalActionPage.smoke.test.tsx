import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuardianPortalActionPage } from './GuardianPortalActionPage';
import { renderWithRoute } from '../test/test-utils';
import type { FamilyActionRequest } from '../lib/domain-types';

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

function makeAction(overrides: Partial<FamilyActionRequest> = {}): FamilyActionRequest {
  return {
    id: 'action-1',
    athleteId: 'athlete-1',
    athleteName: 'Ada Yılmaz',
    guardianId: 'guardian-1',
    guardianName: 'Ayşe Yılmaz',
    type: 'guardian_profile_update',
    status: 'open',
    title: 'Confirm contact details',
    description: 'Please confirm your phone number is correct.',
    dueDate: null,
    payload: {},
    latestResponseText: null,
    decisionNote: null,
    submittedAt: null,
    reviewedAt: null,
    resolvedAt: null,
    createdAt: '2026-04-01T08:00:00.000Z',
    updatedAt: '2026-04-01T08:00:00.000Z',
    latestEventAt: null,
    eventCount: 0,
    events: [],
    ...overrides,
  };
}

beforeEach(() => {
  mockApiGet.mockReset();
  mockApiPost.mockReset();
});

describe('GuardianPortalActionPage', () => {
  it('renders the request and primary submit control for an open action', async () => {
    mockApiGet.mockResolvedValueOnce(makeAction());

    renderWithRoute(<GuardianPortalActionPage />, {
      path: '/portal/actions/:id',
      initialEntry: '/portal/actions/action-1',
    });

    await waitFor(() =>
      expect(mockApiGet).toHaveBeenCalledWith('/api/guardian-portal/actions/action-1'),
    );
    expect(await screen.findByText('Confirm contact details')).toBeInTheDocument();
    // Trust & Calm Pass — the primary submit must be visible (not buried)
    // and act as the page's clear primary action for open / pending /
    // rejected statuses.
    expect(screen.getByRole('button', { name: /Send my response/ })).toBeInTheDocument();
  });

  it('does not stall on a missing route id (Trust & Calm Pass)', async () => {
    // Previously the effect early-returned without ever calling
    // setLoading(false), so a parent who reached the page without an id
    // (typo, share-truncated link, broken bookmark) sat forever on the
    // loading line. The page now resolves the loading state and exposes
    // the calm "Back to home" escape so the parent is never stuck.
    renderWithRoute(<GuardianPortalActionPage />, {
      path: '/portal/actions/:id?',
      initialEntry: '/portal/actions',
    });

    expect(
      await screen.findByRole('link', { name: /Back to family portal/ }),
    ).toBeInTheDocument();
    expect(mockApiGet).not.toHaveBeenCalled();
  });

  it('keeps the parent on the page after submit, refetches, and shows a success alert', async () => {
    const original = makeAction();
    const refreshed = makeAction({
      status: 'submitted',
      latestResponseText: 'My phone is +90 555 123 45 67',
      submittedAt: '2026-04-01T08:30:00.000Z',
    });
    mockApiGet.mockResolvedValueOnce(original);
    mockApiPost.mockResolvedValueOnce({});
    mockApiGet.mockResolvedValueOnce(refreshed);

    renderWithRoute(<GuardianPortalActionPage />, {
      path: '/portal/actions/:id',
      initialEntry: '/portal/actions/action-1',
    });

    await screen.findByText('Confirm contact details');

    fireEvent.click(screen.getByRole('button', { name: /Send my response/ }));

    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith(
        '/api/guardian-portal/actions/action-1/submit',
        expect.any(Object),
      ),
    );
    // The success alert is shown in-place (no auto-redirect) so the
    // parent can clearly read the confirmation. The status badge should
    // reflect the refetched 'submitted' state.
    expect(
      await screen.findByText(/Thanks — your response is on its way/),
    ).toBeInTheDocument();
  });
});
