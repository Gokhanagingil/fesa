import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OutreachActivity } from '../../database/entities/outreach-activity.entity';
import { StaffUser } from '../../database/entities/staff-user.entity';
import { isRelationTableMissingError } from '../core/database-error.util';
import { CommunicationDeliveryService } from './delivery/communication-delivery.service';
import { DeliveryMode, DeliveryRequest, DeliveryResult, DeliveryState } from './delivery/types';
import { DeliverOutreachDto } from './dto/deliver-outreach.dto';
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
  delivery: {
    mode: DeliveryMode;
    state: DeliveryState;
    provider: string | null;
    providerMessageId: string | null;
    detail: string | null;
    attemptedAt: string | null;
    completedAt: string | null;
  };
};

const VALID_STATUSES: OutreachStatus[] = ['draft', 'logged', 'archived'];

function normalizeStatus(value: string | null | undefined): OutreachStatus {
  if (value && (VALID_STATUSES as string[]).includes(value)) {
    return value as OutreachStatus;
  }
  return 'logged';
}

function normalizeDeliveryMode(value: string | null | undefined): DeliveryMode {
  return value === 'direct' ? 'direct' : 'assisted';
}

function normalizeDeliveryState(value: string | null | undefined): DeliveryState {
  if (value === 'sent' || value === 'failed' || value === 'fallback') return value;
  return 'prepared';
}

@Injectable()
export class OutreachService {
  constructor(
    @InjectRepository(OutreachActivity)
    private readonly activities: Repository<OutreachActivity>,
    @InjectRepository(StaffUser)
    private readonly staffUsers: Repository<StaffUser>,
    private readonly delivery: CommunicationDeliveryService,
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
      delivery: {
        mode: normalizeDeliveryMode(row.deliveryMode),
        state: normalizeDeliveryState(row.deliveryState),
        provider: row.deliveryProvider ?? null,
        providerMessageId: row.deliveryProviderMessageId ?? null,
        detail: row.deliveryDetail ?? null,
        attemptedAt: row.deliveryAttemptedAt?.toISOString() ?? null,
        completedAt: row.deliveryCompletedAt?.toISOString() ?? null,
      },
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
      audienceFilters: payload.audienceFilters ?? null,
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
      // New rows always start in the honest "we prepared something"
      // state.  Direct send / fallback transitions happen via the
      // dedicated `attemptDelivery()` flow.
      deliveryMode: 'assisted',
      deliveryState: 'prepared',
      deliveryProvider: null,
      deliveryProviderMessageId: null,
      deliveryDetail: null,
      deliveryAttemptedAt: null,
      deliveryCompletedAt: null,
    });
    const saved = await this.activities.save(row);
    const staffByUser = await this.hydrateStaff([saved]);
    return this.toRecord(saved, staffByUser);
  }

  /**
   * Run a delivery attempt for an existing follow-up row.  The row's
   * delivery columns are overwritten with the orchestrator's outcome
   * — including the honest `fallback` state when direct send failed
   * but assisted preparation succeeded.
   */
  async attemptDelivery(
    tenantId: string,
    id: string,
    payload: DeliverOutreachDto,
  ): Promise<OutreachActivityRecord> {
    const row = await this.activities.findOne({ where: { tenantId, id } });
    if (!row) throw new NotFoundException('Follow-up not found');

    const requestedMode: DeliveryMode = payload.mode === 'direct' ? 'direct' : 'assisted';
    const channel = (row.channel as DeliveryRequest['channel']) ?? 'whatsapp';
    const result: DeliveryResult = await this.delivery.deliver(requestedMode, {
      tenantId,
      channel,
      topic: row.topic,
      recipients: payload.recipients.map((recipient) => ({
        athleteId: recipient.athleteId,
        athleteName: recipient.athleteName,
        guardianId: recipient.guardianId ?? null,
        guardianName: recipient.guardianName ?? null,
        phone: recipient.phone ?? null,
        email: recipient.email ?? null,
        message: recipient.message,
        subject: recipient.subject ?? null,
      })),
    });

    row.deliveryMode = result.mode;
    row.deliveryState = result.state;
    row.deliveryProvider = result.provider;
    const firstWithId = result.recipients.find((r) => r.providerMessageId);
    row.deliveryProviderMessageId = firstWithId?.providerMessageId ?? null;
    row.deliveryDetail = result.detail;
    row.deliveryAttemptedAt = result.attemptedAt;
    row.deliveryCompletedAt = result.completedAt ?? null;

    // Direct + sent transitions also bump the lifecycle to `logged`
    // automatically — the row IS the audit trail of a real send.
    if (result.state === 'sent' || result.state === 'fallback') {
      row.status = normalizeStatus('logged');
    }

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
      audienceFilters: payload.audienceFilters ?? null,
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
