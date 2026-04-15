import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { In, Repository } from 'typeorm';
import { ActionCenterItemState } from '../../database/entities/action-center-item-state.entity';
import { Athlete } from '../../database/entities/athlete.entity';
import { Attendance } from '../../database/entities/attendance.entity';
import { PrivateLesson } from '../../database/entities/private-lesson.entity';
import { TrainingSession } from '../../database/entities/training-session.entity';
import {
  ActionCenterItemCategory,
  ActionCenterItemMutation,
  ActionCenterItemType,
  ActionCenterItemUrgency,
  FamilyActionRequestStatus,
  FamilyReadinessStatus,
  TrainingSessionStatus,
} from '../../database/enums';
import { FamilyActionService } from '../family-action/family-action.service';
import { FinanceService } from '../finance/finance.service';
import {
  ActionCenterView,
  ListActionCenterItemsQueryDto,
} from './dto/list-action-center-items-query.dto';
import { UpdateActionCenterItemsDto } from './dto/update-action-center-items.dto';

type ActionContextValue = string | number | boolean | string[] | null;

type ActionCenterItem = {
  itemKey: string;
  snapshotToken: string;
  category: ActionCenterItemCategory;
  type: ActionCenterItemType;
  urgency: ActionCenterItemUrgency;
  subjectId: string;
  subjectName: string;
  relatedName: string | null;
  count: number;
  amount: string | null;
  currency: string | null;
  dueAt: Date | null;
  occurredAt: Date | null;
  deepLink: string;
  communicationLink: string | null;
  context: Record<string, ActionContextValue>;
  read: boolean;
  snoozedUntil: Date | null;
};

type GeneratedActionCenterItem = Omit<ActionCenterItem, 'read' | 'snoozedUntil'>;

type TrainingAttendanceRow = {
  id: string;
  title: string;
  scheduledEnd: Date;
  updatedAt: Date;
};

type ActionCenterCounts = {
  total: number;
  unread: number;
  overdue: number;
  today: number;
  byCategory: Record<ActionCenterItemCategory, number>;
  byUrgency: Record<ActionCenterItemUrgency, number>;
};

type FinanceChargeSummary = {
  id: string;
  athleteId: string;
  dueDate: Date | null;
  status: string;
  derivedStatus?: string;
  isOverdue?: boolean;
  amount: string;
  remainingAmount?: string;
  chargeItem?: {
    currency?: string | null;
  } | null;
};

type FinanceAthleteAggregate = {
  athlete: Pick<Athlete, 'id' | 'firstName' | 'lastName' | 'preferredName'>;
  totalOutstanding: number;
  totalOverdue: number;
  overdueCount: number;
};

type FinanceSummary = {
  charges: FinanceChargeSummary[];
  athletes: FinanceAthleteAggregate[];
};

type FamilyActionSummary = {
  athleteId: string;
  athleteName: string;
  guardianName: string | null;
  status: FamilyActionRequestStatus;
  dueDate: Date | null;
  updatedAt: Date;
};

type AthleteFamilyReadiness = {
  athleteId: string;
  status: FamilyReadinessStatus;
  issueCodes: string[];
  summary: {
    pendingFamilyActions: number;
    awaitingStaffReview: number;
    missingItems: number;
  };
  actions: FamilyActionSummary[];
};

const PENDING_FAMILY_STATUSES = new Set<FamilyActionRequestStatus>([
  FamilyActionRequestStatus.OPEN,
  FamilyActionRequestStatus.PENDING_FAMILY_ACTION,
  FamilyActionRequestStatus.REJECTED,
]);

const AWAITING_REVIEW_STATUSES = new Set<FamilyActionRequestStatus>([
  FamilyActionRequestStatus.SUBMITTED,
  FamilyActionRequestStatus.UNDER_REVIEW,
  FamilyActionRequestStatus.APPROVED,
]);

