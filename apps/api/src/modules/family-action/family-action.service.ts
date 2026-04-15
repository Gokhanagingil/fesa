import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Athlete } from '../../database/entities/athlete.entity';
import { AthleteGuardian } from '../../database/entities/athlete-guardian.entity';
import { FamilyActionEvent } from '../../database/entities/family-action-event.entity';
import { FamilyActionRequest } from '../../database/entities/family-action-request.entity';
import { Guardian } from '../../database/entities/guardian.entity';
import {
  FamilyActionActor,
  FamilyActionRequestStatus,
  FamilyActionRequestType,
  FamilyReadinessStatus,
} from '../../database/enums';
import { isRecoverableSchemaError } from '../core/database-error.util';
import { CreateFamilyActionRequestDto } from './dto/create-family-action-request.dto';
import { ListFamilyActionRequestsQueryDto } from './dto/list-family-action-requests-query.dto';
import { TransitionFamilyActionRequestDto } from './dto/transition-family-action-request.dto';
import { UpdateFamilyActionRequestDto } from './dto/update-family-action-request.dto';

type FamilyActionSummary = {
  id: string;
  athleteId: string;
  athleteName: string;
  guardianId: string | null;
  guardianName: string | null;
  type: FamilyActionRequestType;
  status: FamilyActionRequestStatus;
  title: string;
  description: string | null;
  dueDate: Date | null;
  payload: Record<string, unknown>;
  latestResponseText: string | null;
  decisionNote: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  latestEventAt: Date | null;
  eventCount: number;
  events: Array<{
    id: string;
    actor: FamilyActionActor;
    eventType: string;
    fromStatus: FamilyActionRequestStatus | null;
    toStatus: FamilyActionRequestStatus | null;
    note: string | null;
    metadata: Record<string, unknown>;
    createdAt: Date;
  }>;
};

type AthleteFamilyReadiness = {
  athleteId: string;
  status: FamilyReadinessStatus;
  issueCodes: string[];
  summary: {
    guardiansLinked: number;
    primaryContacts: number;
    guardiansMissingContactDetails: number;
    missingItems: number;
    pendingFamilyActions: number;
    awaitingStaffReview: number;
    completedActions: number;
    openActions: number;
  };
  actions: FamilyActionSummary[];
};

type PortalSubmissionPayload = {
  source: 'guardian_portal';
  guardianId: string;
  submittedAt: string;
  responseText: string | null;
  suggestedUpdates: {
    phone?: string;
    email?: string;
    notes?: string;
  };
};

const PENDING_FAMILY_STATUSES = [
  FamilyActionRequestStatus.OPEN,
  FamilyActionRequestStatus.PENDING_FAMILY_ACTION,
  FamilyActionRequestStatus.REJECTED,
] as const;

const AWAITING_STAFF_STATUSES = [
  FamilyActionRequestStatus.SUBMITTED,
  FamilyActionRequestStatus.UNDER_REVIEW,
] as const;

const CLOSED_STATUSES = [FamilyActionRequestStatus.COMPLETED, FamilyActionRequestStatus.CLOSED] as const;

@Injectable()
export class FamilyActionService {
  constructor(
    @InjectRepository(FamilyActionRequest)
    private readonly requests: Repository<FamilyActionRequest>,
    @InjectRepository(FamilyActionEvent)
    private readonly events: Repository<FamilyActionEvent>,
    @InjectRepository(Athlete)
    private readonly athletes: Repository<Athlete>,
    @InjectRepository(Guardian)
    private readonly guardians: Repository<Guardian>,
    @InjectRepository(AthleteGuardian)
    private readonly athleteGuardians: Repository<AthleteGuardian>,
  ) {}

  private getPersonName(person: { firstName: string; lastName: string; preferredName?: string | null }): string {
    return person.preferredName?.trim() || `${person.firstName} ${person.lastName}`;
  }

