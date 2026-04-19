/**
 * Inventory & Assignment Pack v1 — demo seed.
 *
 * Layered on top of the base/expansion demo seeds. Adds a small but
 * believable inventory footprint per club so the inventory surface does
 * not feel empty during product walkthroughs:
 *   - 1 numbered match jersey (variants by size)
 *   - 1 sweatshirt (variants by size, one low-stock)
 *   - 1 pooled training balls bucket
 *   - 1 pooled cones bucket (intentionally low stock)
 * A few athletes from each club receive an open assignment so the
 * athlete detail integration shows real data.
 *
 * Idempotent: every row id is derived from a stable digest of
 * (club.slug, kind, key) so re-running upserts in place.
 */
import { createHash } from 'crypto';
import { DataSource, IsNull, Repository } from 'typeorm';
import {
  Athlete,
  InventoryAssignment,
  InventoryItem,
  InventoryMovement,
  InventoryVariant,
  Tenant,
} from '../entities';
import { InventoryCategory, InventoryMovementType } from '../enums';
import { CLUB_IDS, CLUB_SLUGS } from './constants';

function stableId(...parts: string[]): string {
  const digest = createHash('sha256').update(JSON.stringify(parts)).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(
    16,
    20,
  )}-${hex.slice(20, 32)}`;
}

interface VariantSeed {
  key: string;
  size?: string | null;
  number?: string | null;
  color?: string | null;
  isDefault?: boolean;
  initialStock: number;
  lowStockThreshold?: number | null;
  /** Number of athlete assignments to create from this variant (uses available demo athletes). */
  assignTo?: number;
}

interface ItemSeed {
  key: string;
  name: string;
  category: InventoryCategory;
  hasVariants: boolean;
  trackAssignment: boolean;
  lowStockThreshold: number;
  description: string;
  variants: VariantSeed[];
}

const ITEM_BLUEPRINTS: ItemSeed[] = [
  {
    key: 'match-jersey',
    name: 'Match jersey',
    category: InventoryCategory.APPAREL,
    hasVariants: true,
    trackAssignment: true,
    lowStockThreshold: 2,
    description: 'Numbered match jerseys handed out to first-team athletes.',
    variants: [
      { key: 'm-7', size: 'M', number: '7', initialStock: 1, assignTo: 1 },
      { key: 'm-9', size: 'M', number: '9', initialStock: 1, assignTo: 1 },
      { key: 'l-10', size: 'L', number: '10', initialStock: 1, assignTo: 1 },
      { key: 'l-12', size: 'L', number: '12', initialStock: 1, assignTo: 1 },
      { key: 'xl-14', size: 'XL', number: '14', initialStock: 1, assignTo: 0 },
    ],
  },
  {
    key: 'club-sweatshirt',
    name: 'Club sweatshirt',
    category: InventoryCategory.APPAREL,
    hasVariants: true,
    trackAssignment: true,
    lowStockThreshold: 3,
    description: 'Pooled stock with athlete check-out tracking.',
    variants: [
      { key: 's', size: 'S', initialStock: 6, assignTo: 1 },
      { key: 'm', size: 'M', initialStock: 4, assignTo: 1 },
      { key: 'l', size: 'L', initialStock: 2, lowStockThreshold: 3, assignTo: 1 },
      { key: 'xl', size: 'XL', initialStock: 1, lowStockThreshold: 2, assignTo: 0 },
    ],
  },
  {
    key: 'training-balls',
    name: 'Training balls',
    category: InventoryCategory.BALLS,
    hasVariants: false,
    trackAssignment: false,
    lowStockThreshold: 4,
    description: 'Shared training balls used across age groups.',
    variants: [
      { key: 'default', isDefault: true, initialStock: 18 },
    ],
  },
  {
    key: 'cones',
    name: 'Cones',
    category: InventoryCategory.EQUIPMENT,
    hasVariants: false,
    trackAssignment: false,
    lowStockThreshold: 12,
    description: 'Coaching cones used in drills.',
    variants: [
      { key: 'default', isDefault: true, initialStock: 8 },
    ],
  },
  {
    key: 'training-bibs',
    name: 'Training bibs',
    category: InventoryCategory.GEAR,
    hasVariants: false,
    trackAssignment: false,
    lowStockThreshold: 6,
    description: 'Pooled coloured bibs for drills.',
    variants: [
      { key: 'default', isDefault: true, initialStock: 14 },
    ],
  },
];

async function ensureItem(
  itemRepo: Repository<InventoryItem>,
  variantRepo: Repository<InventoryVariant>,
  movementRepo: Repository<InventoryMovement>,
  tenantId: string,
  clubSlug: string,
  blueprint: ItemSeed,
): Promise<{ item: InventoryItem; variants: Map<string, InventoryVariant> }> {
  const itemId = stableId(clubSlug, 'inventory.item', blueprint.key);
  let item = await itemRepo.findOne({ where: { id: itemId, tenantId } });
  if (!item) {
    item = itemRepo.create({
      id: itemId,
      tenantId,
      name: blueprint.name,
      category: blueprint.category,
      sportBranchId: null,
      hasVariants: blueprint.hasVariants,
      trackAssignment: blueprint.trackAssignment,
      lowStockThreshold: blueprint.lowStockThreshold,
      description: blueprint.description,
      isActive: true,
    });
  } else {
    item.name = blueprint.name;
    item.category = blueprint.category;
    item.hasVariants = blueprint.hasVariants;
    item.trackAssignment = blueprint.trackAssignment;
    item.lowStockThreshold = blueprint.lowStockThreshold;
    item.description = blueprint.description;
    item.isActive = true;
  }
  await itemRepo.save(item);

  const variantMap = new Map<string, InventoryVariant>();
  for (const variantSeed of blueprint.variants) {
    const variantId = stableId(clubSlug, 'inventory.variant', blueprint.key, variantSeed.key);
    let variant = await variantRepo.findOne({ where: { id: variantId, tenantId } });
    const wasNew = !variant;
    if (!variant) {
      variant = variantRepo.create({
        id: variantId,
        tenantId,
        inventoryItemId: itemId,
        size: variantSeed.size ?? null,
        number: variantSeed.number ?? null,
        color: variantSeed.color ?? null,
        isDefault: Boolean(variantSeed.isDefault),
        stockOnHand: variantSeed.initialStock,
        assignedCount: 0,
        lowStockThreshold:
          variantSeed.lowStockThreshold === undefined ? null : variantSeed.lowStockThreshold,
        isActive: true,
      });
    } else {
      variant.size = variantSeed.size ?? null;
      variant.number = variantSeed.number ?? null;
      variant.color = variantSeed.color ?? null;
      variant.isDefault = Boolean(variantSeed.isDefault);
      variant.lowStockThreshold =
        variantSeed.lowStockThreshold === undefined ? null : variantSeed.lowStockThreshold;
      variant.isActive = true;
      // Keep stock at initial value if no movements yet (idempotent baseline)
      if (variant.stockOnHand !== variantSeed.initialStock) {
        variant.stockOnHand = variantSeed.initialStock;
      }
    }
    await variantRepo.save(variant);
    variantMap.set(variantSeed.key, variant);

    if (wasNew && variantSeed.initialStock > 0) {
      await movementRepo.save(
        movementRepo.create({
          id: stableId(clubSlug, 'inventory.movement.initial', blueprint.key, variantSeed.key),
          tenantId,
          inventoryItemId: itemId,
          inventoryVariantId: variant.id,
          type: InventoryMovementType.STOCK_ADDED,
          quantity: variantSeed.initialStock,
          athleteId: null,
          note: 'Initial demo stock',
          createdByStaffUserId: null,
        }),
      );
    }
  }
  return { item, variants: variantMap };
}

async function ensureAssignments(
  assignmentRepo: Repository<InventoryAssignment>,
  movementRepo: Repository<InventoryMovement>,
  variantRepo: Repository<InventoryVariant>,
  tenantId: string,
  clubSlug: string,
  blueprint: ItemSeed,
  variants: Map<string, InventoryVariant>,
  candidateAthletes: Athlete[],
): Promise<void> {
  let athleteCursor = 0;
  for (const variantSeed of blueprint.variants) {
    if (!variantSeed.assignTo || variantSeed.assignTo <= 0) continue;
    const variant = variants.get(variantSeed.key);
    if (!variant) continue;
    for (let n = 0; n < variantSeed.assignTo; n += 1) {
      if (athleteCursor >= candidateAthletes.length) break;
      const athlete = candidateAthletes[athleteCursor];
      athleteCursor += 1;
      const assignmentId = stableId(
        clubSlug,
        'inventory.assignment',
        blueprint.key,
        variantSeed.key,
        athlete.id,
      );
      let assignment = await assignmentRepo.findOne({ where: { id: assignmentId, tenantId } });
      if (!assignment) {
        assignment = assignmentRepo.create({
          id: assignmentId,
          tenantId,
          inventoryItemId: variant.inventoryItemId,
          inventoryVariantId: variant.id,
          athleteId: athlete.id,
          quantity: 1,
          assignedAt: new Date(Date.now() - (n + 1) * 5 * 24 * 60 * 60 * 1000),
          returnedAt: null,
          notes: 'Demo assignment',
        });
        await assignmentRepo.save(assignment);
        await movementRepo.save(
          movementRepo.create({
            id: stableId(
              clubSlug,
              'inventory.movement.assign',
              blueprint.key,
              variantSeed.key,
              athlete.id,
            ),
            tenantId,
            inventoryItemId: variant.inventoryItemId,
            inventoryVariantId: variant.id,
            type: InventoryMovementType.ASSIGNED,
            quantity: 1,
            athleteId: athlete.id,
            note: 'Demo assignment',
            createdByStaffUserId: null,
          }),
        );
      }
    }
    // Recompute open-assignment count for the variant.
    const openCount = await assignmentRepo.count({
      where: { tenantId, inventoryVariantId: variant.id, returnedAt: IsNull() },
    });
    variant.assignedCount = openCount;
    await variantRepo.save(variant);
  }
}

export async function runInventoryDemoSeed(dataSource: DataSource): Promise<void> {
  await dataSource.transaction(async (manager) => {
    const tenantRepo = manager.getRepository(Tenant);
    const itemRepo = manager.getRepository(InventoryItem);
    const variantRepo = manager.getRepository(InventoryVariant);
    const assignmentRepo = manager.getRepository(InventoryAssignment);
    const movementRepo = manager.getRepository(InventoryMovement);
    const athleteRepo = manager.getRepository(Athlete);

    for (const clubKey of Object.keys(CLUB_IDS) as Array<keyof typeof CLUB_IDS>) {
      const tenantId = CLUB_IDS[clubKey];
      const clubSlug = CLUB_SLUGS[clubKey];
      const tenant = await tenantRepo.findOne({ where: { id: tenantId } });
      if (!tenant) continue;

      const candidateAthletes = await athleteRepo.find({
        where: { tenantId },
        order: { lastName: 'ASC', firstName: 'ASC' },
        take: 20,
      });

      for (const blueprint of ITEM_BLUEPRINTS) {
        const { variants } = await ensureItem(
          itemRepo,
          variantRepo,
          movementRepo,
          tenantId,
          clubSlug,
          blueprint,
        );
        if (candidateAthletes.length > 0) {
          await ensureAssignments(
            assignmentRepo,
            movementRepo,
            variantRepo,
            tenantId,
            clubSlug,
            blueprint,
            variants,
            candidateAthletes,
          );
        }
      }
    }
  });
}
