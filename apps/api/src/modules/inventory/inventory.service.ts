import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, IsNull, Repository } from 'typeorm';
import { Athlete } from '../../database/entities/athlete.entity';
import { InventoryAssignment } from '../../database/entities/inventory-assignment.entity';
import { InventoryItem } from '../../database/entities/inventory-item.entity';
import { InventoryMovement } from '../../database/entities/inventory-movement.entity';
import { InventoryVariant } from '../../database/entities/inventory-variant.entity';
import { SportBranch } from '../../database/entities/sport-branch.entity';
import {
  InventoryCategory,
  InventoryMovementType,
} from '../../database/enums';
import { AdjustInventoryStockDto } from './dto/adjust-inventory-stock.dto';
import {
  AssignInventoryDto,
  ReturnInventoryAssignmentDto,
} from './dto/assign-inventory.dto';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { CreateInventoryVariantDto } from './dto/create-inventory-variant.dto';
import { ListInventoryItemsQueryDto } from './dto/list-inventory-items-query.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { UpdateInventoryVariantDto } from './dto/update-inventory-variant.dto';

export interface InventoryVariantSummary {
  id: string;
  inventoryItemId: string;
  size: string | null;
  number: string | null;
  color: string | null;
  isDefault: boolean;
  stockOnHand: number;
  assignedCount: number;
  available: number;
  effectiveLowStockThreshold: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
  isActive: boolean;
}

