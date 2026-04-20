import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Athlete } from '../../database/entities/athlete.entity';
import { Guardian } from '../../database/entities/guardian.entity';
import { AthleteGuardian } from '../../database/entities/athlete-guardian.entity';
import { ClubGroup } from '../../database/entities/club-group.entity';
import { SportBranch } from '../../database/entities/sport-branch.entity';
import { Coach } from '../../database/entities/coach.entity';
import { Team } from '../../database/entities/team.entity';
import { ChargeItem } from '../../database/entities/charge-item.entity';
import { InventoryItem } from '../../database/entities/inventory-item.entity';
import { InventoryVariant } from '../../database/entities/inventory-variant.entity';
import { InventoryMovement } from '../../database/entities/inventory-movement.entity';
import { AthleteStatus, InventoryCategory, InventoryMovementType } from '../../database/enums';
import {
  IMPORT_DEFINITIONS,
  ImportEntityDefinition,
  ImportEntityKey,
  ImportFieldDefinition,
  getImportDefinition,
} from './import-definitions';
import { ImportCommitDto, ImportPreviewDto, MAX_IMPORT_ROWS } from './dto/import-preview.dto';

export type ImportIssueSeverity = 'error' | 'warning' | 'info';

export interface ImportRowIssue {
  field?: string;
  severity: ImportIssueSeverity;
  /** Human-readable message ready to render. */
  message: string;
}

export type ImportRowOutcome = 'create' | 'update' | 'skip' | 'reject';

export type ImportResolvedValue = string | boolean | number | null;

export interface ImportRowReport {
  rowNumber: number;
  outcome: ImportRowOutcome;
  /** Resolved field values after mapping/parsing — never returned for `reject`. */
  resolved: Record<string, ImportResolvedValue>;
  /** Display label staff will recognise, e.g. "Defne Yıldız". */
  displayLabel: string;
  issues: ImportRowIssue[];
}

export interface ImportSummaryCounts {
  total: number;
  createReady: number;
  updateReady: number;
  skipReady: number;
  rejected: number;
  warnings: number;
}

export interface ImportPreviewReport {
  entity: ImportEntityKey;
  counts: ImportSummaryCounts;
  rows: ImportRowReport[];
  /** Field-level summary so the UI can show "X rows missing required field". */
  missingRequired: Array<{ field: string; rowCount: number }>;
  /** True when every row passed validation strictly enough to commit. */
  canCommit: boolean;
  /** Friendly hints surfaced in the wizard summary. */
  hints: string[];
}

export interface ImportCommitReport {
  entity: ImportEntityKey;
  counts: ImportSummaryCounts & {
    created: number;
    updated: number;
    skipped: number;
  };
  rows: ImportRowReport[];
  durationMs: number;
}

interface RowContext {
  rowNumber: number;
  resolved: Record<string, ImportResolvedValue>;
  issues: ImportRowIssue[];
}

@Injectable()
export class ImportsService {
  constructor(
    @InjectRepository(Athlete) private readonly athletes: Repository<Athlete>,
    @InjectRepository(Guardian) private readonly guardians: Repository<Guardian>,
    @InjectRepository(AthleteGuardian)
    private readonly athleteGuardians: Repository<AthleteGuardian>,
    @InjectRepository(ClubGroup) private readonly groups: Repository<ClubGroup>,
    @InjectRepository(SportBranch) private readonly branches: Repository<SportBranch>,
    @InjectRepository(Coach) private readonly coaches: Repository<Coach>,
    @InjectRepository(Team) private readonly teams: Repository<Team>,
    @InjectRepository(ChargeItem) private readonly chargeItems: Repository<ChargeItem>,
    @InjectRepository(InventoryItem)
    private readonly inventoryItems: Repository<InventoryItem>,
    private readonly dataSource: DataSource,
  ) {}

  listDefinitions(): ImportEntityDefinition[] {
    return IMPORT_DEFINITIONS;
  }

  buildTemplate(entity: ImportEntityKey): { filename: string; csv: string } {
    const definition = this.requireDefinition(entity);
    const headers = definition.fields.map((field) => field.key);
    const lines = [csvRow(headers)];
    for (const sample of definition.sample) {
      lines.push(csvRow(headers.map((header) => sample[header] ?? '')));
    }
    const csv = `\uFEFF${lines.join('\r\n')}\r\n`;
    return {
      filename: `amateur-import-${entity}-template.csv`,
      csv,
    };
  }

  async preview(tenantId: string, dto: ImportPreviewDto): Promise<ImportPreviewReport> {
    return this.runValidation(tenantId, dto);
  }