@Injectable()
export class ActionCenterService {
  constructor(
    @InjectRepository(ActionCenterItemState)
    private readonly states: Repository<ActionCenterItemState>,
    @InjectRepository(Athlete)
    private readonly athletes: Repository<Athlete>,
    @InjectRepository(PrivateLesson)
    private readonly privateLessons: Repository<PrivateLesson>,
    @InjectRepository(TrainingSession)
    private readonly trainingSessions: Repository<TrainingSession>,
    @InjectRepository(Attendance)
    private readonly attendance: Repository<Attendance>,
    private readonly finance: FinanceService,
    private readonly familyActions: FamilyActionService,
  ) {}

  private getPersonName(person: { firstName: string; lastName: string; preferredName?: string | null }): string {
    return person.preferredName?.trim() || `${person.firstName} ${person.lastName}`;
  }

  private addHours(base: Date, amount: number): Date {
    return new Date(base.getTime() + amount * 60 * 60 * 1000);
  }

  private hashSnapshot(payload: Record<string, ActionContextValue>): string {
    return createHash('sha1').update(JSON.stringify(payload)).digest('hex');
  }

  private getEarliestDate(values: Array<Date | null | undefined>): Date | null {
    return values
      .filter((value): value is Date => value instanceof Date)
      .sort((left, right) => left.getTime() - right.getTime())[0] ?? null;
  }

  private getLatestDate(values: Array<Date | null | undefined>): Date | null {
    return values
      .filter((value): value is Date => value instanceof Date)
      .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
  }

  private getUrgencyFromDue(dueAt: Date | null, now: Date): ActionCenterItemUrgency {
    if (!dueAt) {
      return ActionCenterItemUrgency.NORMAL;
    }
    if (dueAt.getTime() < now.getTime()) {
      return ActionCenterItemUrgency.OVERDUE;
    }
    if (dueAt.getTime() <= this.addHours(now, 24).getTime()) {
      return ActionCenterItemUrgency.TODAY;
    }
    if (dueAt.getTime() <= this.addHours(now, 72).getTime()) {
      return ActionCenterItemUrgency.UPCOMING;
    }
    return ActionCenterItemUrgency.NORMAL;
  }

  private getUrgencyRank(urgency: ActionCenterItemUrgency): number {
    switch (urgency) {
      case ActionCenterItemUrgency.OVERDUE:
        return 0;
      case ActionCenterItemUrgency.TODAY:
        return 1;
      case ActionCenterItemUrgency.UPCOMING:
        return 2;
      case ActionCenterItemUrgency.NORMAL:
      default:
        return 3;
    }
  }

  private createCounts(): ActionCenterCounts {
    return {
      total: 0,
      unread: 0,
      overdue: 0,
      today: 0,
      byCategory: {
        [ActionCenterItemCategory.FINANCE]: 0,
        [ActionCenterItemCategory.FAMILY]: 0,
        [ActionCenterItemCategory.READINESS]: 0,
        [ActionCenterItemCategory.PRIVATE_LESSONS]: 0,
        [ActionCenterItemCategory.TRAINING]: 0,
      },
      byUrgency: {
        [ActionCenterItemUrgency.OVERDUE]: 0,
        [ActionCenterItemUrgency.TODAY]: 0,
        [ActionCenterItemUrgency.UPCOMING]: 0,
        [ActionCenterItemUrgency.NORMAL]: 0,
      },
    };
  }

  private sortItems(items: ActionCenterItem[]): ActionCenterItem[] {
    return [...items].sort((left, right) => {
      const urgencyRank = this.getUrgencyRank(left.urgency) - this.getUrgencyRank(right.urgency);
      if (urgencyRank !== 0) {
        return urgencyRank;
      }

      const leftDue = left.dueAt?.getTime() ?? left.occurredAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const rightDue = right.dueAt?.getTime() ?? right.occurredAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (leftDue !== rightDue) {
        return leftDue - rightDue;
      }

      return left.subjectName.localeCompare(right.subjectName);
    });
  }

  private applyState(
    item: GeneratedActionCenterItem,
    state: ActionCenterItemState | undefined,
    now: Date,
  ): ActionCenterItem | null {
    const sameSnapshot = state?.snapshotToken === item.snapshotToken;
    if (sameSnapshot && state?.dismissedAt) {
      return null;
    }
    if (sameSnapshot && state?.completedAt) {
      return null;
    }
    if (sameSnapshot && state?.snoozedUntil && state.snoozedUntil.getTime() > now.getTime()) {
      return null;
    }

    return {
      ...item,
      read: Boolean(sameSnapshot && state?.readAt),
      snoozedUntil: sameSnapshot ? state?.snoozedUntil ?? null : null,
    };
  }