export interface InventoryItemSummary {
  id: string;
  name: string;
  category: InventoryCategory;
  sportBranchId: string | null;
  sportBranchName: string | null;
  hasVariants: boolean;
  trackAssignment: boolean;
  description: string | null;
  isActive: boolean;
  lowStockThreshold: number;
  totalStock: number;
  totalAssigned: number;
  totalAvailable: number;
  variantCount: number;
  lowStockVariantCount: number;
  outOfStockVariantCount: number;
  activeAssignmentCount: number;
  variants: InventoryVariantSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface InventoryListResponse {
  items: InventoryItemSummary[];
  total: number;
  counts: {
    activeItems: number;
    inactiveItems: number;
    lowStockItems: number;
    outOfStockItems: number;
    totalAssignments: number;
    byCategory: Record<InventoryCategory, number>;
  };
}

export interface InventoryAssignmentSummary {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  inventoryItemCategory: InventoryCategory;
  inventoryVariantId: string;
  variantLabel: string;
  size: string | null;
  number: string | null;
  color: string | null;
  athleteId: string;
  athleteName: string;
  athletePrimaryGroupId: string | null;
  quantity: number;
  assignedAt: string;
  returnedAt: string | null;
  isOpen: boolean;
  notes: string | null;
}

export interface InventoryMovementSummary {
  id: string;
  inventoryItemId: string;
  inventoryItemName: string;
  inventoryVariantId: string;
  variantLabel: string;
  type: InventoryMovementType;
  quantity: number;
  athleteId: string | null;
  athleteName: string | null;
  note: string | null;
  createdAt: string;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryItem)
    private readonly items: Repository<InventoryItem>,
    @InjectRepository(InventoryVariant)
    private readonly variants: Repository<InventoryVariant>,
    @InjectRepository(InventoryAssignment)
    private readonly assignments: Repository<InventoryAssignment>,
    @InjectRepository(InventoryMovement)
    private readonly movements: Repository<InventoryMovement>,
    @InjectRepository(Athlete)
    private readonly athletes: Repository<Athlete>,
    @InjectRepository(SportBranch)
    private readonly branches: Repository<SportBranch>,
    private readonly dataSource: DataSource,
  ) {}

  // —— Helpers ———————————————————————————————————————————————————————

  private buildVariantLabel(
    variant: Pick<InventoryVariant, 'size' | 'number' | 'color' | 'isDefault'>,
  ): string {
    if (variant.isDefault && !variant.size && !variant.number && !variant.color) {
      return 'Default';
    }
    const parts: string[] = [];
    if (variant.size) parts.push(variant.size);
    if (variant.number) parts.push(`#${variant.number}`);
    if (variant.color) parts.push(variant.color);
    return parts.length > 0 ? parts.join(' · ') : 'Default';
  }

  private summarizeVariant(
    variant: InventoryVariant,
    item: InventoryItem,
  ): InventoryVariantSummary {
    const effectiveThreshold =
      variant.lowStockThreshold !== null && variant.lowStockThreshold !== undefined
        ? variant.lowStockThreshold
        : item.lowStockThreshold;
    const available = Math.max(variant.stockOnHand - variant.assignedCount, 0);
    return {
      id: variant.id,
      inventoryItemId: variant.inventoryItemId,
      size: variant.size,
      number: variant.number,
      color: variant.color,
      isDefault: variant.isDefault,
      stockOnHand: variant.stockOnHand,
      assignedCount: variant.assignedCount,
      available,
      effectiveLowStockThreshold: effectiveThreshold,
      isLowStock: effectiveThreshold > 0 && available > 0 && available <= effectiveThreshold,
      isOutOfStock: variant.stockOnHand > 0 && available === 0,
      isActive: variant.isActive,
    };
  }

  private summarizeItem(
    item: InventoryItem,
    variants: InventoryVariant[],
    sportBranchName: string | null,
  ): InventoryItemSummary {
    const variantSummaries = variants
      .filter((variant) => variant.inventoryItemId === item.id)
      .sort((a, b) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? 1 : -1;
        const sizeA = a.size ?? '';
        const sizeB = b.size ?? '';
        if (sizeA !== sizeB) return sizeA.localeCompare(sizeB);
        const numberA = a.number ?? '';
        const numberB = b.number ?? '';
        return numberA.localeCompare(numberB);
      })
      .map((variant) => this.summarizeVariant(variant, item));

    const totalStock = variantSummaries.reduce((sum, v) => sum + v.stockOnHand, 0);
    const totalAssigned = variantSummaries.reduce((sum, v) => sum + v.assignedCount, 0);
    const totalAvailable = variantSummaries.reduce((sum, v) => sum + v.available, 0);

    return {
      id: item.id,
      name: item.name,
      category: item.category,
      sportBranchId: item.sportBranchId,
      sportBranchName,
      hasVariants: item.hasVariants,
      trackAssignment: item.trackAssignment,
      description: item.description,
      isActive: item.isActive,
      lowStockThreshold: item.lowStockThreshold,
      totalStock,
      totalAssigned,
      totalAvailable,
      variantCount: variantSummaries.length,
      lowStockVariantCount: variantSummaries.filter((v) => v.isLowStock).length,
      outOfStockVariantCount: variantSummaries.filter((v) => v.isOutOfStock).length,
      activeAssignmentCount: totalAssigned,
      variants: variantSummaries,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private async assertBranchScope(
    tenantId: string,
    sportBranchId: string | null | undefined,
  ): Promise<void> {
    if (!sportBranchId) return;
    const branch = await this.branches.findOne({ where: { id: sportBranchId, tenantId } });
    if (!branch) {
      throw new BadRequestException('sportBranchId does not belong to this tenant');
    }
  }

  private async loadItem(tenantId: string, id: string): Promise<InventoryItem> {
    const item = await this.items.findOne({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Inventory item not found');
    return item;
  }

  private async loadVariantsForItems(
    tenantId: string,
    itemIds: string[],
  ): Promise<InventoryVariant[]> {
    if (itemIds.length === 0) return [];
    return this.variants.find({
      where: { tenantId, inventoryItemId: In(itemIds) },
    });
  }

  private async loadVariant(tenantId: string, id: string): Promise<InventoryVariant> {
    const variant = await this.variants.findOne({ where: { id, tenantId } });
    if (!variant) throw new NotFoundException('Inventory variant not found');
    return variant;
  }

  private async recomputeAssignedCount(variantId: string): Promise<number> {
    const row = await this.assignments
      .createQueryBuilder('assignment')
      .select('COALESCE(SUM(assignment.quantity), 0)', 'total')
      .where('assignment.inventoryVariantId = :variantId', { variantId })
      .andWhere('assignment.returnedAt IS NULL')
      .getRawOne<{ total: string }>();
    const total = Number(row?.total ?? 0);
    await this.variants.update({ id: variantId }, { assignedCount: total });
    return total;
  }

  private async logMovement(
    tenantId: string,
    item: InventoryItem,
    variant: InventoryVariant,
    type: InventoryMovementType,
    quantity: number,
    options: {
      athleteId?: string | null;
      note?: string | null;
      createdByStaffUserId?: string | null;
    } = {},
  ): Promise<InventoryMovement> {
    const movement = this.movements.create({
      tenantId,
      inventoryItemId: item.id,
      inventoryVariantId: variant.id,
      type,
      quantity,
      athleteId: options.athleteId ?? null,
      note: options.note ?? null,
      createdByStaffUserId: options.createdByStaffUserId ?? null,
    });
    return this.movements.save(movement);
  }

  // —— Catalog (items) ————————————————————————————————————————————————

  async listItems(
    tenantId: string,
    query: ListInventoryItemsQueryDto,
  ): Promise<InventoryListResponse> {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);

    const qb = this.items.createQueryBuilder('item').where('item.tenantId = :tenantId', { tenantId });
    if (query.category) {
      qb.andWhere('item.category = :category', { category: query.category });
    }
    if (query.sportBranchId) {
      qb.andWhere('item.sportBranchId = :sportBranchId', { sportBranchId: query.sportBranchId });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('item.isActive = :isActive', { isActive: query.isActive });
    }
    if (query.q?.trim()) {
      const term = `%${query.q.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('LOWER(item.name) LIKE :term', { term }).orWhere(
            'LOWER(COALESCE(item.description, \'\')) LIKE :term',
            { term },
          );
        }),
      );
    }

    const total = await qb.clone().getCount();
    const items = await qb.orderBy('item.name', 'ASC').offset(offset).limit(limit).getMany();

    const itemIds = items.map((item) => item.id);
    const allVariants = await this.loadVariantsForItems(tenantId, itemIds);

    const branchIds = Array.from(
      new Set(items.map((item) => item.sportBranchId).filter((id): id is string => Boolean(id))),
    );
    const branches = branchIds.length
      ? await this.branches.find({ where: { id: In(branchIds), tenantId } })
      : [];
    const branchMap = new Map(branches.map((branch) => [branch.id, branch.name]));

    let summaries = items.map((item) =>
      this.summarizeItem(item, allVariants, item.sportBranchId ? branchMap.get(item.sportBranchId) ?? null : null),
    );

    if (query.lowStockOnly) {
      summaries = summaries.filter(
        (item) => item.lowStockVariantCount > 0 || item.outOfStockVariantCount > 0,
      );
    }

    const allItemsForCounts = await this.items.find({ where: { tenantId } });
    const allVariantsForCounts = await this.loadVariantsForItems(
      tenantId,
      allItemsForCounts.map((item) => item.id),
    );
    const fullSummaries = allItemsForCounts.map((item) =>
      this.summarizeItem(item, allVariantsForCounts, null),
    );
    const byCategory: Record<InventoryCategory, number> = {
      [InventoryCategory.APPAREL]: 0,
      [InventoryCategory.BALLS]: 0,
      [InventoryCategory.EQUIPMENT]: 0,
      [InventoryCategory.GEAR]: 0,
      [InventoryCategory.OTHER]: 0,
    };
    fullSummaries.forEach((summary) => {
      byCategory[summary.category] = (byCategory[summary.category] ?? 0) + 1;
    });

    return {
      items: summaries,
      total: query.lowStockOnly ? summaries.length : total,
      counts: {
        activeItems: fullSummaries.filter((item) => item.isActive).length,
        inactiveItems: fullSummaries.filter((item) => !item.isActive).length,
        lowStockItems: fullSummaries.filter(
          (item) => item.lowStockVariantCount > 0 && item.outOfStockVariantCount === 0,
        ).length,
        outOfStockItems: fullSummaries.filter((item) => item.outOfStockVariantCount > 0).length,
        totalAssignments: fullSummaries.reduce((sum, item) => sum + item.totalAssigned, 0),
        byCategory,
      },
    };
  }

  async getItemDetail(
    tenantId: string,
    id: string,
  ): Promise<{
    item: InventoryItemSummary;
    activeAssignments: InventoryAssignmentSummary[];
    recentMovements: InventoryMovementSummary[];
  }> {
    const item = await this.loadItem(tenantId, id);
    const variants = await this.loadVariantsForItems(tenantId, [id]);
    const branch = item.sportBranchId
      ? await this.branches.findOne({ where: { id: item.sportBranchId, tenantId } })
      : null;
    const summary = this.summarizeItem(item, variants, branch?.name ?? null);

    const activeAssignmentsRaw = await this.assignments.find({
      where: { tenantId, inventoryItemId: id, returnedAt: IsNull() },
      relations: ['athlete', 'inventoryVariant'],
      order: { assignedAt: 'DESC' },
    });
    const activeAssignments = activeAssignmentsRaw.map((assignment) =>
      this.formatAssignment(assignment, item),
    );

    const movements = await this.movements.find({
      where: { tenantId, inventoryItemId: id },
      relations: ['inventoryVariant', 'athlete'],
      order: { createdAt: 'DESC' },
      take: 50,
    });
    const recentMovements = movements.map((movement) => this.formatMovement(movement, item));

    return { item: summary, activeAssignments, recentMovements };
  }

  async createItem(tenantId: string, dto: CreateInventoryItemDto): Promise<InventoryItemSummary> {
    await this.assertBranchScope(tenantId, dto.sportBranchId ?? null);

    return this.dataSource.transaction(async (manager) => {
      const itemRepo = manager.getRepository(InventoryItem);
      const variantRepo = manager.getRepository(InventoryVariant);
      const movementRepo = manager.getRepository(InventoryMovement);

      const item = itemRepo.create({
        tenantId,
        name: dto.name.trim(),
        category: dto.category,
        sportBranchId: dto.sportBranchId ?? null,
        hasVariants: dto.hasVariants ?? Boolean(dto.variants && dto.variants.length > 0),
        trackAssignment: dto.trackAssignment ?? false,
        lowStockThreshold: dto.lowStockThreshold ?? 0,
        description: dto.description ?? null,
        isActive: dto.isActive ?? true,
      });
      const savedItem = await itemRepo.save(item);

      const variantInputs =
        dto.variants && dto.variants.length > 0
          ? dto.variants
          : [
              {
                size: null,
                number: null,
                color: null,
                initialStock: dto.initialStock ?? 0,
                lowStockThreshold: null,
                isDefault: true,
              },
            ];

      const seenSignatures = new Set<string>();
      for (const variantInput of variantInputs) {
        const signature = `${variantInput.size ?? ''}|${variantInput.number ?? ''}|${variantInput.color ?? ''}`;
        if (seenSignatures.has(signature)) {
          throw new BadRequestException(
            `Duplicate variant: size=${variantInput.size ?? ''} number=${variantInput.number ?? ''} color=${variantInput.color ?? ''}`,
          );
        }
        seenSignatures.add(signature);

        const isDefault =
          (variantInput as { isDefault?: boolean }).isDefault ??
          (!variantInput.size && !variantInput.number && !variantInput.color);
        const variant = variantRepo.create({
          tenantId,
          inventoryItemId: savedItem.id,
          size: variantInput.size ?? null,
          number: variantInput.number ?? null,
          color: variantInput.color ?? null,
          isDefault: Boolean(isDefault),
          stockOnHand: variantInput.initialStock ?? 0,
          assignedCount: 0,
          lowStockThreshold: variantInput.lowStockThreshold ?? null,
          isActive: true,
        });
        const savedVariant = await variantRepo.save(variant);
        if ((variantInput.initialStock ?? 0) > 0) {
          await movementRepo.save(
            movementRepo.create({
              tenantId,
              inventoryItemId: savedItem.id,
              inventoryVariantId: savedVariant.id,
              type: InventoryMovementType.STOCK_ADDED,
              quantity: variantInput.initialStock ?? 0,
              athleteId: null,
              note: 'Initial stock',
            }),
          );
        }
      }

      const variants = await variantRepo.find({
        where: { tenantId, inventoryItemId: savedItem.id },
      });
      const branch = savedItem.sportBranchId
        ? await manager.getRepository(SportBranch).findOne({
            where: { id: savedItem.sportBranchId, tenantId },
          })
        : null;
      return this.summarizeItem(savedItem, variants, branch?.name ?? null);
    });
  }

  async updateItem(
    tenantId: string,
    id: string,
    dto: UpdateInventoryItemDto,
  ): Promise<InventoryItemSummary> {
    const item = await this.loadItem(tenantId, id);
    if (dto.sportBranchId !== undefined) {
      await this.assertBranchScope(tenantId, dto.sportBranchId);
    }

    Object.assign(item, {
      name: dto.name?.trim() ?? item.name,
      category: dto.category ?? item.category,
      sportBranchId: dto.sportBranchId !== undefined ? dto.sportBranchId : item.sportBranchId,
      hasVariants: dto.hasVariants ?? item.hasVariants,
      trackAssignment: dto.trackAssignment ?? item.trackAssignment,
      lowStockThreshold:
        dto.lowStockThreshold !== undefined ? dto.lowStockThreshold : item.lowStockThreshold,
      description: dto.description !== undefined ? dto.description : item.description,
      isActive: dto.isActive ?? item.isActive,
    });
    const saved = await this.items.save(item);
    const variants = await this.loadVariantsForItems(tenantId, [id]);
    const branch = saved.sportBranchId
      ? await this.branches.findOne({ where: { id: saved.sportBranchId, tenantId } })
      : null;
    return this.summarizeItem(saved, variants, branch?.name ?? null);
  }

  async removeItem(tenantId: string, id: string): Promise<void> {
    const open = await this.assignments.count({
      where: { tenantId, inventoryItemId: id, returnedAt: IsNull() },
    });
    if (open > 0) {
      throw new BadRequestException(
        'This item still has open assignments. Return them or mark the item inactive first.',
      );
    }
    const res = await this.items.delete({ id, tenantId });
    if (!res.affected) throw new NotFoundException('Inventory item not found');
  }

  // —— Variants ———————————————————————————————————————————————————————

  async createVariant(
    tenantId: string,
    itemId: string,
    dto: CreateInventoryVariantDto,
  ): Promise<InventoryVariantSummary> {
    const item = await this.loadItem(tenantId, itemId);
    const existing = await this.variants.find({
      where: { tenantId, inventoryItemId: itemId },
    });
    const signature = `${dto.size ?? ''}|${dto.number ?? ''}|${dto.color ?? ''}`;
    if (
      existing.some(
        (variant) =>
          `${variant.size ?? ''}|${variant.number ?? ''}|${variant.color ?? ''}` === signature,
      )
    ) {
      throw new BadRequestException('A variant with the same size / number / colour already exists.');
    }

    const variant = this.variants.create({
      tenantId,
      inventoryItemId: itemId,
      size: dto.size ?? null,
      number: dto.number ?? null,
      color: dto.color ?? null,
      isDefault: false,
      stockOnHand: dto.initialStock ?? 0,
      assignedCount: 0,
      lowStockThreshold: dto.lowStockThreshold ?? null,
      isActive: true,
    });
    const saved = await this.variants.save(variant);
    if ((dto.initialStock ?? 0) > 0) {
      await this.logMovement(tenantId, item, saved, InventoryMovementType.STOCK_ADDED, dto.initialStock ?? 0, {
        note: 'Initial variant stock',
      });
    }
    if (!item.hasVariants) {
      item.hasVariants = true;
      await this.items.save(item);
    }
    return this.summarizeVariant(saved, item);
  }

  async updateVariant(
    tenantId: string,
    variantId: string,
    dto: UpdateInventoryVariantDto,
  ): Promise<InventoryVariantSummary> {
    const variant = await this.loadVariant(tenantId, variantId);
    const item = await this.loadItem(tenantId, variant.inventoryItemId);

    if (dto.size !== undefined) variant.size = dto.size;
    if (dto.number !== undefined) variant.number = dto.number;
    if (dto.color !== undefined) variant.color = dto.color;
    if (dto.lowStockThreshold !== undefined) variant.lowStockThreshold = dto.lowStockThreshold;
    if (dto.isActive !== undefined) variant.isActive = dto.isActive;

    const saved = await this.variants.save(variant);
    return this.summarizeVariant(saved, item);
  }

  async removeVariant(tenantId: string, variantId: string): Promise<void> {
    const variant = await this.loadVariant(tenantId, variantId);
    const open = await this.assignments.count({
      where: { tenantId, inventoryVariantId: variantId, returnedAt: IsNull() },
    });
    if (open > 0) {
      throw new BadRequestException(
        'This variant has open athlete assignments. Return them before deleting.',
      );
    }
    if (variant.isDefault) {
      throw new BadRequestException('The default variant cannot be deleted; mark the item inactive instead.');
    }
    await this.variants.delete({ id: variantId, tenantId });
  }

  async adjustStock(
    tenantId: string,
    variantId: string,
    dto: AdjustInventoryStockDto,
  ): Promise<InventoryVariantSummary> {
    if (!Number.isFinite(dto.delta) || dto.delta === 0) {
      throw new BadRequestException('Stock adjustment delta must be a non-zero integer.');
    }
    const variant = await this.loadVariant(tenantId, variantId);
    const item = await this.loadItem(tenantId, variant.inventoryItemId);

    const nextStock = variant.stockOnHand + dto.delta;
    if (nextStock < 0) {
      throw new BadRequestException('Stock on hand cannot drop below zero.');
    }
    if (nextStock < variant.assignedCount) {
      throw new BadRequestException(
        `Cannot reduce stock below assigned count (${variant.assignedCount}). Return assignments first.`,
      );
    }

    variant.stockOnHand = nextStock;
    const saved = await this.variants.save(variant);
    await this.logMovement(
      tenantId,
      item,
      saved,
      dto.delta > 0 ? InventoryMovementType.STOCK_ADDED : InventoryMovementType.STOCK_REMOVED,
      dto.delta,
      { note: dto.note ?? null },
    );
    return this.summarizeVariant(saved, item);
  }

  // —— Assignments ————————————————————————————————————————————————————

  private formatAssignment(
    assignment: InventoryAssignment,
    item: InventoryItem,
  ): InventoryAssignmentSummary {
    const variantLabel = this.buildVariantLabel(
      assignment.inventoryVariant ?? {
        size: null,
        number: null,
        color: null,
        isDefault: true,
      },
    );
    const athleteName = assignment.athlete
      ? `${assignment.athlete.lastName}, ${assignment.athlete.firstName}`.trim()
      : '';
    return {
      id: assignment.id,
      inventoryItemId: assignment.inventoryItemId,
      inventoryItemName: item.name,
      inventoryItemCategory: item.category,
      inventoryVariantId: assignment.inventoryVariantId,
      variantLabel,
      size: assignment.inventoryVariant?.size ?? null,
      number: assignment.inventoryVariant?.number ?? null,
      color: assignment.inventoryVariant?.color ?? null,
      athleteId: assignment.athleteId,
      athleteName,
      athletePrimaryGroupId: assignment.athlete?.primaryGroupId ?? null,
      quantity: assignment.quantity,
      assignedAt: assignment.assignedAt.toISOString(),
      returnedAt: assignment.returnedAt ? assignment.returnedAt.toISOString() : null,
      isOpen: assignment.returnedAt === null,
      notes: assignment.notes,
    };
  }

  private formatMovement(
    movement: InventoryMovement,
    item: InventoryItem,
  ): InventoryMovementSummary {
    return {
      id: movement.id,
      inventoryItemId: movement.inventoryItemId,
      inventoryItemName: item.name,
      inventoryVariantId: movement.inventoryVariantId,
      variantLabel: this.buildVariantLabel(
        movement.inventoryVariant ?? {
          size: null,
          number: null,
          color: null,
          isDefault: true,
        },
      ),
      type: movement.type,
      quantity: movement.quantity,
      athleteId: movement.athleteId,
      athleteName: movement.athlete
        ? `${movement.athlete.lastName}, ${movement.athlete.firstName}`.trim()
        : null,
      note: movement.note,
      createdAt: movement.createdAt.toISOString(),
    };
  }

  async assignToAthlete(
    tenantId: string,
    dto: AssignInventoryDto,
    staffUserId: string | null,
  ): Promise<InventoryAssignmentSummary> {
    const variant = await this.loadVariant(tenantId, dto.inventoryVariantId);
    const item = await this.loadItem(tenantId, variant.inventoryItemId);
    if (!item.isActive) {
      throw new BadRequestException('Cannot assign an item that is marked inactive.');
    }
    const athlete = await this.athletes.findOne({ where: { id: dto.athleteId, tenantId } });
    if (!athlete) throw new BadRequestException('Athlete not found for this tenant.');
    const quantity = dto.quantity ?? 1;
    if (quantity <= 0) throw new BadRequestException('Assignment quantity must be at least 1.');

    const available = Math.max(variant.stockOnHand - variant.assignedCount, 0);
    if (available < quantity) {
      throw new BadRequestException(
        `Only ${available} unit(s) available for this variant. Add stock or pick another variant.`,
      );
    }

    if (item.trackAssignment && quantity === 1) {
      const existing = await this.assignments.findOne({
        where: {
          tenantId,
          inventoryVariantId: variant.id,
          athleteId: athlete.id,
          returnedAt: IsNull(),
        },
      });
      if (existing) {
        throw new BadRequestException('This athlete already has this variant assigned.');
      }
    }

    const assignment = this.assignments.create({
      tenantId,
      inventoryItemId: item.id,
      inventoryVariantId: variant.id,
      athleteId: athlete.id,
      quantity,
      assignedAt: new Date(),
      returnedAt: null,
      notes: dto.notes ?? null,
    });
    const saved = await this.assignments.save(assignment);
    await this.recomputeAssignedCount(variant.id);
    const refreshedVariant = await this.loadVariant(tenantId, variant.id);
    await this.logMovement(tenantId, item, refreshedVariant, InventoryMovementType.ASSIGNED, quantity, {
      athleteId: athlete.id,
      note: dto.notes ?? null,
      createdByStaffUserId: staffUserId,
    });
    const reloaded = await this.assignments.findOne({
      where: { id: saved.id, tenantId },
      relations: ['athlete', 'inventoryVariant'],
    });
    return this.formatAssignment(reloaded!, item);
  }

  async returnAssignment(
    tenantId: string,
    assignmentId: string,
    dto: ReturnInventoryAssignmentDto,
    staffUserId: string | null,
  ): Promise<InventoryAssignmentSummary> {
    const assignment = await this.assignments.findOne({
      where: { id: assignmentId, tenantId },
      relations: ['athlete', 'inventoryVariant'],
    });
    if (!assignment) throw new NotFoundException('Assignment not found.');
    if (assignment.returnedAt) {
      throw new BadRequestException('This assignment is already closed.');
    }
    const item = await this.loadItem(tenantId, assignment.inventoryItemId);
    assignment.returnedAt = new Date();
    if (dto.note) {
      assignment.notes = assignment.notes
        ? `${assignment.notes}\nReturn: ${dto.note}`
        : `Return: ${dto.note}`;
    }
    const saved = await this.assignments.save(assignment);
    await this.recomputeAssignedCount(assignment.inventoryVariantId);
    const variant = await this.loadVariant(tenantId, assignment.inventoryVariantId);
    await this.logMovement(
      tenantId,
      item,
      variant,
      InventoryMovementType.RETURNED,
      -assignment.quantity,
      {
        athleteId: assignment.athleteId,
        note: dto.note ?? null,
        createdByStaffUserId: staffUserId,
      },
    );
    return this.formatAssignment(saved, item);
  }

  async listAssignmentsForAthlete(
    tenantId: string,
    athleteId: string,
    options: { includeReturned?: boolean } = {},
  ): Promise<InventoryAssignmentSummary[]> {
    const where = options.includeReturned
      ? { tenantId, athleteId }
      : { tenantId, athleteId, returnedAt: IsNull() };
    const assignments = await this.assignments.find({
      where,
      relations: ['inventoryItem', 'inventoryVariant', 'athlete'],
      order: { assignedAt: 'DESC' },
      take: 200,
    });
    return assignments.map((assignment) =>
      this.formatAssignment(assignment, assignment.inventoryItem),
    );
  }

  async listAssignmentsForItem(
    tenantId: string,
    itemId: string,
    options: { includeReturned?: boolean } = {},
  ): Promise<InventoryAssignmentSummary[]> {
    const item = await this.loadItem(tenantId, itemId);
    const where = options.includeReturned
      ? { tenantId, inventoryItemId: itemId }
      : { tenantId, inventoryItemId: itemId, returnedAt: IsNull() };
    const assignments = await this.assignments.find({
      where,
      relations: ['athlete', 'inventoryVariant'],
      order: { assignedAt: 'DESC' },
      take: 200,
    });
    return assignments.map((assignment) => this.formatAssignment(assignment, item));
  }

  async listMovementsForItem(
    tenantId: string,
    itemId: string,
  ): Promise<InventoryMovementSummary[]> {
    const item = await this.loadItem(tenantId, itemId);
    const movements = await this.movements.find({
      where: { tenantId, inventoryItemId: itemId },
      relations: ['inventoryVariant', 'athlete'],
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return movements.map((movement) => this.formatMovement(movement, item));
  }
}
