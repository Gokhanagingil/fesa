import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClubUpdate } from '../../database/entities/club-update.entity';
import {
  ClubUpdateInput,
  ClubUpdateParentSummary,
  ClubUpdatePayload,
  PARENT_PORTAL_MAX_CLUB_UPDATES,
  STAFF_CLUB_UPDATES_LIMIT,
} from './club-update.types';

const SAFE_URL = /^(https?:\/\/|\/)[^\s"'<>]+$/i;

/**
 * Parent Portal v1.1 — Club Updates layer.
 *
 * Service for the lightweight club updates surface. Strictly tenant
 * scoped through the repository where clauses; we never accept a tenantId
 * from a request body, only from the resolved request context.
 *
 * The shape is intentionally narrow:
 *   - staff list/create/update/delete cards;
 *   - parents read a small, sorted, status-filtered slice with no
 *     authoring affordances at all.
 */
@Injectable()
export class ClubUpdateService {
  constructor(
    @InjectRepository(ClubUpdate)
    private readonly updates: Repository<ClubUpdate>,
  ) {}

  private clamp(value: string | undefined | null, max: number): string | null {
    if (value == null) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    return trimmed.slice(0, max);
  }

  private requiredClamp(value: string | undefined, max: number, field: string): string {
    const next = this.clamp(value, max);
    if (!next) {
      throw new BadRequestException(`${field} is required`);
    }
    return next;
  }

  private normalizeUrl(value: string | null | undefined): string | null {
    const trimmed = this.clamp(value, 512);
    if (!trimmed) return null;
    if (!SAFE_URL.test(trimmed)) {
      throw new BadRequestException(
        'Link must be an absolute https:// URL or a path beginning with /',
      );
    }
    return trimmed;
  }

  private parseDate(value: string | null | undefined): Date | null {
    if (value === undefined) return undefined as unknown as Date | null;
    if (value === null) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid date — use ISO 8601 (for example 2026-04-25T18:00:00Z)');
    }
    return parsed;
  }

  private toPayload(row: ClubUpdate, now = new Date()): ClubUpdatePayload {
    const pinned = Boolean(row.pinnedUntil && row.pinnedUntil.getTime() > now.getTime());
    const expired = Boolean(row.expiresAt && row.expiresAt.getTime() < now.getTime());
    return {
      id: row.id,
      tenantId: row.tenantId,
      category: row.category,
      status: row.status,
      title: row.title,
      body: row.body,
      linkUrl: row.linkUrl,
      linkLabel: row.linkLabel,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      pinnedUntil: row.pinnedUntil ? row.pinnedUntil.toISOString() : null,
      pinned,
      expired,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toParentSummary(row: ClubUpdate, now = new Date()): ClubUpdateParentSummary {
    const pinned = Boolean(row.pinnedUntil && row.pinnedUntil.getTime() > now.getTime());
    return {
      id: row.id,
      category: row.category,
      title: row.title,
      body: row.body,
      linkUrl: row.linkUrl,
      linkLabel: row.linkLabel,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      pinned,
    };
  }

  /**
   * Sort order used in both the staff list and the parent list:
   *   1. pinned (active pin) first,
   *   2. then by published-at desc, falling back to updated-at.
   */
  private compareForDisplay(a: ClubUpdate, b: ClubUpdate, now: Date): number {
    const aPinned = a.pinnedUntil && a.pinnedUntil.getTime() > now.getTime() ? 1 : 0;
    const bPinned = b.pinnedUntil && b.pinnedUntil.getTime() > now.getTime() ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;
    const aWhen = (a.publishedAt ?? a.updatedAt).getTime();
    const bWhen = (b.publishedAt ?? b.updatedAt).getTime();
    return bWhen - aWhen;
  }

  async listForStaff(tenantId: string): Promise<ClubUpdatePayload[]> {
    const now = new Date();
    const rows = await this.updates.find({
      where: { tenantId },
      take: STAFF_CLUB_UPDATES_LIMIT,
      order: { updatedAt: 'DESC' },
    });
    rows.sort((a, b) => this.compareForDisplay(a, b, now));
    return rows.map((row) => this.toPayload(row, now));
  }

  async listForParents(tenantId: string): Promise<ClubUpdateParentSummary[]> {
    const now = new Date();
    const rows = await this.updates.find({
      where: { tenantId, status: 'published' },
      take: 50,
      order: { publishedAt: 'DESC' },
    });
    const visible = rows.filter((row) => {
      if (!row.publishedAt || row.publishedAt.getTime() > now.getTime()) return false;
      if (row.expiresAt && row.expiresAt.getTime() < now.getTime()) return false;
      return true;
    });
    visible.sort((a, b) => this.compareForDisplay(a, b, now));
    return visible.slice(0, PARENT_PORTAL_MAX_CLUB_UPDATES).map((row) => this.toParentSummary(row, now));
  }

  async getOne(tenantId: string, id: string): Promise<ClubUpdatePayload> {
    const row = await this.updates.findOne({ where: { tenantId, id } });
    if (!row) {
      throw new NotFoundException('Club update not found');
    }
    return this.toPayload(row);
  }

  async create(tenantId: string, input: ClubUpdateInput): Promise<ClubUpdatePayload> {
    const title = this.requiredClamp(input.title, 140, 'Title');
    const body = this.requiredClamp(input.body, 600, 'Body');
    const status = input.status ?? 'draft';
    const publishedAt =
      status === 'published'
        ? this.parseDate(input.publishedAt) ?? new Date()
        : input.publishedAt !== undefined
          ? this.parseDate(input.publishedAt)
          : null;
    const row = this.updates.create({
      tenantId,
      category: input.category ?? 'announcement',
      status,
      title,
      body,
      linkUrl: this.normalizeUrl(input.linkUrl),
      linkLabel: this.clamp(input.linkLabel, 80),
      publishedAt: publishedAt ?? null,
      expiresAt: input.expiresAt !== undefined ? this.parseDate(input.expiresAt) : null,
      pinnedUntil: input.pinnedUntil !== undefined ? this.parseDate(input.pinnedUntil) : null,
    });
    const saved = await this.updates.save(row);
    return this.toPayload(saved);
  }

  async update(tenantId: string, id: string, input: ClubUpdateInput): Promise<ClubUpdatePayload> {
    const row = await this.updates.findOne({ where: { tenantId, id } });
    if (!row) {
      throw new NotFoundException('Club update not found');
    }
    if (input.category !== undefined) row.category = input.category;
    if (input.title !== undefined) row.title = this.requiredClamp(input.title, 140, 'Title');
    if (input.body !== undefined) row.body = this.requiredClamp(input.body, 600, 'Body');
    if (input.linkUrl !== undefined) row.linkUrl = this.normalizeUrl(input.linkUrl);
    if (input.linkLabel !== undefined) row.linkLabel = this.clamp(input.linkLabel, 80);
    if (input.expiresAt !== undefined) row.expiresAt = this.parseDate(input.expiresAt);
    if (input.pinnedUntil !== undefined) row.pinnedUntil = this.parseDate(input.pinnedUntil);

    if (input.status !== undefined) {
      row.status = input.status;
      if (input.status === 'published' && !row.publishedAt) {
        row.publishedAt = this.parseDate(input.publishedAt ?? null) ?? new Date();
      }
    } else if (input.publishedAt !== undefined) {
      row.publishedAt = this.parseDate(input.publishedAt);
    }
    const saved = await this.updates.save(row);
    return this.toPayload(saved);
  }

  async publish(tenantId: string, id: string): Promise<ClubUpdatePayload> {
    return this.update(tenantId, id, { status: 'published' });
  }

  async archive(tenantId: string, id: string): Promise<ClubUpdatePayload> {
    return this.update(tenantId, id, { status: 'archived' });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    const row = await this.updates.findOne({ where: { tenantId, id } });
    if (!row) {
      throw new NotFoundException('Club update not found');
    }
    await this.updates.delete({ tenantId, id });
  }
}
