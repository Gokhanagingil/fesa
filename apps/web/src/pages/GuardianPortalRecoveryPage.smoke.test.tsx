import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuardianPortalRecoveryPage } from './GuardianPortalRecoveryPage';
import { renderWithRoute } from '../test/test-utils';
import type { TenantBrandingPayload } from '../lib/domain-types';

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

const brandKadikoy: TenantBrandingPayload = {
  tenantId: 'tenant-1',
  tenantName: 'Kadıköy Gençlik Spor',
  tenantSlug: 'kadikoy-genc-spor',
  displayName: 'Kadıköy Gençlik Spor',
  tagline: 'Aileye yakın, sporcuya odaklı.',
  primaryColor: '#0d4a3c',
  accentColor: '#1f8f6b',
  logoUrl: null,
  welcomeTitle: null,
  welcomeMessage: null,
  isCustomized: true,
  updatedAt: null,
};

beforeEach(() => {
  mockApiGet.mockReset();
  mockApiPost.mockReset();
});

describe('GuardianPortalRecoveryPage', () => {
  it('renders the calm recovery prompt and calls the recovery endpoint', async () => {
    mockApiGet.mockResolvedValueOnce([brandKadikoy]);
    mockApiPost.mockResolvedValueOnce({ submitted: true, helpMessageKey: 'portal.recovery.submitted' });

    renderWithRoute(<GuardianPortalRecoveryPage />, { path: '/portal/recover' });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/api/portal/tenants'));
    expect(await screen.findByText(/We're here to help/)).toBeInTheDocument();
    expect(screen.getByText(/Lost access to your family portal/)).toBeInTheDocument();

    const email = screen.getByLabelText(/Email/);
    fireEvent.change(email, { target: { value: 'parent@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Ask for help/ }));

    await waitFor(() =>
      expect(mockApiPost).toHaveBeenCalledWith('/api/guardian-portal/recover', {
        email: 'parent@example.com',
        tenantId: 'tenant-1',
      }),
    );
    expect(await screen.findByText(/Thanks — we let your club know/)).toBeInTheDocument();
  });
});