  private isPendingFamilyStatus(status: FamilyActionRequestStatus): boolean {
    return (PENDING_FAMILY_STATUSES as readonly FamilyActionRequestStatus[]).includes(status);
  }

  private isAwaitingStaffStatus(status: FamilyActionRequestStatus): boolean {
    return (AWAITING_STAFF_STATUSES as readonly FamilyActionRequestStatus[]).includes(status);
  }

  private isClosedStatus(status: FamilyActionRequestStatus): boolean {
    return (CLOSED_STATUSES as readonly FamilyActionRequestStatus[]).includes(status);
  }

  private normalizePortalSuggestion(value?: string | null): string | undefined {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  }

  private getPortalSubmission(payload: Record<string, unknown> | null | undefined): PortalSubmissionPayload | null {
    const submission = payload?.portalSubmission;
    if (!submission || typeof submission !== 'object') {
      return null;
    }

    const typed = submission as Record<string, unknown>;
    const suggestedUpdates =
      typed.suggestedUpdates && typeof typed.suggestedUpdates === 'object'
        ? (typed.suggestedUpdates as Record<string, unknown>)
        : {};

    if (typeof typed.guardianId !== 'string' || typeof typed.submittedAt !== 'string') {
      return null;
    }

    return {
      source: 'guardian_portal',
      guardianId: typed.guardianId,
      submittedAt: typed.submittedAt,
      responseText: typeof typed.responseText === 'string' ? typed.responseText : null,
      suggestedUpdates: {
        phone: typeof suggestedUpdates.phone === 'string' ? suggestedUpdates.phone : undefined,
        email: typeof suggestedUpdates.email === 'string' ? suggestedUpdates.email : undefined,
        notes: typeof suggestedUpdates.notes === 'string' ? suggestedUpdates.notes : undefined,
      },
    };
  }

  private normalizeGuardianPayload(
    payload: Record<string, unknown> | null | undefined,
  ): { phone: string | null; email: string | null; notes: string | null } | null {
    const submission = this.getPortalSubmission(payload);
    if (!submission) {
      return null;
    }

    return {
      phone: this.normalizePortalSuggestion(submission.suggestedUpdates.phone) ?? null,
      email: this.normalizePortalSuggestion(submission.suggestedUpdates.email) ?? null,
      notes: this.normalizePortalSuggestion(submission.suggestedUpdates.notes) ?? null,
    };
  }

  private getAllowedTransitions(status: FamilyActionRequestStatus): FamilyActionRequestStatus[] {
    switch (status) {
      case FamilyActionRequestStatus.OPEN:
        return [FamilyActionRequestStatus.PENDING_FAMILY_ACTION, FamilyActionRequestStatus.CLOSED];
      case FamilyActionRequestStatus.PENDING_FAMILY_ACTION:
        return [
          FamilyActionRequestStatus.SUBMITTED,
          FamilyActionRequestStatus.UNDER_REVIEW,
          FamilyActionRequestStatus.CLOSED,
        ];
      case FamilyActionRequestStatus.SUBMITTED:
        return [
          FamilyActionRequestStatus.UNDER_REVIEW,
          FamilyActionRequestStatus.APPROVED,
          FamilyActionRequestStatus.REJECTED,
          FamilyActionRequestStatus.PENDING_FAMILY_ACTION,
          FamilyActionRequestStatus.CLOSED,
        ];
      case FamilyActionRequestStatus.UNDER_REVIEW:
        return [
          FamilyActionRequestStatus.APPROVED,
          FamilyActionRequestStatus.REJECTED,
          FamilyActionRequestStatus.PENDING_FAMILY_ACTION,
          FamilyActionRequestStatus.CLOSED,
        ];
      case FamilyActionRequestStatus.APPROVED:
        return [FamilyActionRequestStatus.COMPLETED, FamilyActionRequestStatus.CLOSED];
      case FamilyActionRequestStatus.REJECTED:
        return [FamilyActionRequestStatus.PENDING_FAMILY_ACTION, FamilyActionRequestStatus.CLOSED];
      case FamilyActionRequestStatus.COMPLETED:
        return [FamilyActionRequestStatus.CLOSED];
      case FamilyActionRequestStatus.CLOSED:
        return [];
      default:
        return [];
    }
  }