  private buildCounts(items: ActionCenterItem[]): ActionCenterCounts {
    const counts = this.createCounts();
    counts.total = items.length;
    for (const item of items) {
      if (!item.read) {
        counts.unread += 1;
      }
      if (item.urgency === ActionCenterItemUrgency.OVERDUE) {
        counts.overdue += 1;
      }
      if (item.urgency === ActionCenterItemUrgency.TODAY) {
        counts.today += 1;
      }
      counts.byCategory[item.category] += 1;
      counts.byUrgency[item.urgency] += 1;
    }
    return counts;
  }

  private async buildFinanceItems(tenantId: string, now: Date): Promise<GeneratedActionCenterItem[]> {
    const summary = (await this.finance.listAthleteFinanceSummaries(tenantId, {})) as FinanceSummary;
    const chargesByAthlete = new Map<string, FinanceChargeSummary[]>();
    for (const charge of summary.charges) {
      if ((charge.derivedStatus ?? charge.status) === 'paid' || charge.status === 'cancelled') {
        continue;
      }
      const current = chargesByAthlete.get(charge.athleteId) ?? [];
      current.push(charge);
      chargesByAthlete.set(charge.athleteId, current);
    }

    return summary.athletes.flatMap((row) => {
      const athleteCharges = chargesByAthlete.get(row.athlete.id) ?? [];
      const overdueCharges = athleteCharges.filter((charge) => charge.isOverdue);
      const soonCharges = athleteCharges.filter((charge) => {
        if (!charge.dueDate || charge.isOverdue) {
          return false;
        }
        return charge.dueDate.getTime() <= this.addHours(now, 72).getTime();
      });
      const relevantCharges = overdueCharges.length > 0 ? overdueCharges : soonCharges;
      if (relevantCharges.length === 0) {
        return [];
      }

      const dueAt = this.getEarliestDate(relevantCharges.map((charge) => charge.dueDate));
      const amount = relevantCharges
        .reduce((sum, charge) => sum + Number(charge.remainingAmount ?? charge.amount), 0)
        .toFixed(2);
      const currency = relevantCharges.find((charge) => charge.chargeItem?.currency)?.chargeItem?.currency ?? 'TRY';
      const urgency =
        overdueCharges.length > 0 ? ActionCenterItemUrgency.OVERDUE : this.getUrgencyFromDue(dueAt, now);
      const snapshotToken = this.hashSnapshot({
        athleteId: row.athlete.id,
        overdueCount: row.overdueCount,
        overdueTotal: row.totalOverdue.toFixed(2),
        relevantCount: relevantCharges.length,
        relevantAmount: amount,
        earliestDueAt: dueAt?.toISOString() ?? null,
      });

      return [
        {
          itemKey: `finance:${row.athlete.id}`,
          snapshotToken,
          category: ActionCenterItemCategory.FINANCE,
          type: ActionCenterItemType.FINANCE_FOLLOW_UP,
          urgency,
          subjectId: row.athlete.id,
          subjectName: this.getPersonName(row.athlete),
          relatedName: null,
          count: relevantCharges.length,
          amount,
          currency,
          dueAt,
          occurredAt: dueAt,
          deepLink: `/app/finance/athlete-charges?athleteId=${row.athlete.id}&overdueOnly=${overdueCharges.length > 0 ? 'true' : 'false'}`,
          communicationLink: `/app/communications?athleteIds=${row.athlete.id}&financialState=${
            overdueCharges.length > 0 ? 'overdue' : 'outstanding'
          }&primaryContactsOnly=true`,
          context: {
            overdueCount: row.overdueCount,
            outstandingAmount: row.totalOutstanding.toFixed(2),
            overdueAmount: row.totalOverdue.toFixed(2),
            issueCount: relevantCharges.length,
            state: overdueCharges.length > 0 ? 'overdue' : 'upcoming',
          },
        },
      ];
    });
  }