  async commit(tenantId: string, dto: ImportCommitDto): Promise<ImportCommitReport> {
    const start = Date.now();
    const validation = await this.runValidation(tenantId, dto);
    if (!validation.canCommit) {
      throw new BadRequestException(
        'Resolve the highlighted issues before committing this import.',
      );
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    await this.dataSource.transaction(async (manager) => {
      let result: { created: number; updated: number; skipped: number };
      switch (dto.entity) {
        case 'sport_branches':
          result = await this.commitSportBranches(manager, tenantId, validation.rows);
          break;
        case 'coaches':
          result = await this.commitCoaches(manager, tenantId, validation.rows);
          break;
        case 'groups':
          result = await this.commitGroups(manager, tenantId, validation.rows);
          break;
        case 'teams':
          result = await this.commitTeams(manager, tenantId, validation.rows);
          break;
        case 'athletes':
          result = await this.commitAthletes(manager, tenantId, dto, validation.rows);
          break;
        case 'guardians':
          result = await this.commitGuardians(manager, tenantId, validation.rows);
          break;
        case 'athlete_guardians':
          result = await this.commitAthleteGuardians(manager, tenantId, validation.rows);
          break;
        case 'charge_items':
          result = await this.commitChargeItems(manager, tenantId, validation.rows);
          break;
        case 'inventory_items':
          result = await this.commitInventoryItems(manager, tenantId, validation.rows);
          break;
        default: {
          const _exhaustive: never = dto.entity;
          throw new BadRequestException(`Unsupported import entity ${_exhaustive as string}.`);
        }
      }
      created = result.created;
      updated = result.updated;
      skipped = result.skipped;
    });

    return {
      entity: dto.entity,
      counts: {
        ...validation.counts,
        created,
        updated,
        skipped,
      },
      rows: validation.rows,
      durationMs: Date.now() - start,
    };
  }

  // —— Validation ——————————————————————————————————————————————————————

  private requireDefinition(entity: string): ImportEntityDefinition {
    const definition = getImportDefinition(entity);
    if (!definition) {
      throw new BadRequestException(`Unknown import entity "${entity}".`);
    }
    return definition;
  }

  private async runValidation(
    tenantId: string,
    dto: ImportPreviewDto,
  ): Promise<ImportPreviewReport> {
    const definition = this.requireDefinition(dto.entity);
    if (dto.rows.length === 0) {
      throw new BadRequestException('No rows were provided for this import.');
    }
    if (dto.rows.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException(
        `Imports support up to ${MAX_IMPORT_ROWS} rows per batch. Split the file and try again.`,
      );
    }

    const fieldByKey = new Map(definition.fields.map((f) => [f.key, f]));
    const reverseMapping = invertMapping(dto.columnMapping, fieldByKey);

    const requiredFields = definition.fields.filter((field) => field.required);
    const missingMandatoryColumns = requiredFields.filter(
      (field) => !reverseMapping.has(field.key),
    );

    const rowReports: ImportRowReport[] = [];
    const missingByField = new Map<string, number>();
    const hints: string[] = [];

    for (let i = 0; i < dto.rows.length; i += 1) {
      const sourceRow = dto.rows[i];
      const rowNumber = sourceRow.rowNumber ?? i + 1;
      const ctx: RowContext = { rowNumber, resolved: {}, issues: [] };

      for (const field of definition.fields) {
        const sourceCol = reverseMapping.get(field.key);
        const rawValue = sourceCol !== undefined ? sourceRow.cells[sourceCol] : undefined;
        const stringValue = normaliseCell(rawValue);
        if (stringValue === null) {
          ctx.resolved[field.key] = null;
          if (field.required && !missingMandatoryColumns.length) {
            ctx.issues.push({
              field: field.key,
              severity: 'error',
              message: `Required field "${field.key}" is empty.`,
            });
            missingByField.set(field.key, (missingByField.get(field.key) ?? 0) + 1);
          }
          continue;
        }
        const resolved = this.coerceField(field, stringValue, ctx);
        ctx.resolved[field.key] = resolved;
      }

      let outcome: ImportRowOutcome = ctx.issues.some((issue) => issue.severity === 'error')
        ? 'reject'
        : 'create';
      let displayLabel = '';

      if (outcome !== 'reject') {
        const enriched = await this.enrichRow(tenantId, dto, ctx);
        outcome = enriched.outcome;
        displayLabel = enriched.displayLabel;
      } else {
        displayLabel = inferDisplayLabel(dto.entity, ctx.resolved);
      }

      rowReports.push({
        rowNumber,
        outcome,
        resolved: outcome === 'reject' ? {} : ctx.resolved,
        displayLabel,
        issues: ctx.issues,
      });
    }

    if (missingMandatoryColumns.length > 0) {
      const message = `Map the required column${
        missingMandatoryColumns.length === 1 ? '' : 's'
      }: ${missingMandatoryColumns.map((field) => field.key).join(', ')}.`;
      rowReports.forEach((row) => {
        if (row.outcome !== 'reject') {
          row.outcome = 'reject';
        }
        row.issues.unshift({ severity: 'error', message });
      });
      hints.push(message);
    }

    const counts = summariseCounts(rowReports);
    const canCommit =
      counts.rejected === 0 && missingMandatoryColumns.length === 0 && counts.total > 0;

    if (counts.warnings > 0) {
      hints.push('Review highlighted warnings before committing.');
    }
    if (counts.skipReady > 0) {
      hints.push('Some rows match an existing record and will be skipped.');
    }
    if (counts.updateReady > 0) {
      hints.push('Some rows match an existing record and will be updated in place.');
    }

    return {
      entity: dto.entity,
      counts,
      rows: rowReports,
      missingRequired: Array.from(missingByField.entries()).map(([field, rowCount]) => ({
        field,
        rowCount,
      })),
      canCommit,
      hints,
    };
  }

  private coerceField(
    field: ImportFieldDefinition,
    raw: string,
    ctx: RowContext,
  ): ImportResolvedValue {
    switch (field.type) {
      case 'string': {
        if (field.maxLength && raw.length > field.maxLength) {
          ctx.issues.push({
            field: field.key,
            severity: 'warning',
            message: `Value for "${field.key}" is longer than ${field.maxLength} characters and will be truncated.`,
          });
          return raw.slice(0, field.maxLength);
        }
        return raw;
      }
      case 'enum': {
        const allowed = (field.enumValues ?? []).map((value) => value.toLowerCase());
        const lowered = raw.toLowerCase();
        if (!allowed.includes(lowered)) {
          ctx.issues.push({
            field: field.key,
            severity: 'error',
            message: `Value "${raw}" is not allowed for "${field.key}". Use one of: ${allowed.join(', ')}.`,
          });
          return null;
        }
        return lowered;
      }
      case 'date': {
        const iso = parseDateLike(raw);
        if (!iso) {
          ctx.issues.push({
            field: field.key,
            severity: 'error',
            message: `Cannot parse date "${raw}" for "${field.key}". Use YYYY-MM-DD.`,
          });
          return null;
        }
        return iso;
      }
      case 'email': {
        const trimmed = raw.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
          ctx.issues.push({
            field: field.key,
            severity: 'warning',
            message: `Email "${raw}" does not look valid; staff can correct it later.`,
          });
        }
        if (field.maxLength && trimmed.length > field.maxLength) {
          ctx.issues.push({
            field: field.key,
            severity: 'error',
            message: `Email is longer than ${field.maxLength} characters.`,
          });
          return null;
        }
        return trimmed;
      }
      case 'phone': {
        const cleaned = raw.replace(/[^\d+]/g, '');
        if (cleaned.length < 7) {
          ctx.issues.push({
            field: field.key,
            severity: 'warning',
            message: `Phone "${raw}" looks unusually short.`,
          });
        }
        if (field.maxLength && cleaned.length > field.maxLength) {
          ctx.issues.push({
            field: field.key,
            severity: 'warning',
            message: `Phone "${raw}" is longer than ${field.maxLength} characters and will be truncated.`,
          });
          return cleaned.slice(0, field.maxLength);
        }
        return cleaned;
      }
      case 'boolean': {
        const lowered = raw.toLowerCase();
        if (['true', 'yes', '1', 'evet', 'y', 'x'].includes(lowered)) return true;
        if (['false', 'no', '0', 'hayir', 'hayır', 'n', ''].includes(lowered)) return false;
        ctx.issues.push({
          field: field.key,
          severity: 'warning',
          message: `Value "${raw}" for "${field.key}" was treated as false; use yes/no.`,
        });
        return false;
      }
      case 'integer': {
        const cleaned = raw.replace(/[\s_]/g, '');
        const parsed = Number.parseInt(cleaned, 10);
        if (!Number.isFinite(parsed) || String(parsed) !== cleaned.replace(/^\+/, '')) {
          ctx.issues.push({
            field: field.key,
            severity: 'error',
            message: `Value "${raw}" for "${field.key}" is not a whole number.`,
          });
          return null;
        }
        if (parsed < 0) {
          ctx.issues.push({
            field: field.key,
            severity: 'error',
            message: `Value for "${field.key}" must be zero or greater.`,
          });
          return null;
        }
        return parsed;
      }
      case 'decimal': {
        const cleaned = raw.replace(/\s/g, '').replace(/,/g, '.');
        const parsed = Number.parseFloat(cleaned);
        if (!Number.isFinite(parsed)) {
          ctx.issues.push({
            field: field.key,
            severity: 'error',
            message: `Value "${raw}" for "${field.key}" is not a number.`,
          });
          return null;
        }
        if (parsed < 0) {
          ctx.issues.push({
            field: field.key,
            severity: 'error',
            message: `Amount for "${field.key}" must be zero or greater.`,
          });
          return null;
        }
        return Math.round(parsed * 100) / 100;
      }
      default:
        return raw;
    }
  }

