import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  ReportCatalogResponse,
  ReportEntityKey,
  ReportRunRequest,
  ReportRunResponse,
  StarterReportListResponse,
} from '@amateur/shared-types';
import { ReportDefinition } from '../../database/entities/report-definition.entity';
import { SavedFilterPreset } from '../../database/entities/saved-filter-preset.entity';
import { PrivateLesson } from '../../database/entities/private-lesson.entity';
import { AthleteCharge } from '../../database/entities/athlete-charge.entity';
import { CommunicationService } from '../communication/communication.service';
import { ActionCenterService } from '../action-center/action-center.service';
import { FamilyActionService } from '../family-action/family-action.service';
import { FinanceService } from '../finance/finance.service';
import { isMissingRelationError } from '../core/database-error.util';
import { getStarterView, listCatalogEntities, listStarterViews } from './catalog';
import { ReportingQueryCompiler } from './query-compiler';
import {
  ATTENDANCE_DECLINE_POINTS,
  ATTENDANCE_FOLLOW_UP_DAYS,
  ATTENDANCE_MIN_MARKED_SESSIONS,
  ATTENDANCE_RECENT_WINDOW_DAYS,
  ATTENDANCE_REPEAT_ABSENCE_COUNT,
  ATTENDANCE_TRIAL_RATE,
  TRAINING_PREP_WINDOW_HOURS,
} from './attendance-intelligence';

type FinanceSummary = Awaited<ReturnType<FinanceService['listAthleteFinanceSummaries']>>;
type CommunicationAudience = Awaited<ReturnType<CommunicationService['listAudience']>>;
type WorkflowSummary = Awaited<ReturnType<FamilyActionService['getWorkflowSummary']>>;
type ActionSummary = Awaited<ReturnType<ActionCenterService['listItems']>>;
type DashboardSummary = Awaited<ReturnType<FinanceService['getDashboardSummary']>>;

@Injectable()
export class ReportingService {
  private readonly compiler: ReportingQueryCompiler;

  constructor(
    @InjectRepository(ReportDefinition)
    private readonly reportDefinitions: Repository<ReportDefinition>,
    @InjectRepository(SavedFilterPreset)
    private readonly savedFilterPresets: Repository<SavedFilterPreset>,
    @InjectRepository(PrivateLesson)
    private readonly privateLessons: Repository<PrivateLesson>,
    private readonly finance: FinanceService,
    private readonly communications: CommunicationService,
    private readonly actionCenter: ActionCenterService,
    private readonly familyActions: FamilyActionService,
    private readonly dataSource: DataSource,
  ) {
    this.compiler = new ReportingQueryCompiler(dataSource);
  }

  async definitions(tenantId: string) {
    const items = [
      {
        key: 'collections-overview',
        titleKey: 'pages.reports.cards.collections.title',
        domains: ['finance', 'payments'],
      },
      {
        key: 'scheduling-overview',
        titleKey: 'pages.reports.cards.scheduling.title',
        domains: ['training', 'attendance'],
      },
      {
        key: 'athlete-balances',
        titleKey: 'pages.reports.cards.balances.title',
        domains: ['finance', 'athletes'],
      },
      {
        key: 'private-lessons',
        titleKey: 'pages.reports.cards.privateLessons.title',
        domains: ['training', 'coaches', 'finance'],
      },
      {
        key: 'communication-audiences',
        titleKey: 'pages.reports.cards.communications.title',
        domains: ['guardians', 'finance', 'training'],
      },
    ];

    let presetCount = 0;
    try {
      presetCount = await this.savedFilterPresets.count({
        where: { tenantId },
      });
    } catch (error) {
      if (!isMissingRelationError(error)) {
        throw error;
      }
    }

    return {
      items,
      presetCount,
      messageKey: 'pages.reports.readyHint',
    };
  }

  catalog(): ReportCatalogResponse {
    return { entities: listCatalogEntities() };
  }

  starterViews(entity?: ReportEntityKey): StarterReportListResponse {
    return { items: listStarterViews(entity) };
  }

  starterView(id: string) {
    return getStarterView(id);
  }

  async run(tenantId: string, request: ReportRunRequest): Promise<ReportRunResponse> {
    return this.compiler.run(request, { tenantId });
  }

