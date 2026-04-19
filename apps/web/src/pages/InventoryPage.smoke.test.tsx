import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryPage } from './InventoryPage';
import { renderWithRoute } from '../test/test-utils';
import type {
  InventoryItemDetailResponse,
  InventoryListResponse,
} from '../lib/domain-types';

const mockUseTenant = vi.fn();
vi.mock('../lib/tenant-hooks', () => ({
  useTenant: () => mockUseTenant(),
}));

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPatch = vi.fn();
const mockApiDelete = vi.fn();
vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    apiGet: (...args: Parameters<typeof actual.apiGet>) => mockApiGet(...args),
    apiPost: (...args: Parameters<typeof actual.apiPost>) => mockApiPost(...args),
    apiPatch: (...args: Parameters<typeof actual.apiPatch>) => mockApiPatch(...args),
    apiDelete: (...args: Parameters<typeof actual.apiDelete>) => mockApiDelete(...args),
  };
});

function makeListResponse(): InventoryListResponse {
  return {
    items: [
      {
        id: 'item-1',
        name: 'Match jersey',
        category: 'apparel',
        sportBranchId: null,
        sportBranchName: null,
        hasVariants: true,
        trackAssignment: true,
        description: 'Demo description',
        isActive: true,
        lowStockThreshold: 2,
        totalStock: 5,
        totalAssigned: 1,
        totalAvailable: 4,
        variantCount: 2,
        lowStockVariantCount: 1,
        outOfStockVariantCount: 0,
        activeAssignmentCount: 1,
        variants: [],
        createdAt: '2026-04-01T10:00:00.000Z',
        updatedAt: '2026-04-10T10:00:00.000Z',
      },
    ],
    total: 1,
    counts: {
      activeItems: 1,
      inactiveItems: 0,
      lowStockItems: 1,
      outOfStockItems: 0,
      totalAssignments: 1,
      byCategory: {
        apparel: 1,
        balls: 0,
        equipment: 0,
        gear: 0,
        other: 0,
      },
    },
  };
}

function makeDetailResponse(): InventoryItemDetailResponse {
  return {
    item: {
      id: 'item-1',
      name: 'Match jersey',
      category: 'apparel',
      sportBranchId: null,
      sportBranchName: null,
      hasVariants: true,
      trackAssignment: true,
      description: 'Demo description',
      isActive: true,
      lowStockThreshold: 2,
      totalStock: 5,
      totalAssigned: 1,
      totalAvailable: 4,
      variantCount: 2,
      lowStockVariantCount: 1,
      outOfStockVariantCount: 0,
      activeAssignmentCount: 1,
      variants: [
        {
          id: 'variant-1',
          inventoryItemId: 'item-1',
          size: 'M',
          number: '7',
          color: null,
          isDefault: false,
          stockOnHand: 3,
          assignedCount: 1,
          available: 2,
          effectiveLowStockThreshold: 2,
          isLowStock: true,
          isOutOfStock: false,
          isActive: true,
        },
      ],
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-10T10:00:00.000Z',
    },
    activeAssignments: [
      {
        id: 'assignment-1',
        inventoryItemId: 'item-1',
        inventoryItemName: 'Match jersey',
        inventoryItemCategory: 'apparel',
        inventoryVariantId: 'variant-1',
        variantLabel: 'M · #7',
        size: 'M',
        number: '7',
        color: null,
        athleteId: 'athlete-1',
        athleteName: 'Kaya, Deniz',
        athletePrimaryGroupId: null,
        quantity: 1,
        assignedAt: '2026-04-10T10:00:00.000Z',
        returnedAt: null,
        isOpen: true,
        notes: null,
      },
    ],
    recentMovements: [
      {
        id: 'movement-1',
        inventoryItemId: 'item-1',
        inventoryItemName: 'Match jersey',
        inventoryVariantId: 'variant-1',
        variantLabel: 'M · #7',
        type: 'assigned',
        quantity: 1,
        athleteId: 'athlete-1',
        athleteName: 'Kaya, Deniz',
        note: 'Demo assignment',
        createdAt: '2026-04-10T10:00:00.000Z',
      },
    ],
  };
}

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
  mockApiGet.mockImplementation(async (path: string) => {
    if (path.startsWith('/api/inventory/items/item-1')) return makeDetailResponse();
    if (path.startsWith('/api/inventory/items')) return makeListResponse();
    if (path.startsWith('/api/sport-branches')) return [];
    if (path.startsWith('/api/athletes')) {
      return {
        items: [
          {
            id: 'athlete-1',
            firstName: 'Deniz',
            lastName: 'Kaya',
            preferredName: null,
            birthDate: null,
            gender: null,
            sportBranchId: 'branch-1',
            primaryGroupId: null,
            status: 'active',
            jerseyNumber: null,
            shirtSize: null,
            notes: null,
          },
        ],
      };
    }
    return null;
  });
  mockApiPost.mockResolvedValue({ id: 'new' });
});

describe('InventoryPage smoke coverage', () => {
  it('renders the inventory list with low-stock signals', async () => {
    renderWithRoute(<InventoryPage />, {
      path: '/app/inventory',
      initialEntry: '/app/inventory',
    });

    expect(await screen.findByText('Match jersey')).toBeInTheDocument();
    expect(await screen.findByText(/Low stock/i)).toBeInTheDocument();
  });

  it('opens the detail panel and shows the assignment workflow surfaces', async () => {
    renderWithRoute(<InventoryPage />, {
      path: '/app/inventory',
      initialEntry: '/app/inventory',
    });

    const user = userEvent.setup();
    const openButton = await screen.findByRole('button', { name: /Open details/i });
    await user.click(openButton);

    expect(await screen.findByText(/Assign to athlete/i)).toBeInTheDocument();
    expect(await screen.findByText(/Currently assigned/i)).toBeInTheDocument();
    expect(await screen.findByText(/Recent movements/i)).toBeInTheDocument();
    await waitFor(() => {
      const calls = mockApiGet.mock.calls.map((args) => String(args[0]));
      expect(calls.some((path) => path.includes('/api/inventory/items/item-1'))).toBe(true);
    });
  });

  it('exposes a refresh action that re-fetches the inventory list', async () => {
    renderWithRoute(<InventoryPage />, {
      path: '/app/inventory',
      initialEntry: '/app/inventory',
    });

    const user = userEvent.setup();
    const refreshButton = await screen.findByRole('button', { name: /Refresh/i });
    const callsBefore = mockApiGet.mock.calls.length;
    await user.click(refreshButton);
    await waitFor(() => {
      expect(mockApiGet.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });
});
