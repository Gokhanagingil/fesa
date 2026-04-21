import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuardianPortalActivationPage } from './GuardianPortalActivationPage';
import { renderWithRoute } from '../test/test-utils';
import { ApiError } from '../lib/api';
import type { GuardianPortalActivationStatus } from '../lib/domain-types';

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

function makeStatus(
  overrides: Partial<GuardianPortalActivationStatus> = {},
): GuardianPortalActivationStatus {
  return {
    token: 'abc123',
    tenantId: 'tenant-1',
    tenantName: 'Kadıköy Gençlik Spor Kulübü',
    guardianId: 'g-1',
    guardianName: 'Ayşe Kaya',
    email: 'ayse@example.com',
    expiresAt: '2026-05-20T08:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockApiGet.mockReset();
  mockApiPost.mockReset();
});

describe('GuardianPortalActivationPage', () => {
  it('renders the calm activation form for a valid invite token', async () => {
    mockApiGet.mockResolvedValueOnce(makeStatus());

    renderWithRoute(<GuardianPortalActivationPage />, {
      path: '/portal/activate',
      initialEntry: '/portal/activate?token=abc123',
    });

    await waitFor(() =>
      expect(mockApiGet).toHaveBeenCalledWith('/api/guardian-portal/activate/abc123'),
    );
    // Identity summary should appear so the parent can confirm this
    // invite is for them and for the right club before setting a
    // password.
    expect(await screen.findByText('Ayşe Kaya')).toBeInTheDocument();
    // Tenant name appears both in the header brand block and the
    // identity card; we only need to know it surfaced somewhere.
    expect(screen.getAllByText(/Kadıköy Gençlik Spor Kulübü/).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Create a password/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm password/)).toBeInTheDocument();
  });

  it('exposes recovery and sign-in escapes when the invite link is invalid', async () => {
    // No `token=` query string at all is the simplest "dead invite"
    // case (e.g. parent pasted only the prefix). Previously this left
    // the parent at a card with no way out other than the brand link;
    // we now offer an explicit Recover / Sign-in pair.
    renderWithRoute(<GuardianPortalActivationPage />, {
      path: '/portal/activate',
      initialEntry: '/portal/activate',
    });

    expect(
      await screen.findByText(/This invite link is no longer valid/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Recover an existing account/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sign in/ })).toBeInTheDocument();
  });

  it('shows the calmer expired-link copy when the API tags the failure as expired', async () => {
    // Parent Access Stabilization Pass — the API now distinguishes
    // expired vs invalid via a stable error code so the page can pick
    // warmer wording instead of always saying "no longer valid".
    mockApiGet.mockRejectedValueOnce(
      new ApiError(401, 'Invite link has expired', 'invite_link_expired'),
    );

    renderWithRoute(<GuardianPortalActivationPage />, {
      path: '/portal/activate',
      initialEntry: '/portal/activate?token=abc123',
    });

    expect(
      await screen.findByText(/This invite link has expired/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Ask your club for a fresh link/)).toBeInTheDocument();
    // The two warm escape paths must remain available so the parent is
    // never stranded on this surface.
    expect(screen.getByRole('link', { name: /Recover an existing account/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sign in/ })).toBeInTheDocument();
  });

  it('shows the paused-access copy when the API tags the failure as disabled', async () => {
    mockApiGet.mockRejectedValueOnce(
      new ApiError(401, 'Portal access is paused by the club', 'portal_access_disabled'),
    );

    renderWithRoute(<GuardianPortalActivationPage />, {
      path: '/portal/activate',
      initialEntry: '/portal/activate?token=abc123',
    });

    expect(
      await screen.findByText(/Your family portal access is paused right now/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Use the recovery form to let your club know/)).toBeInTheDocument();
  });

  it('submits the new password and lands the parent on the portal home', async () => {
    mockApiGet.mockResolvedValueOnce(makeStatus());
    mockApiPost.mockResolvedValueOnce({});

    renderWithRoute(<GuardianPortalActivationPage />, {
      path: '/portal/activate',
      initialEntry: '/portal/activate?token=abc123',
    });

    await screen.findByText('Ayşe Kaya');

    fireEvent.change(screen.getByLabelText(/Create a password/), {
      target: { value: 'familySetup8' },
    });
    fireEvent.change(screen.getByLabelText(/Confirm password/), {
      target: { value: 'familySetup8' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Activate my access/ }));

    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith('/api/guardian-portal/activate/abc123', {
        password: 'familySetup8',
      }),
    );
  });
});