  private async buildFamilyItems(tenantId: string, now: Date): Promise<GeneratedActionCenterItem[]> {
    const readinessMap = (await this.familyActions.getReadinessMap(tenantId)) as Map<string, AthleteFamilyReadiness>;
    const readinessValues = Array.from(readinessMap.values()).filter(
      (item) => item.status !== FamilyReadinessStatus.COMPLETE,
    );
    const athleteIdsNeedingNames = readinessValues
      .filter((item) => item.actions.length === 0)
      .map((item) => item.athleteId);
    const athleteNameMap = new Map<string, string>();
    if (athleteIdsNeedingNames.length > 0) {
      const athletes = await this.athletes.find({
        where: { tenantId, id: In(athleteIdsNeedingNames) },
        select: { id: true, firstName: true, lastName: true, preferredName: true },
      });
      athletes.forEach((athlete) => athleteNameMap.set(athlete.id, this.getPersonName(athlete)));
    }

    return readinessValues.flatMap<GeneratedActionCenterItem>((item) => {
      const subjectName = item.actions[0]?.athleteName ?? athleteNameMap.get(item.athleteId) ?? item.athleteId;

      if (item.status === FamilyReadinessStatus.AWAITING_STAFF_REVIEW) {
        const reviewActions = item.actions.filter((action) => AWAITING_REVIEW_STATUSES.has(action.status));
        const dueAt = this.getEarliestDate(reviewActions.map((action) => action.dueDate));
        const occurredAt = this.getLatestDate(reviewActions.map((action) => action.updatedAt));
        const snapshotToken = this.hashSnapshot({
          athleteId: item.athleteId,
          pendingReview: item.summary.awaitingStaffReview,
          dueAt: dueAt?.toISOString() ?? null,
          updatedAt: occurredAt?.toISOString() ?? null,
        });

        return [
          {
            itemKey: `family-review:${item.athleteId}`,
            snapshotToken,
            category: ActionCenterItemCategory.FAMILY,
            type: ActionCenterItemType.FAMILY_REVIEW,
            urgency: this.getUrgencyFromDue(dueAt, now),
            subjectId: item.athleteId,
            subjectName,
            relatedName: reviewActions[0]?.guardianName ?? null,
            count: item.summary.awaitingStaffReview,
            amount: null,
            currency: null,
            dueAt,
            occurredAt,
            deepLink: `/app/athletes/${item.athleteId}#family-actions`,
            communicationLink: `/app/communications?athleteIds=${item.athleteId}&needsFollowUp=true&primaryContactsOnly=true`,
            context: {
              issueCount: item.summary.awaitingStaffReview,
              guardianName: reviewActions[0]?.guardianName ?? null,
            },
          },
        ];
      }

      if (item.status === FamilyReadinessStatus.AWAITING_GUARDIAN_ACTION) {
        const pendingActions = item.actions.filter((action) => PENDING_FAMILY_STATUSES.has(action.status));
        const dueAt = this.getEarliestDate(pendingActions.map((action) => action.dueDate));
        const occurredAt = this.getLatestDate(pendingActions.map((action) => action.updatedAt));
        const snapshotToken = this.hashSnapshot({
          athleteId: item.athleteId,
          pendingFamily: item.summary.pendingFamilyActions,
          dueAt: dueAt?.toISOString() ?? null,
          updatedAt: occurredAt?.toISOString() ?? null,
        });

        return [
          {
            itemKey: `guardian-response:${item.athleteId}`,
            snapshotToken,
            category: ActionCenterItemCategory.FAMILY,
            type: ActionCenterItemType.GUARDIAN_RESPONSE,
            urgency: this.getUrgencyFromDue(dueAt, now),
            subjectId: item.athleteId,
            subjectName,
            relatedName: pendingActions[0]?.guardianName ?? null,
            count: item.summary.pendingFamilyActions,
            amount: null,
            currency: null,
            dueAt,
            occurredAt,
            deepLink: `/app/athletes/${item.athleteId}#family-actions`,
            communicationLink: `/app/communications?athleteIds=${item.athleteId}&needsFollowUp=true&primaryContactsOnly=true`,
            context: {
              issueCount: item.summary.pendingFamilyActions,
              guardianName: pendingActions[0]?.guardianName ?? null,
            },
          },
        ];
      }

      const urgency =
        item.issueCodes.includes('missing_primary_contact') || item.issueCodes.includes('missing_primary_group')
          ? ActionCenterItemUrgency.TODAY
          : ActionCenterItemUrgency.NORMAL;
      const snapshotToken = this.hashSnapshot({
        athleteId: item.athleteId,
        issueCodes: item.issueCodes,
        missingItems: item.summary.missingItems,
      });

      return [
        {
          itemKey: `readiness:${item.athleteId}`,
          snapshotToken,
          category: ActionCenterItemCategory.READINESS,
          type: ActionCenterItemType.READINESS_GAP,
          urgency,
          subjectId: item.athleteId,
          subjectName,
          relatedName: null,
          count: item.issueCodes.length,
          amount: null,
          currency: null,
          dueAt: null,
          occurredAt: null,
          deepLink: `/app/athletes/${item.athleteId}#family-actions`,
          communicationLink: `/app/communications?athleteIds=${item.athleteId}&familyReadiness=incomplete&primaryContactsOnly=true`,
          context: {
            issueCodes: item.issueCodes,
            issueCount: item.issueCodes.length,
          },
        },
      ];
    });
  }

