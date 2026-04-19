import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AthletePhotoCard } from './AthletePhotoCard';
import { renderWithRoute } from '../../test/test-utils';
import type { Athlete } from '../../lib/domain-types';

function makeAthlete(overrides: Partial<Athlete> = {}): Athlete {
  return {
    id: 'athlete-1',
    firstName: 'Deniz',
    lastName: 'Kaya',
    preferredName: null,
    birthDate: null,
    gender: null,
    sportBranchId: 'sport-1',
    primaryGroupId: null,
    status: 'active',
    jerseyNumber: null,
    shirtSize: null,
    notes: null,
    photoFileName: null,
    photoContentType: null,
    photoSizeBytes: null,
    photoUploadedAt: null,
    ...overrides,
  };
}

describe('AthletePhotoCard smoke', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
    localStorage.setItem('amateur.tenantId', 'tenant-1');
  });

  it('shows an empty state with an Upload action and posts the chosen file', async () => {
    const handleChanged = vi.fn();
    fetchSpy.mockResolvedValue(
      new Response(
        JSON.stringify(
          makeAthlete({
            photoFileName: 'abc.jpg',
            photoContentType: 'image/jpeg',
            photoSizeBytes: 1024,
            photoUploadedAt: '2026-04-19T10:00:00.000Z',
          }),
        ),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    renderWithRoute(<AthletePhotoCard athlete={makeAthlete()} onChanged={handleChanged} />);

    expect(screen.getByText('Add a profile photo')).toBeInTheDocument();
    const uploadButton = screen.getByRole('button', { name: 'Upload photo' });
    expect(uploadButton).toBeEnabled();

    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'photo.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();

    const user = userEvent.setup();
    await user.upload(input, file);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/athletes/athlete-1/photo');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['X-Tenant-Id']).toBe('tenant-1');
    expect(handleChanged).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Photo added.')).toBeInTheDocument();
  });

  it('shows Replace + Remove actions and removes the existing photo', async () => {
    const handleChanged = vi.fn();
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(makeAthlete()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWithRoute(
      <AthletePhotoCard
        athlete={makeAthlete({
          photoFileName: 'abc.jpg',
          photoContentType: 'image/jpeg',
          photoUploadedAt: '2026-04-19T10:00:00.000Z',
        })}
        onChanged={handleChanged}
      />,
    );

    expect(screen.getByText('Profile photo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Replace photo' })).toBeInTheDocument();
    const removeButton = screen.getByRole('button', { name: 'Remove photo' });

    const user = userEvent.setup();
    await user.click(removeButton);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(init?.method).toBe('DELETE');
    expect(handleChanged).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Photo removed.')).toBeInTheDocument();
  });

  it('rejects an oversized file before posting', async () => {
    const handleChanged = vi.fn();
    renderWithRoute(<AthletePhotoCard athlete={makeAthlete()} onChanged={handleChanged} />);

    const oversize = new File([new Uint8Array(6 * 1024 * 1024)], 'huge.jpg', { type: 'image/jpeg' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    const user = userEvent.setup();
    await user.upload(input, oversize);

    expect(await screen.findByText('Photo is larger than 5 MB. Try a smaller image.')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(handleChanged).not.toHaveBeenCalled();
  });
});