  private async buildAttendanceIntelligence(tenantId: string) {
    const attendanceWatchlist = getStarterView('athletes.attendanceWatchlist');
    const trialHighEngagement = getStarterView('athletes.trialHighEngagement');
    const noRecentCheckIn = getStarterView('athletes.noRecentCheckIn');
    const coachLoad = getStarterView('training_sessions.coachLoad');
    const lowAttendanceGroups = getStarterView('training_sessions.lowAttendanceGroups');
    const attendancePending = getStarterView('training_sessions.attendancePending');
    const upcomingNeedsAttention = getStarterView('training_sessions.upcomingNeedsAttention');
    const [
      watchlistRun,
      trialRun,
      noRecentRun,
      coachLoadRun,
      lowAttendanceRun,
      pendingSessionsRun,
      upcomingAttentionRun,
    ] = await Promise.all([
      this.compiler.run(
        {
          entity: 'athletes',
          filter: attendanceWatchlist?.filter ?? undefined,
          columns: [
            'athlete.firstName',
            'athlete.lastName',
            'athlete.primaryGroupName',
            'athlete.attendanceRate30d',
            'athlete.attendanceRateDelta30d',
            'athlete.absentCount30d',
            'athlete.daysSinceLastPresent',
          ],
          sort: [{ field: 'athlete.attendanceRateDelta30d', direction: 'asc' }],
          limit: 5,
        },
        { tenantId },
      ),
      this.compiler.run(
        {
          entity: 'athletes',
          filter: trialHighEngagement?.filter ?? undefined,
          columns: [
            'athlete.firstName',
            'athlete.lastName',
            'athlete.primaryGroupName',
            'athlete.recordedAttendanceCount30d',
            'athlete.attendanceRate30d',
          ],
          sort: [{ field: 'athlete.attendanceRate30d', direction: 'desc' }],
          limit: 5,
        },
        { tenantId },
      ),
      this.compiler.run(
        {
          entity: 'athletes',
          filter: noRecentCheckIn?.filter ?? undefined,
          columns: [
            'athlete.firstName',
            'athlete.lastName',
            'athlete.primaryGroupName',
            'athlete.daysSinceLastPresent',
            'athlete.lastPresentAt',
          ],
          sort: [{ field: 'athlete.daysSinceLastPresent', direction: 'desc' }],
          limit: 5,
        },
        { tenantId },
      ),
      this.compiler.run(
        {
          entity: 'training_sessions',
          filter: coachLoad?.filter ?? undefined,
          groupBy: coachLoad?.groupBy,
          limit: 5,
        },
        { tenantId },
      ),
      this.compiler.run(
        {
          entity: 'training_sessions',
          filter: lowAttendanceGroups?.filter ?? undefined,
          groupBy: lowAttendanceGroups?.groupBy,
          limit: 5,
        },
        { tenantId },
      ),
      this.compiler.run(
        {
          entity: 'training_sessions',
          filter: attendancePending?.filter ?? undefined,
          columns: [
            'session.title',
            'session.scheduledStart',
            'session.groupName',
            'session.coachName',
            'session.rosterSize',
            'session.attendanceRecordedCount',
          ],
          sort: [{ field: 'session.scheduledStart', direction: 'desc' }],
          limit: 5,
        },
        { tenantId },
      ),
      this.compiler.run(
        {
          entity: 'training_sessions',
          filter: upcomingNeedsAttention?.filter ?? undefined,
          columns: [
            'session.title',
            'session.scheduledStart',
            'session.groupName',
            'session.coachName',
            'session.location',
            'session.missingCoach',
            'session.missingLocation',
          ],
          sort: [{ field: 'session.scheduledStart', direction: 'asc' }],
          limit: 5,
        },
        { tenantId },
      ),
    ]);

    return {
      windows: {
        recentDays: ATTENDANCE_RECENT_WINDOW_DAYS,
        followUpDays: ATTENDANCE_FOLLOW_UP_DAYS,
        prepHours: TRAINING_PREP_WINDOW_HOURS,
      },
      thresholds: {
        minimumMarkedSessions: ATTENDANCE_MIN_MARKED_SESSIONS,
        declinePoints: ATTENDANCE_DECLINE_POINTS,
        repeatAbsences: ATTENDANCE_REPEAT_ABSENCE_COUNT,
        trialStrongRate: ATTENDANCE_TRIAL_RATE,
      },
      counts: {
        watchlist: watchlistRun.total,
        trialMomentum: trialRun.total,
        followUp: noRecentRun.total,
        attendancePending: pendingSessionsRun.total,
        upcomingAttention: upcomingAttentionRun.total,
      },
      watchlist: watchlistRun.rows,
      trialMomentum: trialRun.rows,
      followUp: noRecentRun.rows,
      coachLoad: coachLoadRun.rows,
      lowAttendanceGroups: lowAttendanceRun.rows,
      attendancePendingSessions: pendingSessionsRun.rows,
      upcomingAttentionSessions: upcomingAttentionRun.rows,
    };
  }