  private async buildPrivateLessonItems(tenantId: string, now: Date): Promise<GeneratedActionCenterItem[]> {
    const lessons = await this.privateLessons
      .createQueryBuilder('lesson')
      .leftJoinAndSelect('lesson.athlete', 'athlete')
      .leftJoinAndSelect('lesson.coach', 'coach')
      .where('lesson.tenantId = :tenantId', { tenantId })
      .andWhere('lesson.status = :status', { status: TrainingSessionStatus.PLANNED })
      .andWhere('lesson.scheduledStart >= :from', { from: now })
      .andWhere('lesson.scheduledStart <= :to', { to: this.addHours(now, 48) })
      .orderBy('lesson.scheduledStart', 'ASC')
      .take(40)
      .getMany();

    return lessons.flatMap((lesson) => {
      const issueCodes: string[] = [];
      if (!lesson.focus?.trim()) {
        issueCodes.push('missing_focus');
      }
      if (!lesson.location?.trim()) {
        issueCodes.push('missing_location');
      }
      if (issueCodes.length === 0 || !lesson.athlete) {
        return [];
      }

      const snapshotToken = this.hashSnapshot({
        lessonId: lesson.id,
        scheduledStart: lesson.scheduledStart.toISOString(),
        issueCodes,
      });

      return [
        {
          itemKey: `private-lesson:${lesson.id}`,
          snapshotToken,
          category: ActionCenterItemCategory.PRIVATE_LESSONS,
          type: ActionCenterItemType.PRIVATE_LESSON_PREP,
          urgency: this.getUrgencyFromDue(lesson.scheduledStart, now),
          subjectId: lesson.id,
          subjectName: this.getPersonName(lesson.athlete),
          relatedName: lesson.coach ? this.getPersonName(lesson.coach) : null,
          count: issueCodes.length,
          amount: null,
          currency: null,
          dueAt: lesson.scheduledStart,
          occurredAt: lesson.updatedAt,
          deepLink: `/app/private-lessons?athleteId=${lesson.athleteId}&coachId=${lesson.coachId}&status=planned`,
          communicationLink: `/app/communications?athleteIds=${lesson.athleteId}&coachId=${lesson.coachId}&primaryContactsOnly=true`,
          context: {
            issueCodes,
            issueCount: issueCodes.length,
          },
        },
      ];
    });
  }