  private async assertAthlete(tenantId: string, athleteId: string): Promise<Athlete> {
    const athlete = await this.athletes.findOne({
      where: { id: athleteId, tenantId },
      relations: ['primaryGroup'],
    });
    if (!athlete) {
      throw new BadRequestException('Athlete not found');
    }
    return athlete;
  }

  private async assertGuardianLink(
    tenantId: string,
    athleteId: string,
    guardianId: string | null | undefined,
  ): Promise<Guardian | null> {
    if (!guardianId) {
      return null;
    }

    const guardian = await this.guardians.findOne({ where: { id: guardianId, tenantId } });
    if (!guardian) {
      throw new BadRequestException('Guardian not found');
    }

    const link = await this.athleteGuardians.findOne({
      where: { tenantId, athleteId, guardianId },
    });
    if (!link) {
      throw new BadRequestException('Guardian must already be linked to the athlete');
    }

    return guardian;
  }

  private async assertGuardianCanAccessRequest(
    tenantId: string,
    guardianId: string,
    request: FamilyActionRequest,
  ): Promise<void> {
    if (request.guardianId && request.guardianId !== guardianId) {
      throw new NotFoundException('Family action request not found');
    }

    const link = await this.athleteGuardians.findOne({
      where: { tenantId, athleteId: request.athleteId, guardianId },
    });
    if (!link) {
      throw new NotFoundException('Family action request not found');
    }
  }

  private async findRequestEntity(tenantId: string, id: string): Promise<FamilyActionRequest> {
    const request = await this.requests.findOne({
      where: { id, tenantId },
      relations: ['athlete', 'guardian'],
    });
    if (!request) {
      throw new NotFoundException('Family action request not found');
    }
    return request;
  }

  private async recordEvent(
    tenantId: string,
    requestId: string,
    actor: FamilyActionActor,
    eventType: string,
    fromStatus: FamilyActionRequestStatus | null,
    toStatus: FamilyActionRequestStatus | null,
    note?: string | null,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const event = this.events.create({
      tenantId,
      familyActionRequestId: requestId,
      actor,
      eventType,
      fromStatus,
      toStatus,
      note: note ?? null,
      metadata: metadata ?? {},
    });
    await this.events.save(event);
  }

  private async getEventsByRequestIds(tenantId: string, requestIds: string[]): Promise<Map<string, FamilyActionEvent[]>> {
    if (requestIds.length === 0) {
      return new Map();
    }
    const events = await this.events.find({
      where: { tenantId, familyActionRequestId: In(requestIds) },
      order: { createdAt: 'DESC' },
    });
    const map = new Map<string, FamilyActionEvent[]>();
    for (const event of events) {
      const current = map.get(event.familyActionRequestId) ?? [];
      current.push(event);
      map.set(event.familyActionRequestId, current);
    }
    return map;
  }

  private mapRequest(request: FamilyActionRequest, eventsByRequestId: Map<string, FamilyActionEvent[]>): FamilyActionSummary {
    const events = eventsByRequestId.get(request.id) ?? [];
    return {
      id: request.id,
      athleteId: request.athleteId,
      athleteName: request.athlete ? this.getPersonName(request.athlete) : request.athleteId,
      guardianId: request.guardianId,
      guardianName: request.guardian ? this.getPersonName(request.guardian) : null,
      type: request.type,
      status: request.status,
      title: request.title,
      description: request.description,
      dueDate: request.dueDate,
      payload: request.payload ?? {},
      latestResponseText: request.latestResponseText,
      decisionNote: request.decisionNote,
      submittedAt: request.submittedAt,
      reviewedAt: request.reviewedAt,
      resolvedAt: request.resolvedAt,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      latestEventAt: events[0]?.createdAt ?? null,
      eventCount: events.length,
      events: events.map((event) => ({
        id: event.id,
        actor: event.actor,
        eventType: event.eventType,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        note: event.note,
        metadata: event.metadata ?? {},
        createdAt: event.createdAt,
      })),
    };
  }

