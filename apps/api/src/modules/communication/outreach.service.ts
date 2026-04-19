import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OutreachActivity } from '../../database/entities/outreach-activity.entity';
import { StaffUser } from '../../database/entities/staff-user.entity';
import { isRelationTableMissingError } from '../core/database-error.util';
import { LogOutreachDto, OutreachStatus } from './dto/log-outreach.dto';
import { ListOutreachQueryDto } from './dto/list-outreach-query.dto';

export type OutreachActivityRecord = {
  id: string;
  channel: string;
  status: OutreachStatus;
  sourceSurface: string;
  sourceKey: string | null;
  templateKey: string | null;
  topic: string;
  messagePreview: string | null;
  recipientCount: number;
  reachableGuardianCount: number;
  audienceSnapshot: Record<string, unknown>;
  note: string | null;
  createdByStaffUserId: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
};

const VALID_STATUSES: OutreachStatus[] = ['draft', 'logged', 'archived'];

function normalizeStatus(value: string | null | undefined): OutreachStatus {
  if (value && (VALID_STATUSES as string[]).includes(value)) {
    return value as OutreachStatus;
  }
  return 'logged';
}

@Injectable()
export class OutreachService {
  constructor(
    @InjectRepository(OutreachActivity)
    private readonly activities: Repository<OutreachActivity>,
    @InjectRepository(StaffUser)
    private readonly staffUsers: Repository<StaffUser>,
  ) {}

  private toRecord(row: OutreachActivity, staffByUser: Map<string, StaffUser>): OutreachActivityRecord {
    const staff = row.createdByStaffUserId ? staffByUser.get(row.createdByStaffUserId) ?? null : null;
    const createdByName = staff
      ? staff.preferredName?.trim() || `${staff.firstName} ${staff.lastName}`.trim() || null
      : null;
    return {
      id: row.id,
      channel: row.channel,
      status: normalizeStatus(row.status),
      sourceSurface: row.sourceSurface,
      sourceKey: row.sourceKey,
      templateKey: row.templateKey,
      topic: row.topic,
      messagePreview: row.messagePreview,
      recipientCount: row.recipientCount,
      reachableGuardianCount: row.reachableGuardianCount,
      audienceSnapshot: row.audienceSnapshot ?? {},
      note: row.note,
      createdByStaffUserId: row.createdByStaffUserId,
      createdByName,
      createdAt: row.createdAt.toISOString(),
      updatedAt: (row.updatedAt ?? row.createdAt).toISOString(),
    };
  }

  private async hydrateStaff(rows: OutreachActivity[]): Promise<Map<string, StaffUser>> {
    const ids = Array.from(
      new Set(rows.map((row) => row.createdByStaffUserId).filter((value): value is string => Boolean(value))),
    );
    if (ids.length === 0) return new Map();
    const staff = await this.staffUsers.find({ where: { id: In(ids) } });
    return new Map(staff.map((row) => [row.id, row]));
  }

  async log(
    tenantId: string,
    staffUserId: string | null,
    payload: LogOutreachDto,
  ): Promise<OutreachActivityRecord> {
    const recipientCount = payload.recipientCount ?? payload.athleteIds?.length ?? 0;
    const reachableGuardianCount = payload.reachableGuardianCount ?? payload.guardianIds?.length ?? 0;
    const snapshot: Record<string, unknown> = {
      athleteIds: payload.athleteIds ?? [],
      guardianIds: payload.guardianIds ?? [],
      audienceSummary: payload.audienceSummary ?? null,
    };

    const row = this.activities.create({
      tenantId,
      channel: payload.channel,
      status: normalizeStatus(payload.status),
      sourceSurface: payload.sourceSurface,
      sourceKey: payload.sourceKey ?? null,
      templateKey: payload.templateKey ?? null,
      topic: payload.topic,
      messagePreview: payload.messagePreview ?? null,
      recipientCount,
      reachableGuardianCount,
      audienceSnapshot: snapshot,
      note: payload.note ?? null,
      createdByStaffUserId: staffUserId,
    });
    const saved = await this.activities.save(row);
    const staffByUser = await this.hydrateStaff([saved]);
    return this.toRecord(saved, staffByUser);
  }

  async findOne(tenantId: string, id: string): Promise<OutreachActivityRecord> {
    const row = await this.activities.findOne({ where: { tenantId, id } });
    if (!row) throw new NotFoundException('Follow-up not found');
    const staffByUser = await this.hydrateStaff([row]);
    return this.toRecord(row, staffByUser);
  }

