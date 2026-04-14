import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportDefinition } from '../../database/entities/report-definition.entity';
import { SavedFilterPreset } from '../../database/entities/saved-filter-preset.entity';
import { FinanceService } from '../finance/finance.service';

@Injectable()
export class ReportingService {
  constructor(
    @InjectRepository(ReportDefinition)
    private readonly reportDefinitions: Repository<ReportDefinition>,
    @InjectRepository(SavedFilterPreset)
    private readonly savedFilterPresets: Repository<SavedFilterPreset>,
    private readonly finance: FinanceService,
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
    ];

    const presetCount = await this.savedFilterPresets.count({ where: { tenantId } });

    return {
      items,
      presetCount,
      messageKey: 'pages.reports.readyHint',
    };
  }

  async commandCenter(tenantId: string) {
    const dashboard = await this.finance.getDashboardSummary(tenantId);
    const financeSummary = await this.finance.listAthleteFinanceSummaries(tenantId, {});

    return {
      stats: dashboard.stats,
      attendance: dashboard.attendance,
      upcomingByGroup: dashboard.upcomingByGroup,
      groupDistribution: dashboard.groupDistribution,
      recentPayments: dashboard.recentPayments,
      topOutstandingAthletes: dashboard.topOutstandingAthletes,
      overdueCharges: financeSummary.charges.filter((charge) => charge.isOverdue).slice(0, 10),
    };
  }
}