  private buildReadinessMap(
    athletes: Athlete[],
    guardianLinks: AthleteGuardian[],
    requests: FamilyActionRequest[],
    eventsByRequestId: Map<string, FamilyActionEvent[]>,
  ): Map<string, AthleteFamilyReadiness> {
    const guardiansByAthlete = new Map<string, AthleteGuardian[]>();
    for (const link of guardianLinks) {
      const current = guardiansByAthlete.get(link.athleteId) ?? [];
      current.push(link);
      guardiansByAthlete.set(link.athleteId, current);
    }

    const requestsByAthlete = new Map<string, FamilyActionRequest[]>();
    for (const request of requests) {
      const current = requestsByAthlete.get(request.athleteId) ?? [];
      current.push(request);
      requestsByAthlete.set(request.athleteId, current);
    }

    const readinessMap = new Map<string, AthleteFamilyReadiness>();
    for (const athlete of athletes) {
      const athleteGuardians = guardiansByAthlete.get(athlete.id) ?? [];
      const athleteRequests = (requestsByAthlete.get(athlete.id) ?? []).sort(
        (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
      );

      const primaryContacts = athleteGuardians.filter((link) => link.isPrimaryContact).length;
      const guardiansMissingContactDetails = athleteGuardians.filter(
        (link) => !link.guardian?.phone && !link.guardian?.email,
      ).length;
      const pendingFamilyActions = athleteRequests.filter((request) => this.isPendingFamilyStatus(request.status)).length;
      const awaitingStaffReview = athleteRequests.filter((request) => this.isAwaitingStaffStatus(request.status)).length;
      const completedActions = athleteRequests.filter((request) => this.isClosedStatus(request.status)).length;
      const openActions = athleteRequests.length - completedActions;

      const issueCodes: string[] = [];
      if (primaryContacts === 0) {
        issueCodes.push('missing_primary_contact');
      }
      if (guardiansMissingContactDetails > 0) {
        issueCodes.push('missing_guardian_contact_details');
      }
      if (!athlete.primaryGroupId) {
        issueCodes.push('missing_primary_group');
      }
      if (pendingFamilyActions > 0) {
        issueCodes.push('pending_family_action');
      }
      if (awaitingStaffReview > 0) {
        issueCodes.push('awaiting_staff_review');
      }

      let status = FamilyReadinessStatus.COMPLETE;
      if (awaitingStaffReview > 0) {
        status = FamilyReadinessStatus.AWAITING_STAFF_REVIEW;
      } else if (pendingFamilyActions > 0) {
        status = FamilyReadinessStatus.AWAITING_GUARDIAN_ACTION;
      } else if (issueCodes.length > 0) {
        status = FamilyReadinessStatus.INCOMPLETE;
      }

      readinessMap.set(athlete.id, {
        athleteId: athlete.id,
        status,
        issueCodes,
        summary: {
          guardiansLinked: athleteGuardians.length,
          primaryContacts,
          guardiansMissingContactDetails,
          missingItems: issueCodes.filter((code) =>
            ['missing_primary_contact', 'missing_guardian_contact_details', 'missing_primary_group'].includes(code),
          ).length,
          pendingFamilyActions,
          awaitingStaffReview,
          completedActions,
          openActions,
        },
        actions: athleteRequests.map((request) => this.mapRequest(request, eventsByRequestId)),
      });
    }

    return readinessMap;
  }

  async create(tenantId: string, dto: CreateFamilyActionRequestDto) {
    await this.assertAthlete(tenantId, dto.athleteId);
    await this.assertGuardianLink(tenantId, dto.athleteId, dto.guardianId);

    const request = this.requests.create({
      tenantId,
      athleteId: dto.athleteId,
      guardianId: dto.guardianId ?? null,
      type: dto.type,
      status: dto.status ?? FamilyActionRequestStatus.PENDING_FAMILY_ACTION,
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      payload: dto.payload ?? {},
      latestResponseText: null,
      decisionNote: null,
      submittedAt: null,
      reviewedAt: null,
      resolvedAt: null,
    });
    const saved = await this.requests.save(request);
    await this.recordEvent(
      tenantId,
      saved.id,
      FamilyActionActor.CLUB,
      'created',
      null,
      saved.status,
      null,
      { type: saved.type, payload: saved.payload },
    );
    return this.findOne(tenantId, saved.id);
  }

  async findOne(tenantId: string, id: string) {
    const request = await this.findRequestEntity(tenantId, id);
    const eventsByRequestId = await this.getEventsByRequestIds(tenantId, [id]);
    return this.mapRequest(request, eventsByRequestId);
  }

  async findOneForGuardian(tenantId: string, guardianId: string, id: string) {
    const request = await this.findRequestEntity(tenantId, id);
    await this.assertGuardianCanAccessRequest(tenantId, guardianId, request);
    const eventsByRequestId = await this.getEventsByRequestIds(tenantId, [id]);
    return this.mapRequest(request, eventsByRequestId);
  }

  async list(tenantId: string, query: ListFamilyActionRequestsQueryDto) {
    const qb = this.requests
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.athlete', 'athlete')
      .leftJoinAndSelect('request.guardian', 'guardian')
      .where('request.tenantId = :tenantId', { tenantId });

    if (query.athleteId) {
      qb.andWhere('request.athleteId = :athleteId', { athleteId: query.athleteId });
    }
    if (query.guardianId) {
      qb.andWhere('request.guardianId = :guardianId', { guardianId: query.guardianId });
    }
    if (query.type) {
      qb.andWhere('request.type = :type', { type: query.type });
    }
    if (query.statuses && query.statuses.length > 0) {
      qb.andWhere('request.status IN (:...statuses)', { statuses: query.statuses });
    }
    if (query.needsFollowUp) {
      qb.andWhere('request.status NOT IN (:...closedStatuses)', { closedStatuses: CLOSED_STATUSES });
    }

    const limit = query.limit ?? 50;
    const requests = await qb.orderBy('request.updatedAt', 'DESC').take(limit).getMany();
    const eventsByRequestId = await this.getEventsByRequestIds(
      tenantId,
      requests.map((request) => request.id),
    );

    return {
      items: requests.map((request) => this.mapRequest(request, eventsByRequestId)),
      total: requests.length,
    };
  }

  async update(tenantId: string, id: string, dto: UpdateFamilyActionRequestDto) {
    const request = await this.findRequestEntity(tenantId, id);
    if (this.isClosedStatus(request.status)) {
      throw new BadRequestException('Closed family action requests cannot be edited');
    }

    if (dto.athleteId && dto.athleteId !== request.athleteId) {
      await this.assertAthlete(tenantId, dto.athleteId);
    }

    const athleteId = dto.athleteId ?? request.athleteId;
    if (dto.guardianId !== undefined) {
      await this.assertGuardianLink(tenantId, athleteId, dto.guardianId);
    }

    request.athleteId = athleteId;
    request.guardianId = dto.guardianId !== undefined ? dto.guardianId ?? null : request.guardianId;
    request.type = dto.type ?? request.type;
    request.title = dto.title?.trim() || request.title;
    request.description = dto.description !== undefined ? dto.description?.trim() || null : request.description;
    request.dueDate = dto.dueDate !== undefined ? (dto.dueDate ? new Date(dto.dueDate) : null) : request.dueDate;
    request.payload = dto.payload !== undefined ? dto.payload : request.payload;

    await this.requests.save(request);
    await this.recordEvent(tenantId, request.id, FamilyActionActor.CLUB, 'updated', request.status, request.status);
    return this.findOne(tenantId, request.id);
  }

  async transition(tenantId: string, id: string, dto: TransitionFamilyActionRequestDto) {
    const request = await this.findRequestEntity(tenantId, id);
    if (request.status === dto.status) {
      throw new BadRequestException('Request is already in the selected status');
    }

    const allowed = this.getAllowedTransitions(request.status);
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(`Cannot move request from ${request.status} to ${dto.status}`);
    }

    const previousStatus = request.status;
    request.status = dto.status;
    const now = new Date();

    if (dto.responseText !== undefined) {
      request.latestResponseText = dto.responseText?.trim() || null;
    }
    if (dto.decisionNote !== undefined) {
      request.decisionNote = dto.decisionNote?.trim() || null;
    } else if (
      [FamilyActionRequestStatus.APPROVED, FamilyActionRequestStatus.REJECTED].includes(dto.status) &&
      dto.note !== undefined
    ) {
      request.decisionNote = dto.note?.trim() || null;
    }

    if (dto.status === FamilyActionRequestStatus.SUBMITTED) {
      request.submittedAt = now;
    }
    if (
      [
        FamilyActionRequestStatus.UNDER_REVIEW,
        FamilyActionRequestStatus.APPROVED,
        FamilyActionRequestStatus.REJECTED,
      ].includes(dto.status)
    ) {
      request.reviewedAt = now;
    }
    if (this.isClosedStatus(dto.status)) {
      request.resolvedAt = now;
    }
    if (
      [FamilyActionRequestStatus.PENDING_FAMILY_ACTION, FamilyActionRequestStatus.OPEN].includes(dto.status)
    ) {
      request.resolvedAt = null;
    }

    await this.requests.save(request);
    await this.recordEvent(tenantId, request.id, FamilyActionActor.CLUB, 'status_changed', previousStatus, dto.status, dto.note, {
      responseText: dto.responseText ?? null,
      decisionNote: request.decisionNote,
    });
    return this.findOne(tenantId, request.id);
  }