  // —— Per-entity enrichment + commit ———————————————————————————————————

  private async enrichRow(
    tenantId: string,
    dto: ImportPreviewDto,
    ctx: RowContext,
  ): Promise<{ outcome: ImportRowOutcome; displayLabel: string }> {
    switch (dto.entity) {
      case 'sport_branches':
        return this.enrichSportBranch(tenantId, ctx);
      case 'coaches':
        return this.enrichCoach(tenantId, ctx);
      case 'groups':
        return this.enrichGroup(tenantId, ctx);
      case 'teams':
        return this.enrichTeam(tenantId, ctx);
      case 'athletes':
        return this.enrichAthlete(tenantId, dto, ctx);
      case 'guardians':
        return this.enrichGuardian(tenantId, ctx);
      case 'athlete_guardians':
        return this.enrichRelationship(tenantId, ctx);
      case 'charge_items':
        return this.enrichChargeItem(tenantId, ctx);
      case 'inventory_items':
        return this.enrichInventoryItem(tenantId, ctx);
      default: {
        const _exhaustive: never = dto.entity;
        throw new BadRequestException(`Unsupported import entity ${_exhaustive as string}.`);
      }
    }
  }

  private async enrichSportBranch(
    tenantId: string,
    ctx: RowContext,
  ): Promise<{ outcome: ImportRowOutcome; displayLabel: string }> {
    const name = ((ctx.resolved.name as string | null) ?? '').trim();
    const codeRaw = ((ctx.resolved.code as string | null) ?? '').trim();
    const code = codeRaw.toUpperCase().replace(/\s+/g, '_');
    ctx.resolved.code = code;
    const displayLabel = name || code;

    if (code && !/^[A-Z0-9_-]{2,48}$/.test(code)) {
      ctx.issues.push({
        field: 'code',
        severity: 'error',
        message: `Branch code "${codeRaw}" should be 2–48 characters, letters/numbers/underscores only.`,
      });
    }

    if (name && code) {
      const existing = await this.branches
        .createQueryBuilder('b')
        .where('b.tenantId = :tenantId', { tenantId })
        .andWhere('(LOWER(b.name) = LOWER(:name) OR LOWER(b.code) = LOWER(:code))', { name, code })
        .getOne();
      if (existing) {
        ctx.issues.push({
          severity: 'info',
          message: `Sport branch "${displayLabel}" already exists and will be skipped.`,
        });
        ctx.resolved.existingId = existing.id;
        if (ctx.issues.some((issue) => issue.severity === 'error')) {
          return { outcome: 'reject', displayLabel };
        }
        return { outcome: 'skip', displayLabel };
      }
    }

    if (ctx.issues.some((issue) => issue.severity === 'error')) {
      return { outcome: 'reject', displayLabel };
    }
    return { outcome: 'create', displayLabel };
  }

  private async enrichCoach(
    tenantId: string,
    ctx: RowContext,
  ): Promise<{ outcome: ImportRowOutcome; displayLabel: string }> {
    const firstName = ((ctx.resolved.firstName as string | null) ?? '').trim();
    const lastName = ((ctx.resolved.lastName as string | null) ?? '').trim();
    const branchValue = ((ctx.resolved.sportBranch as string | null) ?? '').trim();
    const displayLabel = `${firstName} ${lastName}`.trim();

    let branchId: string | null = null;
    if (branchValue) {
      const branches = await this.branches.find({ where: { tenantId } });
      const branch = branches.find(
        (entry) =>
          entry.name.toLowerCase() === branchValue.toLowerCase() ||
          entry.code.toLowerCase() === branchValue.toLowerCase(),
      );
      if (!branch) {
        ctx.issues.push({
          field: 'sportBranch',
          severity: 'error',
          message: `Sport branch "${branchValue}" was not found in this club. Import sport branches first.`,
        });
      } else {
        branchId = branch.id;
      }
    }
    ctx.resolved.sportBranchId = branchId;

    if (firstName && lastName && branchId) {
      const existing = await this.coaches
        .createQueryBuilder('c')
        .where('c.tenantId = :tenantId', { tenantId })
        .andWhere('LOWER(c.firstName) = LOWER(:firstName)', { firstName })
        .andWhere('LOWER(c.lastName) = LOWER(:lastName)', { lastName })
        .getOne();
      if (existing) {
        ctx.issues.push({
          severity: 'info',
          message: `Coach "${displayLabel}" already exists and will be skipped.`,
        });
        ctx.resolved.existingId = existing.id;
        if (ctx.issues.some((issue) => issue.severity === 'error')) {
          return { outcome: 'reject', displayLabel };
        }
        return { outcome: 'skip', displayLabel };
      }
    }

    if (ctx.issues.some((issue) => issue.severity === 'error')) {
      return { outcome: 'reject', displayLabel };
    }
    return { outcome: 'create', displayLabel };
  }