  private async buildTrainingPrepItems(tenantId: string, now: Date): Promise<GeneratedActionCenterItem[]> {
    const sessions = await this.trainingSessions
      .createQueryBuilder('session')
      .where('session.tenantId = :tenantId', { tenantId })
      .andWhere('session.status = :status', { status: TrainingSessionStatus.PLANNED })
      .andWhere('session.scheduledStart >= :from', { from: now })
      .andWhere('session.scheduledStart <= :to', { to: this.addHours(now, 24) })
      .orderBy('session.scheduledStart', 'ASC')
      .take(50)
      .getMany();

    return sessions.flatMap((session) => {
      const issueCodes: string[] = [];
      if (!session.coachId) {
        issueCodes.push('missing_coach');
      }
      if (!session.location?.trim()) {
        issueCodes.push('missing_location');
      }
      if (issueCodes.length === 0) {
        return [];
      }

      const snapshotToken = this.hashSnapshot({
        sessionId: session.id,
        scheduledStart: session.scheduledStart.toISOString(),
        coachId: session.coachId ?? null,
        location: session.location ?? null,
      });

      return [
        {
          itemKey: `training-prep:${session.id}`,
          snapshotToken,
          category: ActionCenterItemCategory.TRAINING,
          type: ActionCenterItemType.TRAINING_PREP,
          urgency: this.getUrgencyFromDue(session.scheduledStart, now),
          subjectId: session.id,
          subjectName: session.title,
          relatedName: null,
          count: issueCodes.length,
          amount: null,
          currency: null,
          dueAt: session.scheduledStart,
          occurredAt: session.updatedAt,
          deepLink: `/app/training/${session.id}`,
          communicationLink: `/app/communications?trainingSessionId=${session.id}&primaryContactsOnly=true`,
          context: {
            issueCodes,
            issueCount: issueCodes.length,
          },
        },
      ];
    });
  }

  private async buildTrainingAttendanceItems(tenantId: string, now: Date): Promise<GeneratedActionCenterItem[]> {
    const rows = await this.trainingSessions
      .createQueryBuilder('session')
      .leftJoin(
        Attendance,
        'attendance',
        'attendance.trainingSessionId = session.id AND attendance.tenantId = session.tenantId',
      )
      .select('session.id', 'id')
      .addSelect('session.title', 'title')
      .addSelect('session.scheduledEnd', 'scheduledEnd')
      .addSelect('session.updatedAt', 'updatedAt')
      .where('session.tenantId = :tenantId', { tenantId })
      .andWhere('session.status != :cancelled', { cancelled: TrainingSessionStatus.CANCELLED })
      .andWhere('session.scheduledEnd >= :from', { from: this.addHours(now, -36) })
      .andWhere('session.scheduledEnd <= :to', { to: now })
      .groupBy('session.id')
      .having('COUNT(attendance.id) = 0')
      .orderBy('session.scheduledEnd', 'DESC')
      .limit(40)
      .getRawMany<TrainingAttendanceRow>();

    return rows.map((row) => ({
      itemKey: `training-attendance:${row.id}`,
      snapshotToken: this.hashSnapshot({
        sessionId: row.id,
        scheduledEnd: new Date(row.scheduledEnd).toISOString(),
      }),
      category: ActionCenterItemCategory.TRAINING,
      type: ActionCenterItemType.TRAINING_ATTENDANCE,
      urgency:
        new Date(row.scheduledEnd).getTime() < this.addHours(now, -6).getTime()
          ? ActionCenterItemUrgency.OVERDUE
          : ActionCenterItemUrgency.TODAY,
      subjectId: row.id,
      subjectName: row.title,
      relatedName: null,
      count: 1,
      amount: null,
      currency: null,
      dueAt: new Date(row.scheduledEnd),
      occurredAt: new Date(row.updatedAt),
      deepLink: `/app/training/${row.id}`,
      communicationLink: `/app/communications?trainingSessionId=${row.id}&primaryContactsOnly=true`,
      context: {
        issueCodes: ['attendance_missing'],
        issueCount: 1,
      },
    }));
  }

  private async buildCandidateItems(tenantId: string, now: Date): Promise<GeneratedActionCenterItem[]> {
    const [financeItems, familyItems, privateLessonItems, trainingPrepItems, trainingAttendanceItems] = await Promise.all(
      [
        this.buildFinanceItems(tenantId, now),
        this.buildFamilyItems(tenantId, now),
        this.buildPrivateLessonItems(tenantId, now),
        this.buildTrainingPrepItems(tenantId, now),
        this.buildTrainingAttendanceItems(tenantId, now),
      ],
    );

    return [
      ...financeItems,
      ...familyItems,
      ...privateLessonItems,
      ...trainingPrepItems,
      ...trainingAttendanceItems,
    ];
  }