  async submitFromGuardian(
    tenantId: string,
    id: string,
    guardianId: string,
    payload: {
      responseText?: string;
      note?: string;
      suggestedUpdates?: {
        phone?: string;
        email?: string;
        notes?: string;
      };
      portalSessionId?: string | null;
    },
  ) {
    const request = await this.findRequestEntity(tenantId, id);
    await this.assertGuardianCanAccessRequest(tenantId, guardianId, request);

    const allowed = new Set<FamilyActionRequestStatus>([
      FamilyActionRequestStatus.OPEN,
      FamilyActionRequestStatus.PENDING_FAMILY_ACTION,
      FamilyActionRequestStatus.REJECTED,
    ]);
    if (!allowed.has(request.status)) {
      throw new BadRequestException('This family action is not currently open for guardian completion');
    }

    const previousStatus = request.status;
    const now = new Date();
    request.status = FamilyActionRequestStatus.SUBMITTED;
    request.submittedAt = now;
    request.reviewedAt = null;
    request.resolvedAt = null;
    request.latestResponseText = payload.responseText?.trim() || null;
    request.payload = {
      ...(request.payload ?? {}),
      portalSubmission: {
        source: 'guardian_portal',
        guardianId,
        submittedAt: now.toISOString(),
        responseText: request.latestResponseText,
        suggestedUpdates: {
          phone: this.normalizePortalSuggestion(payload.suggestedUpdates?.phone),
          email: this.normalizePortalSuggestion(payload.suggestedUpdates?.email),
          notes: this.normalizePortalSuggestion(payload.suggestedUpdates?.notes),
        },
      },
    };

    if (!request.guardianId) {
      request.guardianId = guardianId;
    }

    await this.requests.save(request);
    await this.recordEvent(
      tenantId,
      request.id,
      FamilyActionActor.FAMILY,
      'guardian_submitted',
      previousStatus,
      FamilyActionRequestStatus.SUBMITTED,
      payload.note,
      {
        responseText: request.latestResponseText,
        portalSessionId: payload.portalSessionId ?? null,
        source: 'guardian_portal',
        guardianId,
      },
    );
    return this.findOne(tenantId, request.id);
  }