  private async enrichTeam(
    tenantId: string,
    ctx: RowContext,
  ): Promise<{ outcome: ImportRowOutcome; displayLabel: string }> {
    const branchValue = ((ctx.resolved.sportBranch as string | null) ?? '').trim();
    const branches = await this.branches.find({ where: { tenantId } });
    let branchId: string | null = null;
    if (branchValue) {
      const branch = branches.find(
        (entry) =>
          entry.name.toLowerCase() === branchValue.toLowerCase() ||
          entry.code.toLowerCase() === branchValue.toLowerCase(),
      );
      if (!branch) {
        ctx.issues.push({
          field: 'sportBranch',
          severity: 'error',
          message: `Sport branch "${branchValue}" was not found. Import sport branches first.`,
        });
      } else {
        branchId = branch.id;
      }
    }
    ctx.resolved.sportBranchId = branchId;

    let groupId: string | null = null;
    const groupValue = ((ctx.resolved.groupName as string | null) ?? '').trim();
    if (groupValue && branchId) {
      const group = await this.groups
        .createQueryBuilder('g')
        .where('g.tenantId = :tenantId', { tenantId })
        .andWhere('g.sportBranchId = :branchId', { branchId })
        .andWhere('LOWER(g.name) = LOWER(:name)', { name: groupValue })
        .getOne();
      if (!group) {
        ctx.issues.push({
          field: 'groupName',
          severity: 'warning',
          message: `Group "${groupValue}" was not found in the chosen sport branch — the team will be created without a group link.`,
        });
      } else {
        groupId = group.id;
      }
    }
    ctx.resolved.groupId = groupId;

    let coachId: string | null = null;
    const coachValue = ((ctx.resolved.headCoachName as string | null) ?? '').trim();
    if (coachValue && branchId) {
      const coachList = await this.coaches.find({ where: { tenantId } });
      const coach = coachList.find((entry) => {
        if (entry.sportBranchId !== branchId) return false;
        const full = `${entry.firstName} ${entry.lastName}`.trim().toLowerCase();
        const preferred = (entry.preferredName ?? '').trim().toLowerCase();
        const value = coachValue.toLowerCase();
        return full === value || (preferred && preferred === value);
      });
      if (!coach) {
        ctx.issues.push({
          field: 'headCoachName',
          severity: 'warning',
          message: `Coach "${coachValue}" was not found in this branch — the team will be created without a head coach.`,
        });
      } else {
        coachId = coach.id;
      }
    }
    ctx.resolved.headCoachId = coachId;

    const name = ((ctx.resolved.name as string | null) ?? '').trim();
    const displayLabel = name;

    if (name && branchId) {
      const existing = await this.teams
        .createQueryBuilder('t')
        .where('t.tenantId = :tenantId', { tenantId })
        .andWhere('t.sportBranchId = :branchId', { branchId })
        .andWhere('LOWER(t.name) = LOWER(:name)', { name })
        .getOne();
      if (existing) {
        ctx.issues.push({
          severity: 'info',
          message: `Team "${displayLabel}" already exists in this branch and will be skipped.`,
        });
        ctx.resolved.existingId = existing.id;
        if (ctx.issues.some((issue) => issue.severity === 'error')) {
          return { outcome: 'reject', displayLabel };
        }
        return { outcome: 'skip', displayLabel };
      }
    }

    if (ctx.issues.some((issue) => issue.severity === 'error')) {
      return { outcome: 'reject', displayLabel };
    }
    return { outcome: 'create', displayLabel };
  }

  private async enrichChargeItem(
    tenantId: string,
    ctx: RowContext,
  ): Promise<{ outcome: ImportRowOutcome; displayLabel: string }> {
    const name = ((ctx.resolved.name as string | null) ?? '').trim();
    const currencyValue = ((ctx.resolved.currency as string | null) ?? '').trim().toUpperCase();
    ctx.resolved.currency = currencyValue;
    const displayLabel = name;

    if (name && currencyValue) {
      const existing = await this.chargeItems
        .createQueryBuilder('c')
        .where('c.tenantId = :tenantId', { tenantId })
        .andWhere('LOWER(c.name) = LOWER(:name)', { name })
        .andWhere('UPPER(c.currency) = :currency', { currency: currencyValue })
        .getOne();
      if (existing) {
        ctx.issues.push({
          severity: 'info',
          message: `Charge item "${displayLabel}" already exists and will be skipped.`,
        });
        ctx.resolved.existingId = existing.id;
        if (ctx.issues.some((issue) => issue.severity === 'error')) {
          return { outcome: 'reject', displayLabel };
        }
        return { outcome: 'skip', displayLabel };
      }
    }

    if (ctx.issues.some((issue) => issue.severity === 'error')) {
      return { outcome: 'reject', displayLabel };
    }
    return { outcome: 'create', displayLabel };
  }

  private async enrichInventoryItem(
    tenantId: string,
    ctx: RowContext,
  ): Promise<{ outcome: ImportRowOutcome; displayLabel: string }> {
    const name = ((ctx.resolved.name as string | null) ?? '').trim();
    const branchValue = ((ctx.resolved.sportBranch as string | null) ?? '').trim();
    const displayLabel = name;

    let branchId: string | null = null;
    if (branchValue) {
      const branches = await this.branches.find({ where: { tenantId } });
      const branch = branches.find(
        (entry) =>
          entry.name.toLowerCase() === branchValue.toLowerCase() ||
          entry.code.toLowerCase() === branchValue.toLowerCase(),
      );
      if (!branch) {
        ctx.issues.push({
          field: 'sportBranch',
          severity: 'warning',
          message: `Sport branch "${branchValue}" was not found — the item will be created without a branch link.`,
        });
      } else {
        branchId = branch.id;
      }
    }
    ctx.resolved.sportBranchId = branchId;

    if (name) {
      const existing = await this.inventoryItems
        .createQueryBuilder('i')
        .where('i.tenantId = :tenantId', { tenantId })
        .andWhere('LOWER(i.name) = LOWER(:name)', { name })
        .getOne();
      if (existing) {
        ctx.issues.push({
          severity: 'info',
          message: `Inventory item "${displayLabel}" already exists and will be skipped.`,
        });
        ctx.resolved.existingId = existing.id;
        if (ctx.issues.some((issue) => issue.severity === 'error')) {
          return { outcome: 'reject', displayLabel };
        }
        return { outcome: 'skip', displayLabel };
      }
    }

    if (ctx.issues.some((issue) => issue.severity === 'error')) {
      return { outcome: 'reject', displayLabel };
    }
    return { outcome: 'create', displayLabel };
  }

