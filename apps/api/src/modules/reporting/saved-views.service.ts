import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import type {
  ReportEntityKey,
  ReportFilterNode,
  ReportSortClause,
  SavedReportView,
} from '@amateur/shared-types';
import { SavedFilterPreset } from '../../database/entities/saved-filter-preset.entity';
import { StaffUser } from '../../database/entities/staff-user.entity';
import { getCatalogEntity, getFieldDefinition, REPORT_ENTITY_KEYS } from './catalog';
import { validateFilterTree } from './filter-tree';

export interface SavedViewInput {
  entity: ReportEntityKey;
  name: string;
  description?: string | null;
  filter?: ReportFilterNode | null;
  columns?: string[];
  sort?: ReportSortClause[];
  search?: string | null;
  visibility?: 'private' | 'shared';
}

@Injectable()
export class SavedViewsService {
  constructor(
    @InjectRepository(SavedFilterPreset)
    private readonly presets: Repository<SavedFilterPreset>,
    @InjectRepository(StaffUser)
    private readonly staffUsers: Repository<StaffUser>,
  ) {}

  private surfaceFor(entity: ReportEntityKey): string {
    return `report:${entity}`;
  }

  async list(tenantId: string, staffUserId: string, entity?: ReportEntityKey): Promise<SavedReportView[]> {
    const qb = this.presets
      .createQueryBuilder('preset')
      .leftJoin('preset.ownerStaffUser', 'owner')
      .addSelect(['owner.firstName', 'owner.lastName', 'owner.preferredName'])
      .where('preset.tenantId = :tenantId', { tenantId })
      .andWhere('preset.surface LIKE :prefix', { prefix: 'report:%' })
      .andWhere(
        new Brackets((sub) => {
          sub
            .where('preset.visibility = :shared', { shared: 'shared' })
            .orWhere('preset.ownerStaffUserId = :ownerId', { ownerId: staffUserId });
        }),
      )
      .orderBy('preset.updatedAt', 'DESC');

    if (entity) {
      qb.andWhere('preset.entity = :entity', { entity });
    }

    const rows = await qb.getMany();
    return rows.map((row) => this.toResponse(row));
  }

  async get(tenantId: string, staffUserId: string, id: string): Promise<SavedReportView> {
    const row = await this.presets.findOne({
      where: { id, tenantId },
      relations: ['ownerStaffUser'],
    });
    if (!row) throw new NotFoundException('Saved report view not found');
    if (row.visibility === 'private' && row.ownerStaffUserId !== staffUserId) {
      throw new ForbiddenException('You can only access your own private views.');
    }
    return this.toResponse(row);
  }

  async create(tenantId: string, staffUserId: string, input: SavedViewInput): Promise<SavedReportView> {
    this.assertEntity(input.entity);
    const trimmedName = input.name?.trim();
    if (!trimmedName) throw new BadRequestException('Name is required.');
    if (trimmedName.length > 200) throw new BadRequestException('Name is too long (max 200).');

    const filter = validateFilterTree(input.entity, input.filter ?? null);
    const columns = this.normalizeColumns(input.entity, input.columns);
    const sort = this.normalizeSort(input.entity, input.sort);

    const preset = this.presets.create({
      tenantId,
      surface: this.surfaceFor(input.entity),
      entity: input.entity,
      name: trimmedName,
      description: input.description?.trim() || null,
      filterTree: filter ? (filter as unknown as Record<string, unknown>) : null,
      columns,
      sort,
      visibility: input.visibility === 'shared' ? 'shared' : 'private',
      ownerStaffUserId: staffUserId,
      payload: input.search ? { search: input.search } : {},
    });

    const saved = await this.presets.save(preset);
    return this.get(tenantId, staffUserId, saved.id);
  }

