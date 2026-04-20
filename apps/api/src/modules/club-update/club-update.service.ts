import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ClubUpdate } from '../../database/entities/club-update.entity';
import { ClubGroup } from '../../database/entities/club-group.entity';
import { SportBranch } from '../../database/entities/sport-branch.entity';
import { Team } from '../../database/entities/team.entity';
import {
  ClubUpdateAudience,
  ClubUpdateInput,
  ClubUpdateParentSummary,
  ClubUpdatePayload,
  PARENT_PORTAL_MAX_CLUB_UPDATES,
  ParentAudienceSet,
  STAFF_CLUB_UPDATES_LIMIT,
  clubUpdateMatchesParentAudience,
} from './club-update.types';

const SAFE_URL = /^(https?:\/\/|\/)[^\s"'<>]+$/i;

/**
 * Parent Portal v1.1 + v1.2 — Club Updates layer.
 *
 * Service for the lightweight club updates surface. Strictly tenant
 * scoped through the repository where clauses; we never accept a tenantId
 * from a request body, only from the resolved request context.
 *
 * The shape is intentionally narrow:
 *   - staff list/create/update/delete cards;
 *   - parents read a small, sorted, status-filtered, audience-targeted
 *     slice with no authoring affordances at all.
 */
@Injectable()
export class ClubUpdateService {
  constructor(
    @InjectRepository(ClubUpdate)
    private readonly updates: Repository<ClubUpdate>,
    @InjectRepository(SportBranch)
    private readonly branches: Repository<SportBranch>,
    @InjectRepository(ClubGroup)
    private readonly groups: Repository<ClubGroup>,
    @InjectRepository(Team)
    private readonly teams: Repository<Team>,
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

  /**
   * Validates an audience input on save and resolves the targeting id
   * against the current tenant. Anything that does not match is rejected
   * up front so a misconfigured card never reaches a parent payload.
   */
  private async resolveAudience(
    tenantId: string,
    input: Pick<
      ClubUpdateInput,
      'audienceScope' | 'audienceSportBranchId' | 'audienceGroupId' | 'audienceTeamId'
    >,
    fallback?: ClubUpdateAudience,
  ): Promise<{
    scope: ClubUpdate['audienceScope'];
    sportBranchId: string | null;
    groupId: string | null;
    teamId: string | null;
  }> {
    const scope =
      input.audienceScope ?? (fallback ? fallback.scope : 'all');

    if (scope === 'all') {
      return { scope, sportBranchId: null, groupId: null, teamId: null };
    }

    if (scope === 'sport_branch') {
      const id = input.audienceSportBranchId ?? fallback?.sportBranchId ?? null;
      if (!id) {
        throw new BadRequestException('Sport branch is required when targeting a sport branch.');
      }
      const branch = await this.branches.findOne({ where: { id, tenantId } });
      if (!branch) {
        throw new BadRequestException('Sport branch does not belong to this club.');
      }
      return { scope, sportBranchId: id, groupId: null, teamId: null };
    }

    if (scope === 'group') {
      const id = input.audienceGroupId ?? fallback?.groupId ?? null;
      if (!id) {
        throw new BadRequestException('Group is required when targeting a group.');
      }
      const group = await this.groups.findOne({ where: { id, tenantId } });
      if (!group) {
        throw new BadRequestException('Group does not belong to this club.');
      }
      return { scope, sportBranchId: null, groupId: id, teamId: null };
    }

    if (scope === 'team') {
      const id = input.audienceTeamId ?? fallback?.teamId ?? null;
      if (!id) {
        throw new BadRequestException('Team is required when targeting a team.');
      }
      const team = await this.teams.findOne({ where: { id, tenantId } });
      if (!team) {
        throw new BadRequestException('Team does not belong to this club.');
      }
      return { scope, sportBranchId: null, groupId: null, teamId: id };
    }

    return { scope: 'all', sportBranchId: null, groupId: null, teamId: null };
  }

  private async resolveAudienceLabels(
    tenantId: string,
    rows: ClubUpdate[],
  ): Promise<Map<string, string>> {
    const branchIds = new Set<string>();
    const groupIds = new Set<string>();
    const teamIds = new Set<string>();
    for (const row of rows) {
      if (row.audienceSportBranchId) branchIds.add(row.audienceSportBranchId);
      if (row.audienceGroupId) groupIds.add(row.audienceGroupId);
      if (row.audienceTeamId) teamIds.add(row.audienceTeamId);
    }
    const labels = new Map<string, string>();
    if (branchIds.size) {
      const branches = await this.branches.find({
        where: { tenantId, id: In(Array.from(branchIds)) },
      });
      branches.forEach((b) => labels.set(`sport_branch:${b.id}`, b.name));
    }
    if (groupIds.size) {
      const groups = await this.groups.find({
        where: { tenantId, id: In(Array.from(groupIds)) },
      });
      groups.forEach((g) => labels.set(`group:${g.id}`, g.name));
    }
    if (teamIds.size) {
      const teams = await this.teams.find({
        where: { tenantId, id: In(Array.from(teamIds)) },
      });
      teams.forEach((tm) => labels.set(`team:${tm.id}`, tm.name));
    }
    return labels;
  }

  private toAudience(row: ClubUpdate, labels: Map<string, string>): ClubUpdateAudience {
    if (row.audienceScope === 'sport_branch' && row.audienceSportBranchId) {
      return {
        scope: 'sport_branch',
        sportBranchId: row.audienceSportBranchId,
        groupId: null,
        teamId: null,
        label: labels.get(`sport_branch:${row.audienceSportBranchId}`) ?? null,
      };
    }
    if (row.audienceScope === 'group' && row.audienceGroupId) {
      return {
        scope: 'group',
        sportBranchId: null,
        groupId: row.audienceGroupId,
        teamId: null,
        label: labels.get(`group:${row.audienceGroupId}`) ?? null,
      };
    }
    if (row.audienceScope === 'team' && row.audienceTeamId) {
      return {
        scope: 'team',
        sportBranchId: null,
        groupId: null,
        teamId: row.audienceTeamId,
        label: labels.get(`team:${row.audienceTeamId}`) ?? null,
      };
    }
    return { scope: 'all', sportBranchId: null, groupId: null, teamId: null, label: null };
  }

  private toPayload(
    row: ClubUpdate,
    labels: Map<string, string>,
    now = new Date(),
  ): ClubUpdatePayload {
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
      audience: this.toAudience(row, labels),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toParentSummary(
    row: ClubUpdate,
    labels: Map<string, string>,
    now = new Date(),
  ): ClubUpdateParentSummary {
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
      audience: this.toAudience(row, labels),
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
    const labels = await this.resolveAudienceLabels(tenantId, rows);
    return rows.map((row) => this.toPayload(row, labels, now));
  }

  /**
   * Parent Portal v1.2 — only return cards whose audience matches the
   * caller's derived audience set. Staff don't pick parents directly; we
   * intersect the card's scope (sport_branch / group / team / all)
   * against the union of every linked athlete's branch / group / team
   * memberships. Tenant isolation still flows through the where clause.
   */
  async listForParents(
    tenantId: string,
    audience: ParentAudienceSet,
  ): Promise<ClubUpdateParentSummary[]> {
    const now = new Date();
    const rows = await this.updates.find({
      where: { tenantId, status: 'published' },
      take: 100,
      order: { publishedAt: 'DESC' },
    });
    const labels = await this.resolveAudienceLabels(tenantId, rows);
    const visible = rows.filter((row) => {
      if (!row.publishedAt || row.publishedAt.getTime() > now.getTime()) return false;
      if (row.expiresAt && row.expiresAt.getTime() < now.getTime()) return false;
      return clubUpdateMatchesParentAudience({ audience: this.toAudience(row, labels) }, audience);
    });
    visible.sort((a, b) => this.compareForDisplay(a, b, now));
    return visible.slice(0, PARENT_PORTAL_MAX_CLUB_UPDATES).map((row) =>
      this.toParentSummary(row, labels, now),
    );
  }

  async getOne(tenantId: string, id: string): Promise<ClubUpdatePayload> {
    const row = await this.updates.findOne({ where: { tenantId, id } });
    if (!row) {
      throw new NotFoundException('Club update not found');
    }
    const labels = await this.resolveAudienceLabels(tenantId, [row]);
    return this.toPayload(row, labels);
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
    const audience = await this.resolveAudience(tenantId, input);
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
      audienceScope: audience.scope,
      audienceSportBranchId: audience.sportBranchId,
      audienceGroupId: audience.groupId,
      audienceTeamId: audience.teamId,
    });
    const saved = await this.updates.save(row);
    const labels = await this.resolveAudienceLabels(tenantId, [saved]);
    return this.toPayload(saved, labels);
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

    const audienceTouched =
      input.audienceScope !== undefined ||
      input.audienceSportBranchId !== undefined ||
      input.audienceGroupId !== undefined ||
      input.audienceTeamId !== undefined;
    if (audienceTouched) {
      const fallback: ClubUpdateAudience = {
        scope: row.audienceScope,
        sportBranchId: row.audienceSportBranchId,
        groupId: row.audienceGroupId,
        teamId: row.audienceTeamId,
        label: null,
      };
      const audience = await this.resolveAudience(tenantId, input, fallback);
      row.audienceScope = audience.scope;
      row.audienceSportBranchId = audience.sportBranchId;
      row.audienceGroupId = audience.groupId;
      row.audienceTeamId = audience.teamId;
    }

    const saved = await this.updates.save(row);
    const labels = await this.resolveAudienceLabels(tenantId, [saved]);
    return this.toPayload(saved, labels);
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

  /**
   * Parent Portal v1.2 — list of available targeting handles for the
   * staff editor. Kept tiny on purpose: just the small lists of branches
   * / groups / teams the club actually has, with stable display labels.
   */
  async listAudienceOptions(tenantId: string): Promise<{
    sportBranches: Array<{ id: string; name: string }>;
    groups: Array<{ id: string; name: string; sportBranchId: string | null }>;
    teams: Array<{ id: string; name: string; sportBranchId: string | null; groupId: string | null }>;
  }> {
    const [branches, groups, teams] = await Promise.all([
      this.branches.find({ where: { tenantId }, order: { name: 'ASC' } }),
      this.groups.find({ where: { tenantId }, order: { name: 'ASC' } }),
      this.teams.find({ where: { tenantId }, order: { name: 'ASC' } }),
    ]);
    return {
      sportBranches: branches.map((b) => ({ id: b.id, name: b.name })),
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        sportBranchId: g.sportBranchId ?? null,
      })),
      teams: teams.map((tm) => ({
        id: tm.id,
        name: tm.name,
        sportBranchId: tm.sportBranchId ?? null,
        groupId: tm.groupId ?? null,
      })),
    };
  }
}
