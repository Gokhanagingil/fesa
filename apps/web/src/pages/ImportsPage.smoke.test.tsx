import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportsPage } from './ImportsPage';
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
const mockPreviewImport = vi.fn();
const mockCommitImport = vi.fn();
vi.mock('../lib/imports', async () => {
  const actual = await vi.importActual<typeof import('../lib/imports')>('../lib/imports');
  return {
    ...actual,
    fetchImportDefinitions: () => mockFetchDefinitions(),
    previewImport: (...args: Parameters<typeof actual.previewImport>) =>
      mockPreviewImport(...args),
    commitImport: (...args: Parameters<typeof actual.commitImport>) => mockCommitImport(...args),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mockUseTenant.mockReturnValue({
    tenants: [{ id: 'tenant-1', name: 'Demo', slug: 'demo', role: 'club_admin' }],
    tenantId: 'tenant-1',
    setTenantId: vi.fn(),
    loading: false,
    error: null,
    refresh: vi.fn(),
  });
  mockApiGet.mockResolvedValue([]);
  mockFetchDefinitions.mockResolvedValue([
    {
      entity: 'guardians',
      labelKey: 'pages.imports.entities.guardians.title',
      descriptionKey: 'pages.imports.entities.guardians.description',
      sample: [],
      fields: [
        {
          key: 'firstName',
          labelKey: 'pages.imports.fields.guardians.firstName',
          required: true,
          type: 'string',
          aliases: ['firstname', 'first name', 'ad'],
          maxLength: 120,
        },
        {
          key: 'lastName',
          labelKey: 'pages.imports.fields.guardians.lastName',
          required: true,
          type: 'string',
          aliases: ['lastname', 'last name', 'soyad'],
          maxLength: 120,
        },
        {
          key: 'phone',
          labelKey: 'pages.imports.fields.guardians.phone',
          required: false,
          type: 'phone',
          aliases: ['phone', 'telefon'],
          maxLength: 32,
        },
      ],
    },
  ]);
  mockPreviewImport.mockResolvedValue({
    entity: 'guardians',
    counts: {
      total: 1,
      createReady: 1,
      updateReady: 0,
      skipReady: 0,
      rejected: 0,
      warnings: 0,
    },
    rows: [
      {
        rowNumber: 2,
        outcome: 'create',
        resolved: { firstName: 'Ayşe', lastName: 'Yıldız', phone: '5550001122' },
        displayLabel: 'Ayşe Yıldız',
        issues: [],
      },
    ],
    missingRequired: [],
    canCommit: true,
    hints: [],
  });
});

describe('ImportsPage smoke coverage', () => {
  it('loads definitions and walks through preview', async () => {
    renderWithRoute(<ImportsPage />, {
      path: '/app/imports',
      initialEntry: '/app/imports',
    });

    const user = userEvent.setup();
    const guardiansButton = await screen.findByRole('button', { name: /Guardians/i });
    await user.click(guardiansButton);

    const csv = ['firstName,lastName,phone', 'Ayşe,Yıldız,5550001122'].join('\n');
    const textarea = await screen.findByLabelText(/CSV content/i);
    fireEvent.change(textarea, { target: { value: csv } });

    const parseButton = await screen.findByRole('button', { name: /Read rows/i });
    await user.click(parseButton);

    await waitFor(() => {
      expect(screen.getByText(/Map your columns/i)).toBeInTheDocument();
    });

    const previewButton = await screen.findByRole('button', { name: /Preview validation/i });
    await user.click(previewButton);

    await waitFor(() => {
      expect(mockPreviewImport).toHaveBeenCalled();
    });
    expect(await screen.findByText(/Ayşe Yıldız/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Import these rows/i })).toBeEnabled();
  });
});