  async applyGuardianSubmission(
    tenantId: string,
    id: string,
    payload: {
      decision: 'approved' | 'rejected';
      note?: string;
    },
  ) {
    const targetStatus =
      payload.decision === 'approved'
        ? FamilyActionRequestStatus.APPROVED
        : FamilyActionRequestStatus.REJECTED;
    const request = await this.findRequestEntity(tenantId, id);
    if (
      ![FamilyActionRequestStatus.SUBMITTED, FamilyActionRequestStatus.UNDER_REVIEW].includes(request.status)
    ) {
      throw new BadRequestException('Only submitted family actions can be reviewed');
    }

    const previousStatus = request.status;
    const now = new Date();
    request.status = targetStatus;
    request.reviewedAt = now;
    request.decisionNote = payload.note?.trim() || null;
    if (targetStatus === FamilyActionRequestStatus.REJECTED) {
      request.resolvedAt = null;
    }

    if (
      targetStatus === FamilyActionRequestStatus.APPROVED &&
      [
        FamilyActionRequestType.CONTACT_DETAILS_COMPLETION,
        FamilyActionRequestType.GUARDIAN_PROFILE_UPDATE,
      ].includes(request.type)
    ) {
      const normalized = this.normalizeGuardianPayload(request.payload);
      request.status = FamilyActionRequestStatus.COMPLETED;
      request.resolvedAt = now;

      if (request.guardianId && normalized) {
        const guardian = await this.guardians.findOne({
          where: { id: request.guardianId, tenantId },
        });
        if (guardian) {
          guardian.phone = normalized.phone;
          guardian.email = normalized.email;
          guardian.notes = normalized.notes;
          await this.guardians.save(guardian);
        }
      }
    }

    await this.requests.save(request);
    await this.recordEvent(
      tenantId,
      request.id,
      FamilyActionActor.CLUB,
      'review_decision',
      previousStatus,
      request.status,
      payload.note,
      {
        decision: payload.decision,
        source: 'staff_review',
      },
    );
    return this.findOne(tenantId, id);
  }

