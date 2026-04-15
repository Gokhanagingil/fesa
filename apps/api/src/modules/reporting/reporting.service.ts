import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportDefinition } from '../../database/entities/report-definition.entity';
import { SavedFilterPreset } from '../../database/entities/saved-filter-preset.entity';
import { PrivateLesson } from '../../database/entities/private-lesson.entity';
import { AthleteCharge } from '../../database/entities/athlete-charge.entity';
import { CommunicationService } from '../communication/communication.service';
import { FinanceService } from '../finance/finance.service';

@Injectable()
export class ReportingService {
  constructor(
    @InjectRepository(ReportDefinition)
    private readonly reportDefinitions: Repository<ReportDefinition>,
    @InjectRepository(SavedFilterPreset)
    private readonly savedFilterPresets: Repository<SavedFilterPreset>,
    @InjectRepository(PrivateLesson)
    private readonly privateLessons: Repository<PrivateLesson>,
    private readonly finance: FinanceService,
    private readonly communications: CommunicationService,
  ) {}

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

    const presetCount = await this.savedFilterPresets.count({ where: { tenantId } });

    return {
      items,
      presetCount,
      messageKey: 'pages.reports.readyHint',
    };
  }

  async commandCenter(tenantId: string) {
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

    const [dashboard, financeSummary, lessons, communicationAudience] = await Promise.all([
      this.finance.getDashboardSummary(tenantId),
      this.finance.listAthleteFinanceSummaries(tenantId, {}),
      lessonsQuery.getMany(),
      this.communications.listAudience(tenantId, {}),
    ]);

    const today = new Date();
    const upcomingLessons = lessons.filter((lesson) => lesson.scheduledStart >= today);
    const followUpLessons = lessons.filter(
      (lesson) => lesson.status === 'cancelled' || lesson.attendanceStatus === 'absent',
    );

    return {
      stats: dashboard.stats,
      attendance: dashboard.attendance,
      upcomingByGroup: dashboard.upcomingByGroup,
      groupDistribution: dashboard.groupDistribution,
      recentPayments: dashboard.recentPayments,
      topOutstandingAthletes: dashboard.topOutstandingAthletes,
      overdueCharges: financeSummary.charges.filter((charge) => charge.isOverdue).slice(0, 10),
      upcomingPrivateLessons: upcomingLessons.slice(0, 8),
      privateLessonStats: {
        upcoming: upcomingLessons.length,
        followUp: followUpLessons.length,
        billed: lessons.filter((lesson) => financeSummary.charges.some((charge) => charge.privateLessonId === lesson.id)).length,
      },
      communicationReadiness: {
        audienceAthletes: communicationAudience.counts.athletes,
        reachableGuardians: communicationAudience.counts.guardians,
        athletesWithOverdueBalance: communicationAudience.counts.withOverdueBalance,
      },
    };
  }
}