  private async enrichAthlete(
    tenantId: string,
    dto: ImportPreviewDto,
    ctx: RowContext,
  ): Promise<{ outcome: ImportRowOutcome; displayLabel: string }> {
    const branches = await this.branches.find({ where: { tenantId } });
    const groups = await this.groups.find({ where: { tenantId } });

    const branchValue = (ctx.resolved.sportBranch as string | null) ?? null;
    let branchId: string | null = null;
    if (branchValue) {
      const branch = branches.find(
        (entry) =>
          entry.name.toLowerCase() === branchValue.toLowerCase() ||
          entry.code.toLowerCase() === branchValue.toLowerCase(),
      );
      if (!branch) {
        ctx.issues.push({
          field: 'sportBranch',
          severity: 'error',
          message: `Sport branch "${branchValue}" was not found in this club.`,
        });
      } else {
        branchId = branch.id;
      }
    } else if (dto.defaultSportBranchId) {
      branchId = dto.defaultSportBranchId;
    } else {
      ctx.issues.push({
        field: 'sportBranch',
        severity: 'error',
        message: 'Provide a sport branch column or pick a default sport branch.',
      });
    }
    ctx.resolved.sportBranchId = branchId;

    const groupValue = (ctx.resolved.primaryGroup as string | null) ?? null;
    let groupId: string | null = null;
    if (groupValue && branchId) {
      const group = groups.find(
        (entry) =>
          entry.sportBranchId === branchId &&
          entry.name.toLowerCase() === groupValue.toLowerCase(),
      );
      if (!group) {
        ctx.issues.push({
          field: 'primaryGroup',
          severity: 'warning',
          message: `Group "${groupValue}" was not found in the chosen sport branch — athlete will be created without a primary group.`,
        });
      } else {
        groupId = group.id;
      }
    }
    ctx.resolved.primaryGroupId = groupId;

    const status = (ctx.resolved.status as string | null) ?? AthleteStatus.ACTIVE;
    ctx.resolved.status = status;

    const firstName = (ctx.resolved.firstName as string | null) ?? '';
    const lastName = (ctx.resolved.lastName as string | null) ?? '';
    const displayLabel = `${firstName} ${lastName}`.trim();

    let outcome: ImportRowOutcome = 'create';
    if (firstName && lastName) {
      const existing = await this.athletes
        .createQueryBuilder('a')
        .where('a.tenantId = :tenantId', { tenantId })
        .andWhere('LOWER(a.firstName) = LOWER(:firstName)', { firstName })
        .andWhere('LOWER(a.lastName) = LOWER(:lastName)', { lastName })
        .getOne();
      if (existing) {
        outcome = 'skip';
        ctx.issues.push({
          severity: 'info',
          message: `Athlete "${displayLabel}" already exists and will be skipped.`,
        });
        ctx.resolved.existingId = existing.id;
      }
    }

    if (ctx.issues.some((issue) => issue.severity === 'error')) {
      return { outcome: 'reject', displayLabel };
    }
    return { outcome, displayLabel };
  }

  private async enrichGuardian(
    tenantId: string,
    ctx: RowContext,
  ): Promise<{ outcome: ImportRowOutcome; displayLabel: string }> {
    const firstName = (ctx.resolved.firstName as string | null) ?? '';
    const lastName = (ctx.resolved.lastName as string | null) ?? '';
    const phone = (ctx.resolved.phone as string | null) ?? null;
    const email = (ctx.resolved.email as string | null) ?? null;
    const displayLabel = `${firstName} ${lastName}`.trim();

    let outcome: ImportRowOutcome = 'create';
    if (firstName && lastName) {
      const candidates = await this.guardians
        .createQueryBuilder('g')
        .where('g.tenantId = :tenantId', { tenantId })
        .andWhere('LOWER(g.firstName) = LOWER(:firstName)', { firstName })
        .andWhere('LOWER(g.lastName) = LOWER(:lastName)', { lastName })
        .getMany();
      const match =
        candidates.find((candidate) => phone && candidate.phone === phone) ??
        candidates.find((candidate) => email && candidate.email && candidate.email.toLowerCase() === email.toLowerCase()) ??
        candidates[0];
      if (match) {
        outcome = 'update';
        ctx.issues.push({
          severity: 'info',
          message: `Existing guardian "${displayLabel}" will be updated with the new contact details.`,
        });
        ctx.resolved.existingId = match.id;
      }
    }
    if (ctx.issues.some((issue) => issue.severity === 'error')) {
      return { outcome: 'reject', displayLabel };
    }
    return { outcome, displayLabel };
  }