  async getAthleteReadiness(tenantId: string, athleteId: string) {
    const map = await this.getReadinessMap(tenantId, [athleteId]);
    const readiness = map.get(athleteId);
    if (!readiness) {
      throw new NotFoundException('Athlete not found');
    }
    return readiness;
  }

  async getGuardianReadiness(tenantId: string, guardianId: string) {
    const guardian = await this.guardians.findOne({ where: { id: guardianId, tenantId } });
    if (!guardian) {
      throw new NotFoundException('Guardian not found');
    }

    const links = await this.athleteGuardians.find({
      where: { tenantId, guardianId },
      relations: ['athlete', 'guardian'],
      order: { isPrimaryContact: 'DESC', createdAt: 'ASC' },
    });
    const athleteIds = Array.from(new Set(links.map((link) => link.athleteId)));
    const athleteReadinessMap = await this.getReadinessMap(tenantId, athleteIds);
    const requestList = await this.list(tenantId, { guardianId, limit: 50 });
    const pendingFamilyActions = requestList.items.filter((item) => this.isPendingFamilyStatus(item.status)).length;
    const awaitingStaffReview = requestList.items.filter((item) => this.isAwaitingStaffStatus(item.status)).length;

    const issueCodes: string[] = [];
    if (!guardian.phone && !guardian.email) {
      issueCodes.push('missing_guardian_contact_details');
    }
    if (pendingFamilyActions > 0) {
      issueCodes.push('pending_family_action');
    }
    if (awaitingStaffReview > 0) {
      issueCodes.push('awaiting_staff_review');
    }

    let status = FamilyReadinessStatus.COMPLETE;
    if (awaitingStaffReview > 0) {
      status = FamilyReadinessStatus.AWAITING_STAFF_REVIEW;
    } else if (pendingFamilyActions > 0) {
      status = FamilyReadinessStatus.AWAITING_GUARDIAN_ACTION;
    } else if (issueCodes.length > 0) {
      status = FamilyReadinessStatus.INCOMPLETE;
    }

    return {
      guardianId,
      status,
      issueCodes,
      summary: {
        linkedAthletes: athleteIds.length,
        primaryRelationships: links.filter((link) => link.isPrimaryContact).length,
        athletesAwaitingGuardianAction: Array.from(athleteReadinessMap.values()).filter(
          (item) => item.status === FamilyReadinessStatus.AWAITING_GUARDIAN_ACTION,
        ).length,
        athletesAwaitingStaffReview: Array.from(athleteReadinessMap.values()).filter(
          (item) => item.status === FamilyReadinessStatus.AWAITING_STAFF_REVIEW,
        ).length,
      },
      actions: requestList.items,
    };
  }

