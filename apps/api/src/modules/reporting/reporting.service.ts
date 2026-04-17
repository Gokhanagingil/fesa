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

type FinanceSummary = Awaited<ReturnType<FinanceService['listAthleteFinanceSummaries']>>;
type CommunicationAudience = Awaited<ReturnType<CommunicationService['listAudience']>>;
type WorkflowSummary = Awaited<ReturnType<FamilyActionService['getWorkflowSummary']>>;
type ActionSummary = Awaited<ReturnType<ActionCenterService['listItems']>>;

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

    const [dashboard, financeSummary, lessons, communicationAudience, workflowSummary, actionSummary] =
      await Promise.all([
        this.finance.getDashboardSummary(tenantId),
        this.finance.listAthleteFinanceSummaries(tenantId, {}),
        lessonsQuery.getMany(),
        this.communications.listAudienceSafe(tenantId, {}),
        this.familyActions.getWorkflowSummarySafe(tenantId),
        this.actionCenter.listItemsSafe(tenantId, staffUserId, { limit: 6, includeRead: true }),
      ]) as [
        Awaited<ReturnType<FinanceService['getDashboardSummary']>>,
        FinanceSummary,
        PrivateLesson[],
        CommunicationAudience,
        WorkflowSummary,
        ActionSummary,
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
    };
  }
}