  private async enrichRelationship(
    tenantId: string,
    ctx: RowContext,
  ): Promise<{ outcome: ImportRowOutcome; displayLabel: string }> {
    const athleteFirst = (ctx.resolved.athleteFirstName as string | null) ?? '';
    const athleteLast = (ctx.resolved.athleteLastName as string | null) ?? '';
    const guardianFirst = (ctx.resolved.guardianFirstName as string | null) ?? '';
    const guardianLast = (ctx.resolved.guardianLastName as string | null) ?? '';
    const displayLabel = `${athleteFirst} ${athleteLast} ↔ ${guardianFirst} ${guardianLast}`.trim();

    const athlete = await this.athletes
      .createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId })
      .andWhere('LOWER(a.firstName) = LOWER(:firstName)', { firstName: athleteFirst })
      .andWhere('LOWER(a.lastName) = LOWER(:lastName)', { lastName: athleteLast })
      .getOne();
    if (!athlete) {
      ctx.issues.push({
        field: 'athleteLastName',
        severity: 'error',
        message: `No athlete called "${athleteFirst} ${athleteLast}" was found.`,
      });
    } else {
      ctx.resolved.athleteId = athlete.id;
    }

    const guardian = await this.guardians
      .createQueryBuilder('g')
      .where('g.tenantId = :tenantId', { tenantId })
      .andWhere('LOWER(g.firstName) = LOWER(:firstName)', { firstName: guardianFirst })
      .andWhere('LOWER(g.lastName) = LOWER(:lastName)', { lastName: guardianLast })
      .getOne();
    if (!guardian) {
      ctx.issues.push({
        field: 'guardianLastName',
        severity: 'error',
        message: `No guardian called "${guardianFirst} ${guardianLast}" was found.`,
      });
    } else {
      ctx.resolved.guardianId = guardian.id;
    }

    if (ctx.issues.some((issue) => issue.severity === 'error')) {
      return { outcome: 'reject', displayLabel };
    }

    if (athlete && guardian) {
      const existing = await this.athleteGuardians.findOne({
        where: { tenantId, athleteId: athlete.id, guardianId: guardian.id },
      });
      if (existing) {
        ctx.resolved.existingId = existing.id;
        ctx.issues.push({
          severity: 'info',
          message: `Existing link will be updated with the new relationship details.`,
        });
        return { outcome: 'update', displayLabel };
      }
    }

    return { outcome: 'create', displayLabel };
  }

  private async enrichGroup(
    tenantId: string,
    ctx: RowContext,
  ): Promise<{ outcome: ImportRowOutcome; displayLabel: string }> {
    const branches = await this.branches.find({ where: { tenantId } });
    const branchValue = (ctx.resolved.sportBranch as string | null) ?? null;
    let branchId: string | null = null;
    if (branchValue) {
      const branch = branches.find(
        (entry) =>
          entry.name.toLowerCase() === branchValue.toLowerCase() ||
          entry.code.toLowerCase() === branchValue.toLowerCase(),
      );
      if (!branch) {
        ctx.issues.push({
          field: 'sportBranch',
          severity: 'error',
          message: `Sport branch "${branchValue}" was not found in this club.`,
        });
      } else {
        branchId = branch.id;
      }
    }
    ctx.resolved.sportBranchId = branchId;

    const coachValue = (ctx.resolved.headCoachName as string | null) ?? null;
    let coachId: string | null = null;
    if (coachValue) {
      const coaches = await this.coaches.find({ where: { tenantId } });
      const coach = coaches.find((entry) => {
        const full = `${entry.firstName} ${entry.lastName}`.trim().toLowerCase();
        const preferred = (entry.preferredName ?? '').trim().toLowerCase();
        const value = coachValue.trim().toLowerCase();
        return full === value || (preferred && preferred === value);
      });
      if (!coach) {
        ctx.issues.push({
          field: 'headCoachName',
          severity: 'warning',
          message: `Coach "${coachValue}" was not found — the group will be created without a head coach.`,
        });
      } else {
        coachId = coach.id;
      }
    }
    ctx.resolved.headCoachId = coachId;

    const name = (ctx.resolved.name as string | null) ?? '';
    const displayLabel = name.trim();

    let outcome: ImportRowOutcome = 'create';
    if (name && branchId) {
      const existing = await this.groups
        .createQueryBuilder('g')
        .where('g.tenantId = :tenantId', { tenantId })
        .andWhere('g.sportBranchId = :branchId', { branchId })
        .andWhere('LOWER(g.name) = LOWER(:name)', { name })
        .getOne();
      if (existing) {
        outcome = 'skip';
        ctx.issues.push({
          severity: 'info',
          message: `Group "${displayLabel}" already exists in this sport branch and will be skipped.`,
        });
        ctx.resolved.existingId = existing.id;
      }
    }

    if (ctx.issues.some((issue) => issue.severity === 'error')) {
      return { outcome: 'reject', displayLabel };
    }
    return { outcome, displayLabel };
  }

  private async commitGroups(
    manager: import('typeorm').EntityManager,
    tenantId: string,
    rows: ImportRowReport[],
  ): Promise<{ created: number; updated: number; skipped: number }> {
    const repo = manager.getRepository(ClubGroup);
    let created = 0;
    let skipped = 0;
    for (const row of rows) {
      if (row.outcome === 'reject') continue;
      if (row.outcome === 'skip') {
        skipped += 1;
        continue;
      }
      const branchId = row.resolved.sportBranchId as string | null;
      const name = (row.resolved.name as string | null) ?? '';
      if (!branchId || !name) {
        skipped += 1;
        continue;
      }
      await repo.save(
        repo.create({
          tenantId,
          sportBranchId: branchId,
          name,
          headCoachId: (row.resolved.headCoachId as string | null) ?? null,
          ageGroupId: null,
        }),
      );
      created += 1;
    }
    return { created, updated: 0, skipped };
  }

  private async commitAthletes(
    manager: import('typeorm').EntityManager,
    tenantId: string,
    dto: ImportCommitDto,
    rows: ImportRowReport[],
  ): Promise<{ created: number; updated: number; skipped: number }> {
    const repo = manager.getRepository(Athlete);
    let created = 0;
    let skipped = 0;
    for (const row of rows) {
      if (row.outcome === 'reject') continue;
      if (row.outcome === 'skip') {
        skipped += 1;
        continue;
      }
      const branchId = row.resolved.sportBranchId as string | null;
      if (!branchId) {
        skipped += 1;
        continue;
      }
      const entity = repo.create({
        tenantId,
        firstName: (row.resolved.firstName as string) ?? '',
        lastName: (row.resolved.lastName as string) ?? '',
        preferredName: (row.resolved.preferredName as string | null) ?? null,
        birthDate: row.resolved.birthDate ? new Date(row.resolved.birthDate as string) : null,
        gender: (row.resolved.gender as string | null) ?? null,
        sportBranchId: branchId,
        primaryGroupId: (row.resolved.primaryGroupId as string | null) ?? null,
        status: ((row.resolved.status as string | null) ?? AthleteStatus.ACTIVE) as AthleteStatus,
        jerseyNumber: (row.resolved.jerseyNumber as string | null) ?? null,
        notes: (row.resolved.notes as string | null) ?? null,
      });
      await repo.save(entity);
      created += 1;
    }
    return { created, updated: 0, skipped };
  }

  private async commitGuardians(
    manager: import('typeorm').EntityManager,
    tenantId: string,
    rows: ImportRowReport[],
  ): Promise<{ created: number; updated: number; skipped: number }> {
    const repo = manager.getRepository(Guardian);
    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const row of rows) {
      if (row.outcome === 'reject') continue;
      if (row.outcome === 'skip') {
        skipped += 1;
        continue;
      }
      const existingId = row.resolved.existingId as string | undefined;
      if (existingId) {
        const existing = await repo.findOne({ where: { id: existingId, tenantId } });
        if (!existing) {
          skipped += 1;
          continue;
        }
        existing.firstName = (row.resolved.firstName as string) ?? existing.firstName;
        existing.lastName = (row.resolved.lastName as string) ?? existing.lastName;
        existing.phone = (row.resolved.phone as string | null) ?? existing.phone;
        existing.email = (row.resolved.email as string | null) ?? existing.email;
        existing.notes = (row.resolved.notes as string | null) ?? existing.notes;
        await repo.save(existing);
        updated += 1;
      } else {
        await repo.save(
          repo.create({
            tenantId,
            firstName: (row.resolved.firstName as string) ?? '',
            lastName: (row.resolved.lastName as string) ?? '',
            phone: (row.resolved.phone as string | null) ?? null,
            email: (row.resolved.email as string | null) ?? null,
            notes: (row.resolved.notes as string | null) ?? null,
          }),
        );
        created += 1;
      }
    }
    return { created, updated, skipped };
  }

  private async commitSportBranches(
    manager: import('typeorm').EntityManager,
    tenantId: string,
    rows: ImportRowReport[],
  ): Promise<{ created: number; updated: number; skipped: number }> {
    const repo = manager.getRepository(SportBranch);
    let created = 0;
    let skipped = 0;
    for (const row of rows) {
      if (row.outcome === 'reject') continue;
      if (row.outcome === 'skip') {
        skipped += 1;
        continue;
      }
      const name = ((row.resolved.name as string | null) ?? '').trim();
      const code = ((row.resolved.code as string | null) ?? '').trim().toUpperCase();
      if (!name || !code) {
        skipped += 1;
        continue;
      }
      await repo.save(repo.create({ tenantId, name, code }));
      created += 1;
    }
    return { created, updated: 0, skipped };
  }

  private async commitCoaches(
    manager: import('typeorm').EntityManager,
    tenantId: string,
    rows: ImportRowReport[],
  ): Promise<{ created: number; updated: number; skipped: number }> {
    const repo = manager.getRepository(Coach);
    let created = 0;
    let skipped = 0;
    for (const row of rows) {
      if (row.outcome === 'reject') continue;
      if (row.outcome === 'skip') {
        skipped += 1;
        continue;
      }
      const branchId = row.resolved.sportBranchId as string | null;
      if (!branchId) {
        skipped += 1;
        continue;
      }
      await repo.save(
        repo.create({
          tenantId,
          sportBranchId: branchId,
          firstName: (row.resolved.firstName as string) ?? '',
          lastName: (row.resolved.lastName as string) ?? '',
          preferredName: (row.resolved.preferredName as string | null) ?? null,
          phone: (row.resolved.phone as string | null) ?? null,
          email: (row.resolved.email as string | null) ?? null,
          specialties: (row.resolved.specialties as string | null) ?? null,
          notes: (row.resolved.notes as string | null) ?? null,
          isActive: true,
        }),
      );
      created += 1;
    }
    return { created, updated: 0, skipped };
  }

  private async commitTeams(
    manager: import('typeorm').EntityManager,
    tenantId: string,
    rows: ImportRowReport[],
  ): Promise<{ created: number; updated: number; skipped: number }> {
    const repo = manager.getRepository(Team);
    let created = 0;
    let skipped = 0;
    for (const row of rows) {
      if (row.outcome === 'reject') continue;
      if (row.outcome === 'skip') {
        skipped += 1;
        continue;
      }
      const branchId = row.resolved.sportBranchId as string | null;
      const name = ((row.resolved.name as string | null) ?? '').trim();
      if (!branchId || !name) {
        skipped += 1;
        continue;
      }
      await repo.save(
        repo.create({
          tenantId,
          sportBranchId: branchId,
          groupId: (row.resolved.groupId as string | null) ?? null,
          name,
          code: (row.resolved.code as string | null) ?? null,
          headCoachId: (row.resolved.headCoachId as string | null) ?? null,
        }),
      );
      created += 1;
    }
    return { created, updated: 0, skipped };
  }

  private async commitChargeItems(
    manager: import('typeorm').EntityManager,
    tenantId: string,
    rows: ImportRowReport[],
  ): Promise<{ created: number; updated: number; skipped: number }> {
    const repo = manager.getRepository(ChargeItem);
    let created = 0;
    let skipped = 0;
    for (const row of rows) {
      if (row.outcome === 'reject') continue;
      if (row.outcome === 'skip') {
        skipped += 1;
        continue;
      }
      const name = ((row.resolved.name as string | null) ?? '').trim();
      const category = ((row.resolved.category as string | null) ?? '').trim();
      const amount = row.resolved.defaultAmount;
      const currency = ((row.resolved.currency as string | null) ?? '').trim().toUpperCase();
      if (!name || !category || amount === null || amount === undefined || !currency) {
        skipped += 1;
        continue;
      }
      await repo.save(
        repo.create({
          tenantId,
          name,
          category,
          defaultAmount: Number(amount).toFixed(2),
          currency,
          isActive: true,
        }),
      );
      created += 1;
    }
    return { created, updated: 0, skipped };
  }

  private async commitInventoryItems(
    manager: import('typeorm').EntityManager,
    tenantId: string,
    rows: ImportRowReport[],
  ): Promise<{ created: number; updated: number; skipped: number }> {
    const itemRepo = manager.getRepository(InventoryItem);
    const variantRepo = manager.getRepository(InventoryVariant);
    const movementRepo = manager.getRepository(InventoryMovement);
    let created = 0;
    let skipped = 0;
    for (const row of rows) {
      if (row.outcome === 'reject') continue;
      if (row.outcome === 'skip') {
        skipped += 1;
        continue;
      }
      const name = ((row.resolved.name as string | null) ?? '').trim();
      const categoryRaw = ((row.resolved.category as string | null) ?? '').toLowerCase();
      if (!name || !categoryRaw) {
        skipped += 1;
        continue;
      }
      const category = (Object.values(InventoryCategory) as string[]).includes(categoryRaw)
        ? (categoryRaw as InventoryCategory)
        : InventoryCategory.OTHER;
      const trackAssignment = Boolean(row.resolved.trackAssignment);
      const initialStock = Math.max(Number(row.resolved.initialStock ?? 0) || 0, 0);
      const lowStock = Math.max(Number(row.resolved.lowStockThreshold ?? 0) || 0, 0);
      const item = await itemRepo.save(
        itemRepo.create({
          tenantId,
          name,
          category,
          sportBranchId: (row.resolved.sportBranchId as string | null) ?? null,
          hasVariants: false,
          trackAssignment,
          lowStockThreshold: lowStock,
          description: (row.resolved.description as string | null) ?? null,
          isActive: true,
        }),
      );
      const variant = await variantRepo.save(
        variantRepo.create({
          tenantId,
          inventoryItemId: item.id,
          size: null,
          number: null,
          color: null,
          isDefault: true,
          stockOnHand: initialStock,
          assignedCount: 0,
          lowStockThreshold: null,
          isActive: true,
        }),
      );
      if (initialStock > 0) {
        await movementRepo.save(
          movementRepo.create({
            tenantId,
            inventoryItemId: item.id,
            inventoryVariantId: variant.id,
            type: InventoryMovementType.STOCK_ADDED,
            quantity: initialStock,
            athleteId: null,
            note: 'Initial stock (onboarding import)',
          }),
        );
      }
      created += 1;
    }
    return { created, updated: 0, skipped };
  }

  private async commitAthleteGuardians(
    manager: import('typeorm').EntityManager,
    tenantId: string,
    rows: ImportRowReport[],
  ): Promise<{ created: number; updated: number; skipped: number }> {
    const repo = manager.getRepository(AthleteGuardian);
    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const row of rows) {
      if (row.outcome === 'reject') continue;
      if (row.outcome === 'skip') {
        skipped += 1;
        continue;
      }
      const athleteId = row.resolved.athleteId as string | undefined;
      const guardianId = row.resolved.guardianId as string | undefined;
      if (!athleteId || !guardianId) {
        skipped += 1;
        continue;
      }
      const relationshipType = ((row.resolved.relationshipType as string | null) ?? 'guardian').toLowerCase();
      const isPrimaryContact = Boolean(row.resolved.isPrimaryContact);
      const notes = (row.resolved.notes as string | null) ?? null;
      const existingId = row.resolved.existingId as string | undefined;
      if (isPrimaryContact) {
        await repo.update({ tenantId, athleteId }, { isPrimaryContact: false });
      }
      if (existingId) {
        const existing = await repo.findOne({ where: { id: existingId, tenantId } });
        if (!existing) {
          skipped += 1;
          continue;
        }
        existing.relationshipType = relationshipType;
        existing.isPrimaryContact = isPrimaryContact;
        existing.notes = notes;
        await repo.save(existing);
        updated += 1;
      } else {
        await repo.save(
          repo.create({
            tenantId,
            athleteId,
            guardianId,
            relationshipType,
            isPrimaryContact,
            notes,
          }),
        );
        created += 1;
      }
    }
    return { created, updated, skipped };
  }
}

