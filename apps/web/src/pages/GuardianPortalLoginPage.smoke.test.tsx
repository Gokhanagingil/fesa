import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuardianPortalLoginPage } from './GuardianPortalLoginPage';
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

beforeEach(() => {
  mockApiGet.mockReset();
  mockApiPost.mockReset();
});

const sampleBrand: TenantBrandingPayload = {
  tenantId: 'tenant-1',
  tenantName: 'Kadıköy Gençlik Spor Kulübü',
  tenantSlug: 'kadikoy-genc-spor',
  displayName: 'Kadıköy Gençlik Spor',
  tagline: 'Aileye yakın, sporcuya odaklı.',
  primaryColor: '#0d4a3c',
  accentColor: '#1f8f6b',
  logoUrl: null,
  welcomeTitle: 'Hoş geldiniz, Kadıköy ailesi',
  welcomeMessage: 'Bu portal yalnızca aileniz içindir.',
  isCustomized: true,
  updatedAt: '2026-04-19T08:00:00.000Z',
};

describe('GuardianPortalLoginPage', () => {
  it('renders the parent-facing login surface using the public branding endpoint', async () => {
    mockApiGet.mockResolvedValueOnce([sampleBrand]);

    renderWithRoute(<GuardianPortalLoginPage />, { path: '/portal/login' });

    await waitFor(() => expect(mockApiGet).toHaveBeenCalledWith('/api/portal/tenants'));
    expect(await screen.findByText(/Family sign in/)).toBeInTheDocument();
    expect(screen.getByText('Hoş geldiniz, Kadıköy ailesi')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Kadıköy Gençlik Spor' })).toBeInTheDocument();
    expect(screen.getByText(/no public sign-up/)).toBeInTheDocument();
  });
});