  async update(
    tenantId: string,
    staffUserId: string,
    id: string,
    input: Partial<SavedViewInput>,
  ): Promise<SavedReportView> {
    const row = await this.presets.findOne({ where: { id, tenantId }, relations: ['ownerStaffUser'] });
    if (!row || !row.surface.startsWith('report:')) throw new NotFoundException('Saved report view not found');
    if (row.ownerStaffUserId && row.ownerStaffUserId !== staffUserId) {
      throw new ForbiddenException('Only the owner can update this view.');
    }

    if (input.entity && input.entity !== row.entity) {
      this.assertEntity(input.entity);
      row.entity = input.entity;
      row.surface = this.surfaceFor(input.entity);
    }

    const targetEntity = (row.entity as ReportEntityKey) ?? 'athletes';

    if (input.name !== undefined) {
      const trimmedName = input.name.trim();
      if (!trimmedName) throw new BadRequestException('Name is required.');
      row.name = trimmedName;
    }
    if (input.description !== undefined) {
      row.description = input.description?.trim() || null;
    }
    if (input.filter !== undefined) {
      const filter = validateFilterTree(targetEntity, input.filter ?? null);
      row.filterTree = filter ? (filter as unknown as Record<string, unknown>) : null;
    }
    if (input.columns !== undefined) {
      row.columns = this.normalizeColumns(targetEntity, input.columns);
    }
    if (input.sort !== undefined) {
      row.sort = this.normalizeSort(targetEntity, input.sort);
    }
    if (input.search !== undefined) {
      row.payload = input.search ? { search: input.search } : {};
    }
    if (input.visibility !== undefined) {
      row.visibility = input.visibility === 'shared' ? 'shared' : 'private';
    }

    const saved = await this.presets.save(row);
    return this.get(tenantId, staffUserId, saved.id);
  }

  async remove(tenantId: string, staffUserId: string, id: string): Promise<void> {
    const row = await this.presets.findOne({ where: { id, tenantId } });
    if (!row || !row.surface.startsWith('report:')) throw new NotFoundException('Saved report view not found');
    if (row.ownerStaffUserId && row.ownerStaffUserId !== staffUserId) {
      throw new ForbiddenException('Only the owner can delete this view.');
    }
    await this.presets.delete({ id, tenantId });
  }

  private assertEntity(entity: ReportEntityKey) {
    if (!REPORT_ENTITY_KEYS.includes(entity)) {
      throw new BadRequestException(`Unknown reporting entity "${entity}".`);
    }
  }

  private normalizeColumns(entity: ReportEntityKey, columns?: string[]): string[] {
    const catalog = getCatalogEntity(entity);
    if (!catalog) return [];
    if (!columns || columns.length === 0) return catalog.defaultColumns;
    const seen = new Set<string>();
    const result: string[] = [];
    for (const key of columns) {
      if (seen.has(key)) continue;
      const def = getFieldDefinition(entity, key);
      if (!def || def.selectable === false) {
        throw new BadRequestException(`Column "${key}" is not selectable.`);
      }
      result.push(key);
      seen.add(key);
    }
    return result;
  }

  private normalizeSort(entity: ReportEntityKey, sort?: ReportSortClause[]): ReportSortClause[] {
    if (!sort || sort.length === 0) return [];
    return sort.map((clause) => {
      const def = getFieldDefinition(entity, clause.field);
      if (!def || def.sortable === false) {
        throw new BadRequestException(`Sort is not allowed on "${clause.field}".`);
      }
      if (clause.direction !== 'asc' && clause.direction !== 'desc') {
        throw new BadRequestException(`Sort direction must be asc or desc.`);
      }
      return { field: clause.field, direction: clause.direction };
    });
  }

  private toResponse(row: SavedFilterPreset): SavedReportView {
    const owner = row.ownerStaffUser ?? null;
    const ownerName = owner
      ? owner.preferredName || `${owner.firstName} ${owner.lastName}`.trim() || null
      : null;
    return {
      id: row.id,
      tenantId: row.tenantId,
      entity: (row.entity as ReportEntityKey) ?? 'athletes',
      name: row.name,
      description: row.description ?? null,
      filter: (row.filterTree as ReportFilterNode | null) ?? null,
      columns: row.columns ?? [],
      sort: (row.sort as ReportSortClause[] | null) ?? [],
      search: typeof row.payload?.search === 'string' ? (row.payload.search as string) : null,
      visibility: row.visibility,
      ownerStaffUserId: row.ownerStaffUserId ?? null,
      ownerName,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