function summariseCounts(rows: ImportRowReport[]): ImportSummaryCounts {
  let createReady = 0;
  let updateReady = 0;
  let skipReady = 0;
  let rejected = 0;
  let warnings = 0;
  for (const row of rows) {
    switch (row.outcome) {
      case 'create':
        createReady += 1;
        break;
      case 'update':
        updateReady += 1;
        break;
      case 'skip':
        skipReady += 1;
        break;
      case 'reject':
        rejected += 1;
        break;
    }
    warnings += row.issues.filter((issue) => issue.severity === 'warning').length;
  }
  return {
    total: rows.length,
    createReady,
    updateReady,
    skipReady,
    rejected,
    warnings,
  };
}

function invertMapping(
  columnMapping: Record<string, string>,
  fieldByKey: Map<string, ImportFieldDefinition>,
): Map<string, string> {
  const reverse = new Map<string, string>();
  for (const [sourceCol, targetKey] of Object.entries(columnMapping ?? {})) {
    if (!targetKey) continue;
    if (!fieldByKey.has(targetKey)) continue;
    if (!reverse.has(targetKey)) {
      reverse.set(targetKey, sourceCol);
    }
  }
  return reverse;
}

function normaliseCell(raw: string | number | boolean | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'boolean') return raw ? 'true' : 'false';
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null;
    return String(raw);
  }
  const text = String(raw).trim();
  return text === '' ? null : text;
}