  async getReadinessMap(tenantId: string, athleteIds?: string[]) {
    const athleteWhere = athleteIds && athleteIds.length > 0 ? { tenantId, id: In(athleteIds) } : { tenantId };
    const athletes = await this.athletes.find({
      where: athleteWhere,
      relations: ['primaryGroup'],
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
    if (athletes.length === 0) {
      return new Map<string, AthleteFamilyReadiness>();
    }

    const scopedAthleteIds = athletes.map((athlete) => athlete.id);
    const [guardianLinks, requests] = await Promise.all([
      this.athleteGuardians.find({
        where: { tenantId, athleteId: In(scopedAthleteIds) },
        relations: ['guardian'],
        order: { isPrimaryContact: 'DESC', createdAt: 'ASC' },
      }),
      this.requests.find({
        where: { tenantId, athleteId: In(scopedAthleteIds) },
        relations: ['athlete', 'guardian'],
        order: { updatedAt: 'DESC' },
      }),
    ]);
    const eventsByRequestId = await this.getEventsByRequestIds(
      tenantId,
      requests.map((request) => request.id),
    );

    return this.buildReadinessMap(athletes, guardianLinks, requests, eventsByRequestId);
  }

  async getWorkflowSummary(tenantId: string) {
    const [allRequests, readinessMap] = await Promise.all([
      this.list(tenantId, { limit: 200, needsFollowUp: true }),
      this.getReadinessMap(tenantId),
    ]);

    const readinessValues = Array.from(readinessMap.values());
    return {
      counts: {
        open: allRequests.items.filter((item) => item.status === FamilyActionRequestStatus.OPEN).length,
        pendingFamilyAction: allRequests.items.filter((item) => this.isPendingFamilyStatus(item.status)).length,
        awaitingStaffReview: allRequests.items.filter((item) => this.isAwaitingStaffStatus(item.status)).length,
        completed: allRequests.items.filter((item) => this.isClosedStatus(item.status)).length,
        incompleteAthletes: readinessValues.filter((item) => item.status === FamilyReadinessStatus.INCOMPLETE).length,
        athletesAwaitingGuardianAction: readinessValues.filter(
          (item) => item.status === FamilyReadinessStatus.AWAITING_GUARDIAN_ACTION,
        ).length,
        athletesAwaitingStaffReview: readinessValues.filter(
          (item) => item.status === FamilyReadinessStatus.AWAITING_STAFF_REVIEW,
        ).length,
      },
      items: allRequests.items.slice(0, 8),
    };
  }

  async getWorkflowSummarySafe(tenantId: string) {
    try {
      return await this.getWorkflowSummary(tenantId);
    } catch (error) {
      if (isRecoverableSchemaError(error)) {
        return {
          counts: {
            open: 0,
            pendingFamilyAction: 0,
            awaitingStaffReview: 0,
            completed: 0,
            incompleteAthletes: 0,
            athletesAwaitingGuardianAction: 0,
            athletesAwaitingStaffReview: 0,
          },
          items: [],
        };
      }
      throw error;
    }
  }
}