  async update(
    tenantId: string,
    id: string,
    payload: LogOutreachDto,
  ): Promise<OutreachActivityRecord> {
    const row = await this.activities.findOne({ where: { tenantId, id } });
    if (!row) throw new NotFoundException('Follow-up not found');

    row.channel = payload.channel;
    row.status = normalizeStatus(payload.status ?? row.status);
    row.sourceSurface = payload.sourceSurface;
    row.sourceKey = payload.sourceKey ?? null;
    row.templateKey = payload.templateKey ?? null;
    row.topic = payload.topic;
    row.messagePreview = payload.messagePreview ?? null;
    row.recipientCount = payload.recipientCount ?? payload.athleteIds?.length ?? row.recipientCount;
    row.reachableGuardianCount =
      payload.reachableGuardianCount ?? payload.guardianIds?.length ?? row.reachableGuardianCount;
    row.audienceSnapshot = {
      athleteIds: payload.athleteIds ?? [],
      guardianIds: payload.guardianIds ?? [],
      audienceSummary: payload.audienceSummary ?? null,
    };
    row.note = payload.note ?? null;

    const saved = await this.activities.save(row);
    const staffByUser = await this.hydrateStaff([saved]);
    return this.toRecord(saved, staffByUser);
  }

  async setStatus(
    tenantId: string,
    id: string,
    status: OutreachStatus,
  ): Promise<OutreachActivityRecord> {
    const row = await this.activities.findOne({ where: { tenantId, id } });
    if (!row) throw new NotFoundException('Follow-up not found');
    row.status = normalizeStatus(status);
    const saved = await this.activities.save(row);
    const staffByUser = await this.hydrateStaff([saved]);
    return this.toRecord(saved, staffByUser);
  }

  async list(
    tenantId: string,
    query: ListOutreachQueryDto,
  ): Promise<{
    items: OutreachActivityRecord[];
    counts: {
      total: number;
      whatsapp: number;
      phone: number;
      email: number;
      manual: number;
      draft: number;
      logged: number;
      archived: number;
    };
  }> {
    try {
      const limit = Math.min(query.limit ?? 25, 200);
      const where: Record<string, unknown> = { tenantId };
      if (query.channel) where.channel = query.channel;
      if (query.sourceSurface) where.sourceSurface = query.sourceSurface;
      if (query.templateKey) where.templateKey = query.templateKey;
      if (query.status) {
        where.status = query.status;
      } else {
        where.status = In(['draft', 'logged']);
      }

      const [rows, totalsByChannel, totalsByStatus] = await Promise.all([
        this.activities.find({
          where,
          order: { updatedAt: 'DESC', createdAt: 'DESC' },
          take: limit,
        }),
        this.activities
          .createQueryBuilder('activity')
          .select('activity.channel', 'channel')
          .addSelect('COUNT(activity.id)', 'count')
          .where('activity.tenantId = :tenantId', { tenantId })
          .andWhere("activity.status <> 'archived'")
          .groupBy('activity.channel')
          .getRawMany<{ channel: string; count: string }>(),
        this.activities
          .createQueryBuilder('activity')
          .select('activity.status', 'status')
          .addSelect('COUNT(activity.id)', 'count')
          .where('activity.tenantId = :tenantId', { tenantId })
          .groupBy('activity.status')
          .getRawMany<{ status: string | null; count: string }>(),
      ]);

      const staffByUser = await this.hydrateStaff(rows);
      const counts = {
        total: 0,
        whatsapp: 0,
        phone: 0,
        email: 0,
        manual: 0,
        draft: 0,
        logged: 0,
        archived: 0,
      };
      for (const item of totalsByChannel) {
        const value = Number.parseInt(item.count, 10) || 0;
        counts.total += value;
        if (item.channel === 'whatsapp') counts.whatsapp = value;
        else if (item.channel === 'phone') counts.phone = value;
        else if (item.channel === 'email') counts.email = value;
        else counts.manual += value;
      }
      for (const item of totalsByStatus) {
        const value = Number.parseInt(item.count, 10) || 0;
        const status = normalizeStatus(item.status);
        counts[status] += value;
      }

      return {
        items: rows.map((row) => this.toRecord(row, staffByUser)),
        counts,
      };
    } catch (error) {
      if (isRelationTableMissingError(error)) {
        return {
          items: [],
          counts: {
            total: 0,
            whatsapp: 0,
            phone: 0,
            email: 0,
            manual: 0,
            draft: 0,
            logged: 0,
            archived: 0,
          },
        };
      }
      throw error;
    }
  }
}