function parseDateLike(raw: string): string | null {
  const trimmed = raw.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    return trimmed;
  }
  const dmyMatch = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(trimmed);
  if (dmyMatch) {
    const [, dd, mm, yyyy] = dmyMatch;
    const day = dd.padStart(2, '0');
    const month = mm.padStart(2, '0');
    const date = new Date(`${yyyy}-${month}-${day}T00:00:00Z`);
    if (!Number.isNaN(date.getTime())) {
      return `${yyyy}-${month}-${day}`;
    }
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getUTCFullYear();
    const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const day = String(parsed.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return null;
}

function inferDisplayLabel(
  entity: ImportEntityKey,
  resolved: Record<string, ImportResolvedValue>,
): string {
  switch (entity) {
    case 'athletes':
    case 'guardians':
    case 'coaches':
      return `${resolved.firstName ?? ''} ${resolved.lastName ?? ''}`.trim();
    case 'athlete_guardians':
      return `${resolved.athleteFirstName ?? ''} ${resolved.athleteLastName ?? ''} ↔ ${resolved.guardianFirstName ?? ''} ${resolved.guardianLastName ?? ''}`.trim();
    case 'sport_branches':
    case 'groups':
    case 'teams':
    case 'charge_items':
    case 'inventory_items':
      return ((resolved.name as string | null) ?? '').trim();
    default:
      return '';
  }
}

function csvRow(values: Array<string | number | boolean | null>): string {
  return values
    .map((value) => {
      if (value === null || value === undefined) return '';
      const text = String(value);
      if (/[",\r\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    })
    .join(',');
}
