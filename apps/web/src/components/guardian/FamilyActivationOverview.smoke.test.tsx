import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FamilyActivationOverview } from './FamilyActivationOverview';
import { renderWithRoute } from '../../test/test-utils';

const mockUseTenant = vi.fn();
vi.mock('../../lib/tenant-hooks', () => ({
  useTenant: () => mockUseTenant(),
}));

const mockApiGet = vi.fn();
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return {
    ...actual,
    apiGet: (...args: Parameters<typeof actual.apiGet>) => mockApiGet(...args),
  };
});

beforeEach(() => {
  mockUseTenant.mockReset();
  mockApiGet.mockReset();
  mockUseTenant.mockReturnValue({ tenantId: 'tenant-1', loading: false });
});

describe('FamilyActivationOverview', () => {
  it('renders the calm totals strip and lets staff switch buckets', async () => {
    mockApiGet.mockResolvedValueOnce({
      tenantId: 'tenant-1',
      generatedAt: '2026-04-20T12:00:00.000Z',
      thresholds: { dormantAfterDays: 60, staleInviteAfterDays: 7 },
      totals: {
        guardians: 12,
        guardiansWithAccess: 10,
        notInvited: 2,
        invited: 3,
        active: 5,
        dormant: 1,
        recovery: 1,
        disabled: 0,
        recentlyActivated: 4,
        staleInvites: 1,
        activationRatePercent: 60,
      },
      buckets: {
        notInvited: {
          count: 2,
          items: [
            {
              guardianId: 'g-1',
              guardianName: 'Ayşe Kaya',
              email: 'ayse@example.com',
              linkedAthletes: 1,
              inviteAgeDays: null,
              lastSeenAgeDays: null,
              status: null,
            },
          ],
        },
        invited: {
          count: 3,
          items: [
            {
              guardianId: 'g-2',
              guardianName: 'Mert Yıldız',
              email: 'mert@example.com',
              linkedAthletes: 2,
              inviteAgeDays: 9,
              lastSeenAgeDays: null,
              status: 'invited',
            },
          ],
        },
        active: { count: 5, items: [] },
        dormant: { count: 1, items: [] },
        recovery: {
          count: 1,
          items: [
            {
              guardianId: 'g-3',
              guardianName: 'Hakan Demir',
              email: 'hakan@example.com',
              linkedAthletes: 1,
              inviteAgeDays: null,
              lastSeenAgeDays: null,
              status: 'active',
              recoveryRequestedAt: '2026-04-19T08:00:00.000Z',
              recoveryRequestCount: 2,
            },
          ],
        },
        disabled: { count: 0, items: [] },
      },
    });

    renderWithRoute(<FamilyActivationOverview />);

    await waitFor(() =>
      expect(screen.getByText(/Where do families stand right now/)).toBeInTheDocument(),
    );
    expect(screen.getAllByText('Inside the portal').length).toBeGreaterThan(0);
    // Recovery bucket is the default-active tab and should show its row.
    expect(screen.getByText('Hakan Demir')).toBeInTheDocument();
    expect(screen.getByText(/Asked for help on/)).toBeInTheDocument();
    // The follow-up prepare button surfaces the total of follow-up
    // buckets (recovery + invited + notInvited + dormant = 1+3+2+1 = 7).
    expect(screen.getByRole('button', { name: /Prepare reminder for 7/ })).toBeInTheDocument();
  });
});