  async commandCenter(tenantId: string, staffUserId: string) {
    const lessonsQuery = this.privateLessons
      .createQueryBuilder('lesson')
      .leftJoinAndSelect('lesson.coach', 'coach')
      .leftJoinAndSelect('lesson.athlete', 'athlete')
      .leftJoinAndMapOne(
        'lesson.charge',
        AthleteCharge,
        'charge',
        'charge.privateLessonId = lesson.id AND charge.tenantId = lesson.tenantId',
      )
      .leftJoinAndSelect('charge.chargeItem', 'chargeItem')
      .where('lesson.tenantId = :tenantId', { tenantId })
      .orderBy('lesson.scheduledStart', 'ASC')
      .take(20);

    const [
      dashboard,
      financeSummary,
      lessons,
      communicationAudience,
      workflowSummary,
      actionSummary,
      attendanceIntelligence,
    ] =
      await Promise.all([
        this.finance.getDashboardSummary(tenantId),
        this.finance.listAthleteFinanceSummaries(tenantId, {}),
        lessonsQuery.getMany(),
        this.communications.listAudienceSafe(tenantId, {}),
        this.familyActions.getWorkflowSummarySafe(tenantId),
        this.actionCenter.listItemsSafe(tenantId, staffUserId, { limit: 6, includeRead: true }),
        this.buildAttendanceIntelligence(tenantId),
      ]) as [
        DashboardSummary,
        FinanceSummary,
        PrivateLesson[],
        CommunicationAudience,
        WorkflowSummary,
        ActionSummary,
        Awaited<ReturnType<ReportingService['buildAttendanceIntelligence']>>,
      ];

    const today = new Date();
    const upcomingLessons = lessons.filter((lesson: PrivateLesson) => lesson.scheduledStart >= today);
    const followUpLessons = lessons.filter(
      (lesson: PrivateLesson) => lesson.status === 'cancelled' || lesson.attendanceStatus === 'absent',
    );

    return {
      stats: dashboard.stats,
      attendance: dashboard.attendance,
      upcomingByGroup: dashboard.upcomingByGroup,
      groupDistribution: dashboard.groupDistribution,
      recentPayments: dashboard.recentPayments,
      topOutstandingAthletes: dashboard.topOutstandingAthletes,
      overdueCharges: financeSummary.charges
        .filter((charge: AthleteCharge & { isOverdue?: boolean }) => charge.isOverdue)
        .slice(0, 10),
      upcomingPrivateLessons: upcomingLessons.slice(0, 8),
      privateLessonStats: {
        upcoming: upcomingLessons.length,
        followUp: followUpLessons.length,
        billed: lessons.filter((lesson: PrivateLesson) =>
          financeSummary.charges.some((charge: AthleteCharge) => charge.privateLessonId === lesson.id),
        ).length,
      },
      communicationReadiness: {
        audienceAthletes: communicationAudience.counts.athletes,
        reachableGuardians: communicationAudience.counts.guardians,
        athletesWithOverdueBalance: communicationAudience.counts.withOverdueBalance,
        incompleteAthletes: communicationAudience.counts.incompleteAthletes,
        athletesAwaitingGuardianAction: communicationAudience.counts.awaitingGuardianAction,
        athletesAwaitingStaffReview: communicationAudience.counts.awaitingStaffReview,
        athletesNeedingFollowUp: communicationAudience.counts.needingFollowUp,
      },
      familyWorkflow: {
        ...workflowSummary.counts,
        items: workflowSummary.items,
      },
      actionCenter: {
        counts: actionSummary.counts,
        items: actionSummary.items.slice(0, 6),
      },
      attendanceIntelligence,
    };
  }
}