  private async buildActiveItems(tenantId: string): Promise<ActionCenterItem[]> {
    const now = new Date();
    const [candidates, stateRows] = await Promise.all([
      this.buildCandidateItems(tenantId, now),
      this.states.find({ where: { tenantId } }),
    ]);
    const stateMap = new Map(stateRows.map((state) => [state.itemKey, state]));
    const items = candidates
      .map((item) => this.applyState(item, stateMap.get(item.itemKey), now))
      .filter((item): item is ActionCenterItem => Boolean(item));
    return this.sortItems(items);
  }

  async listItems(tenantId: string, query: ListActionCenterItemsQueryDto) {
    let items = await this.buildActiveItems(tenantId);
    const includeRead = query.includeRead ?? query.view === ActionCenterView.NOTIFICATIONS;
    if (query.category) {
      items = items.filter((item) => item.category === query.category);
    }
    if (query.urgency) {
      items = items.filter((item) => item.urgency === query.urgency);
    }
    if (!includeRead) {
      items = items.filter((item) => !item.read);
    }

    if (query.view === ActionCenterView.NOTIFICATIONS) {
      items = [...items].sort((left, right) => Number(left.read) - Number(right.read));
    }

    const counts = this.buildCounts(items);
    const limit =
      query.limit ??
      (query.view === ActionCenterView.NOTIFICATIONS ? 8 : 50);

    return {
      items: items.slice(0, limit),
      counts,
    };
  }

  async summary(tenantId: string) {
    const items = await this.buildActiveItems(tenantId);
    return {
      counts: this.buildCounts(items),
      items: items.slice(0, 6),
    };
  }

  async updateItems(tenantId: string, dto: UpdateActionCenterItemsDto) {
    if (dto.action === ActionCenterItemMutation.SNOOZE && !dto.snoozedUntil) {
      throw new BadRequestException('snoozedUntil is required when snoozing action-center items');
    }

    const items = await this.buildActiveItems(tenantId);
    const itemMap = new Map(items.map((item) => [item.itemKey, item]));
    const now = new Date();
    const existingRows = await this.states.find({
      where: { tenantId, itemKey: In(dto.itemKeys) },
    });
    const existingMap = new Map(existingRows.map((row) => [row.itemKey, row]));
    const rowsToSave: ActionCenterItemState[] = [];

    for (const itemKey of dto.itemKeys) {
      const item = itemMap.get(itemKey);
      if (!item) {
        continue;
      }

      const row =
        existingMap.get(itemKey) ??
        this.states.create({
          tenantId,
          itemKey,
          metadata: {},
        });

      row.snapshotToken = item.snapshotToken;
      row.category = item.category;
      row.type = item.type;
      row.dismissedAt = null;
      row.completedAt = null;
      if (dto.action !== ActionCenterItemMutation.SNOOZE) {
        row.snoozedUntil = null;
      }

      switch (dto.action) {
        case ActionCenterItemMutation.MARK_READ:
          row.readAt = now;
          break;
        case ActionCenterItemMutation.MARK_UNREAD:
          row.readAt = null;
          break;
        case ActionCenterItemMutation.DISMISS:
          row.dismissedAt = now;
          row.readAt = now;
          break;
        case ActionCenterItemMutation.COMPLETE:
          row.completedAt = now;
          row.readAt = now;
          break;
        case ActionCenterItemMutation.SNOOZE:
          row.snoozedUntil = new Date(dto.snoozedUntil!);
          row.readAt = now;
          break;
        default:
          throw new BadRequestException('Unsupported action-center mutation');
      }

      rowsToSave.push(row);
    }

    if (rowsToSave.length > 0) {
      await this.states.save(rowsToSave);
    }

    return {
      updatedCount: rowsToSave.length,
    };
  }
}
