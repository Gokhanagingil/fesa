import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui/EmptyState';
import { InlineAlert } from '../components/ui/InlineAlert';
import { ListPageFrame } from '../components/ui/ListPageFrame';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { StarterViewsPanel } from '../components/reporting/StarterViewsPanel';
import { buildReportBuilderLink, buildSavedViewLink, buildStarterLink } from '../lib/report-deep-link';
import { apiGet } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import {
  formatDateTime,
  getActionCenterItemSummary,
  getActionCenterTypeLabel,
  getFamilyActionStatusLabel,
  getMoneyAmount,
  getPersonName,
} from '../lib/display';
import { listSavedViews } from '../lib/reporting-client';
import type { SavedReportView } from '../lib/reporting-types';
import { useTenant } from '../lib/tenant-hooks';
import type {
  AthleteCharge,
  CommandCenterResponse,
  Payment,
  PrivateLesson,
  ReportingDefinitionsResponse,
} from '../lib/domain-types';

export function ReportsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [definitions, setDefinitions] = useState<ReportingDefinitionsResponse['items']>([]);
  const [report, setReport] = useState<CommandCenterResponse | null>(null);
  const [savedViews, setSavedViews] = useState<SavedReportView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const [definitionRes, commandCenter, savedViewRes] = await Promise.all([
        apiGet<ReportingDefinitionsResponse>('/api/reporting/definitions'),
        apiGet<CommandCenterResponse>('/api/reporting/command-center'),
        listSavedViews(),
      ]);
      setDefinitions(definitionRes.items);
      setReport(commandCenter);
      setSavedViews(savedViewRes.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const continueViews = useMemo(
    () =>
      [...savedViews]
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
        .slice(0, 3),
    [savedViews],
  );

  const actionableDefinitions = useMemo(
    () =>
      definitions.map((definition) => {
        switch (definition.key) {
          case 'collections-overview':
            return {
              ...definition,
              href: buildStarterLink('finance.overdue'),
              cta: t('pages.reports.definitionActions.openStarter'),
            };
          case 'scheduling-overview':
            return {
              ...definition,
              href: buildStarterLink('lessons.byCoach'),
              cta: t('pages.reports.definitionActions.openGrouped'),
            };
          case 'athlete-balances':
            return {
              ...definition,
              href: buildStarterLink('athletes.outstandingBalance'),
              cta: t('pages.reports.definitionActions.openStarter'),
            };
          case 'private-lessons':
            return {
              ...definition,
              href: buildStarterLink('lessons.upcoming'),
              cta: t('pages.reports.definitionActions.openStarter'),
            };
          case 'communication-audiences':
            return {
              ...definition,
              href: buildReportBuilderLink({
                entity: 'athletes',
                columns: ['firstName', 'lastName', 'primaryGroup', 'outstandingTotal'],
                sort: [{ field: 'outstandingTotal', direction: 'desc' }],
                contextLabel: t('pages.reports.communicationReadyContext'),
              }),
              cta: t('pages.reports.definitionActions.openBuilder'),
            };
          default:
            return {
              ...definition,
              href: '/app/report-builder',
              cta: t('pages.reports.definitionActions.openBuilder'),
            };
        }
      }),
    [definitions, t],
  );

  const reportLaunchCards = useMemo(
    () => [
      {
        title: t('pages.reports.launch.attendanceStarterTitle'),
        body: t('pages.reports.launch.attendanceStarterBody'),
        action: t('pages.reports.launch.attendanceStarterAction'),
        href: buildStarterLink('athletes.attendanceWatchlist'),
      },
      {
        title: t('pages.reports.launch.openGroupedTitle'),
        body: t('pages.reports.launch.openGroupedBody'),
        action: t('pages.reports.launch.openGroupedAction'),
        href: buildStarterLink('training_sessions.lowAttendanceGroups'),
      },
      {
        title: t('pages.reports.launch.openBuilderTitle'),
        body: t('pages.reports.launch.openBuilderBody'),
        action: t('pages.reports.launch.openBuilderAction'),
        href: '/app/report-builder',
      },
    ],
    [t],
  );

  return (
    <div>
      <PageHeader title={t('pages.reports.title')} subtitle={t('pages.reports.subtitle')} />
      <ListPageFrame>
        {!tenantId && !tenantLoading ? (
          <InlineAlert tone="info">{t('app.errors.needTenant')}</InlineAlert>
        ) : error ? (
          <InlineAlert tone="error">{error}</InlineAlert>
        ) : loading && !report ? (
          <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>
        ) : !report ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            <section className="rounded-3xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amateur-accent">
                    {t('pages.reports.launch.eyebrow')}
                  </p>
                  <h2 className="mt-2 font-display text-2xl font-semibold text-amateur-ink">
                    {t('pages.reports.launch.title')}
                  </h2>
                  <p className="mt-2 text-sm text-amateur-muted">{t('pages.reports.launch.subtitle')}</p>
                </div>
                <div className="rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-3 text-sm text-amateur-muted">
                  <p className="font-semibold text-amateur-ink">{t('pages.reports.launch.saveExportTitle')}</p>
                  <p className="mt-1">{t('pages.reports.launch.saveExportBody')}</p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {reportLaunchCards.map((card) => (
                  <Link
                    key={card.title}
                    to={card.href}
                    className="rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-4 transition hover:border-amateur-accent/40 hover:shadow"
                  >
                    <p className="font-display text-base font-semibold text-amateur-ink">{card.title}</p>
                    <p className="mt-2 text-sm text-amateur-muted">{card.body}</p>
                    <span className="mt-4 inline-flex text-sm font-semibold text-amateur-accent">
                      {card.action} →
                    </span>
                  </Link>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to={buildStarterLink('athletes.attendanceWatchlist')}>
                  <Button type="button">{t('pages.reports.launch.primaryAction')}</Button>
                </Link>
                <Link to="/app/report-builder">
                  <Button type="button" variant="ghost">
                    {t('pages.reports.launch.secondaryAction')}
                  </Button>
                </Link>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-amateur-ink">
                      {t('pages.reports.continueTitle')}
                    </h2>
                    <p className="mt-1 text-sm text-amateur-muted">{t('pages.reports.continueHint')}</p>
                  </div>
                  <Link to="/app/report-builder" className="text-sm font-medium text-amateur-accent hover:underline">
                    {t('pages.reports.definitionActions.openBuilder')} →
                  </Link>
                </div>
                <div className="mt-4 space-y-3">
                  {continueViews.length === 0 ? (
                    <EmptyState
                      title={t('pages.reports.continueEmpty')}
                      hint={t('pages.reports.continueEmptyHint')}
                    />
                  ) : (
                    continueViews.map((view) => (
                      <Link
                        key={view.id}
                        to={buildSavedViewLink(view.id)}
                        className="block rounded-xl border border-amateur-border bg-amateur-surface px-4 py-3 transition hover:border-amateur-accent/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-amateur-ink">{view.name}</p>
                            <p className="mt-1 text-xs text-amateur-muted">
                              {[t(`pages.reports.starter.categories.${categoryForEntity(view.entity)}`), view.visibility === 'shared' ? t('pages.reports.savedViews.shared') : t('pages.reports.savedViews.private')]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </div>
                          <span className="text-xs text-amateur-muted">
                            {formatDateTime(view.updatedAt, i18n.language)}
                          </span>
                        </div>
                        {view.description ? (
                          <p className="mt-2 text-sm text-amateur-muted">{view.description}</p>
                        ) : null}
                      </Link>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
                <h2 className="font-display text-lg font-semibold text-amateur-ink">
                  {t('pages.reports.availableReports')}
                </h2>
                <p className="mt-1 text-sm text-amateur-muted">{t('pages.reports.readyHint')}</p>
                <div className="mt-4 grid gap-3">
                  {actionableDefinitions.map((definition) => (
                    <Link
                      key={definition.key}
                      to={definition.href}
                      className="rounded-xl border border-amateur-border bg-amateur-surface px-4 py-4 transition hover:border-amateur-accent/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-amateur-ink">{t(definition.titleKey)}</p>
                          <p className="mt-2 text-xs text-amateur-muted">
                            {definition.domains.join(' · ')}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-amateur-accent">{definition.cta} →</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </section>

            <StarterViewsPanel
              managementOnly
              title={t('pages.reports.management.title')}
              subtitle={t('pages.reports.management.subtitle')}
              onApply={(view) => navigate(buildStarterLink(view.id))}
            />

            <section className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amateur-accent">
                    {t('pages.reports.attendancePulse.eyebrow')}
                  </p>
                  <h2 className="mt-1 font-display text-lg font-semibold text-amateur-ink">
                    {t('pages.reports.attendancePulse.title')}
                  </h2>
                  <p className="mt-1 max-w-3xl text-sm text-amateur-muted">
                    {t('pages.reports.attendancePulse.subtitle', {
                      recentDays: report.attendanceIntelligence?.windows.recentDays ?? 30,
                    })}
                  </p>
                </div>
                <Link
                  to={buildStarterLink('athletes.attendanceWatchlist')}
                  className="text-sm font-medium text-amateur-accent hover:underline"
                >
                  {t('pages.reports.attendancePulse.openWatchlist')} →
                </Link>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-5">
                <StatCard
                  label={t('pages.reports.attendancePulse.watchlist')}
                  value={report.attendanceIntelligence?.counts.watchlist ?? 0}
                  compact
                  tone={(report.attendanceIntelligence?.counts.watchlist ?? 0) > 0 ? 'danger' : 'default'}
                />
                <StatCard
                  label={t('pages.reports.attendancePulse.trialMomentum')}
                  value={report.attendanceIntelligence?.counts.trialMomentum ?? 0}
                  compact
                />
                <StatCard
                  label={t('pages.reports.attendancePulse.followUp')}
                  value={report.attendanceIntelligence?.counts.followUp ?? 0}
                  compact
                  tone={(report.attendanceIntelligence?.counts.followUp ?? 0) > 0 ? 'danger' : 'default'}
                />
                <StatCard
                  label={t('pages.reports.attendancePulse.pendingSessions')}
                  value={report.attendanceIntelligence?.counts.attendancePending ?? 0}
                  compact
                  tone={(report.attendanceIntelligence?.counts.attendancePending ?? 0) > 0 ? 'danger' : 'default'}
                />
                <StatCard
                  label={t('pages.reports.attendancePulse.prepAttention')}
                  value={report.attendanceIntelligence?.counts.upcomingAttention ?? 0}
                  compact
                />
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-2xl border border-amateur-border bg-amateur-surface px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-display text-base font-semibold text-amateur-ink">
                        {t('pages.reports.attendancePulse.watchlistTitle')}
                      </h3>
                      <p className="mt-1 text-sm text-amateur-muted">
                        {t('pages.reports.attendancePulse.watchlistHint')}
                      </p>
                    </div>
                    <Link
                      to={buildStarterLink('athletes.attendanceWatchlist')}
                      className="text-sm font-medium text-amateur-accent hover:underline"
                    >
                      {t('pages.reports.definitionActions.openStarter')} →
                    </Link>
                  </div>
                  <div className="mt-4 space-y-3">
                    {(report.attendanceIntelligence?.watchlist ?? []).length === 0 ? (
                      <EmptyState
                        title={t('pages.reports.attendancePulse.watchlistEmpty')}
                        hint={t('pages.reports.attendancePulse.watchlistEmptyHint')}
                      />
                    ) : (
                      (report.attendanceIntelligence?.watchlist ?? []).map((row, index) => (
                        <div
                          key={`attendance-watchlist-${index}`}
                          className="rounded-xl border border-amateur-border bg-amateur-canvas px-4 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-amateur-ink">
                                {[row['athlete.firstName'], row['athlete.lastName']].filter(Boolean).join(' ')}
                              </p>
                              <p className="mt-1 text-xs text-amateur-muted">
                                {t('pages.reports.attendancePulse.watchlistMeta', {
                                  groupName: row['athlete.primaryGroupName'] ?? t('pages.training.unknownGroup'),
                                  rate: row['athlete.attendanceRate30d'] ?? '—',
                                  delta: row['athlete.attendanceRateDelta30d'] ?? '—',
                                  absentCount: row['athlete.absentCount30d'] ?? 0,
                                })}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-rose-700">
                              {row['athlete.daysSinceLastPresent'] ?? '—'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-amateur-border bg-amateur-surface px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-display text-base font-semibold text-amateur-ink">
                          {t('pages.reports.attendancePulse.groupSnapshotTitle')}
                        </h3>
                        <p className="mt-1 text-sm text-amateur-muted">
                          {t('pages.reports.attendancePulse.groupSnapshotHint')}
                        </p>
                      </div>
                      <Link
                        to={buildStarterLink('training_sessions.lowAttendanceGroups')}
                        className="text-sm font-medium text-amateur-accent hover:underline"
                      >
                        {t('pages.reports.definitionActions.openGrouped')} →
                      </Link>
                    </div>
                    <div className="mt-4 space-y-3">
                      {(report.attendanceIntelligence?.lowAttendanceGroups ?? []).length === 0 ? (
                        <EmptyState
                          title={t('pages.reports.attendancePulse.groupSnapshotEmpty')}
                          hint={t('pages.reports.attendancePulse.groupSnapshotEmptyHint')}
                        />
                      ) : (
                        (report.attendanceIntelligence?.lowAttendanceGroups ?? []).map((row, index) => (
                          <div
                            key={`attendance-groups-${index}`}
                            className="flex items-center justify-between gap-3 rounded-xl border border-amateur-border bg-amateur-canvas px-4 py-3"
                          >
                            <div>
                              <p className="font-medium text-amateur-ink">{row.dim_session_groupName ?? '—'}</p>
                              <p className="mt-1 text-xs text-amateur-muted">
                                {t('pages.reports.attendancePulse.groupSnapshotMeta', {
                                  sessionCount: row.sessionCount ?? 0,
                                })}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-amateur-ink">
                              {row.avgAttendanceRate ?? '—'}%
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amateur-border bg-amateur-surface px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-display text-base font-semibold text-amateur-ink">
                          {t('pages.reports.attendancePulse.coachSnapshotTitle')}
                        </h3>
                        <p className="mt-1 text-sm text-amateur-muted">
                          {t('pages.reports.attendancePulse.coachSnapshotHint')}
                        </p>
                      </div>
                      <Link
                        to={buildStarterLink('training_sessions.coachLoad')}
                        className="text-sm font-medium text-amateur-accent hover:underline"
                      >
                        {t('pages.reports.definitionActions.openGrouped')} →
                      </Link>
                    </div>
                    <div className="mt-4 space-y-3">
                      {(report.attendanceIntelligence?.coachLoad ?? []).length === 0 ? (
                        <EmptyState
                          title={t('pages.reports.attendancePulse.coachSnapshotEmpty')}
                          hint={t('pages.reports.attendancePulse.coachSnapshotEmptyHint')}
                        />
                      ) : (
                        (report.attendanceIntelligence?.coachLoad ?? []).map((row, index) => (
                          <div
                            key={`attendance-coaches-${index}`}
                            className="flex items-center justify-between gap-3 rounded-xl border border-amateur-border bg-amateur-canvas px-4 py-3"
                          >
                            <div>
                              <p className="font-medium text-amateur-ink">{row.dim_session_coachName ?? '—'}</p>
                              <p className="mt-1 text-xs text-amateur-muted">
                                {t('pages.reports.attendancePulse.coachSnapshotMeta', {
                                  avgRosterSize: row.avgRosterSize ?? 0,
                                })}
                              </p>
                            </div>
                            <span className="text-sm font-semibold text-amateur-ink">
                              {row.sessionCount ?? 0}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <StatCard
                label={t('pages.reports.commandCenter.outstanding')}
                value={report.stats.outstandingTotal}
                helper={t('pages.reports.commandCenter.outstandingHint')}
              />
              <StatCard
                label={t('pages.reports.commandCenter.overdue')}
                value={report.stats.overdueTotal}
                helper={t('pages.reports.commandCenter.overdueHint')}
              />
              <StatCard
                label={t('pages.reports.commandCenter.collected')}
                value={report.stats.collectedTotal}
                helper={t('pages.reports.commandCenter.collectedHint')}
              />
            </section>

            <section className="grid gap-4 md:grid-cols-4">
              <StatCard
                label={t('pages.reports.familyWorkflow.pendingFamily')}
                value={report.familyWorkflow?.pendingFamilyAction ?? 0}
                compact
                tone={(report.familyWorkflow?.pendingFamilyAction ?? 0) > 0 ? 'danger' : 'default'}
              />
              <StatCard
                label={t('pages.reports.familyWorkflow.awaitingReview')}
                value={report.familyWorkflow?.awaitingStaffReview ?? 0}
                compact
                tone={(report.familyWorkflow?.awaitingStaffReview ?? 0) > 0 ? 'danger' : 'default'}
              />
              <StatCard
                label={t('pages.reports.familyWorkflow.incompleteAthletes')}
                value={report.familyWorkflow?.incompleteAthletes ?? 0}
                compact
              />
              <StatCard
                label={t('pages.reports.familyWorkflow.needingFollowUp')}
                value={
                  (report.communicationReadiness?.athletesNeedingFollowUp ?? 0) ||
                  ((report.familyWorkflow?.pendingFamilyAction ?? 0) + (report.familyWorkflow?.awaitingStaffReview ?? 0))
                }
                compact
              />
            </section>

            <section className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-amateur-ink">
                    {t('pages.reports.actionCenter.title')}
                  </h2>
                  <p className="mt-1 text-sm text-amateur-muted">
                    {t('pages.reports.actionCenter.hint')}
                  </p>
                </div>
                <Link
                  to="/app/action-center"
                  className="text-sm font-medium text-amateur-accent hover:underline"
                >
                  {t('pages.reports.actionCenter.openQueue')} →
                </Link>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <StatCard
                  label={t('pages.reports.actionCenter.unread')}
                  value={report.actionCenter?.counts.unread ?? 0}
                  compact
                  tone={(report.actionCenter?.counts.unread ?? 0) > 0 ? 'danger' : 'default'}
                />
                <StatCard
                  label={t('pages.reports.actionCenter.overdue')}
                  value={report.actionCenter?.counts.overdue ?? 0}
                  compact
                  tone={(report.actionCenter?.counts.overdue ?? 0) > 0 ? 'danger' : 'default'}
                />
                <StatCard
                  label={t('pages.reports.actionCenter.today')}
                  value={report.actionCenter?.counts.today ?? 0}
                  compact
                  tone={(report.actionCenter?.counts.today ?? 0) > 0 ? 'danger' : 'default'}
                />
                <StatCard
                  label={t('pages.reports.actionCenter.total')}
                  value={report.actionCenter?.counts.total ?? 0}
                  compact
                />
              </div>
              <div className="mt-4 space-y-3">
                {(report.actionCenter?.items ?? []).length === 0 ? (
                  <EmptyState
                    title={t('pages.reports.actionCenter.empty')}
                    hint={t('pages.reports.actionCenter.emptyHint')}
                  />
                ) : (
                  (report.actionCenter?.items ?? []).map((item) => (
                    <div
                      key={item.itemKey}
                      className="rounded-xl border border-amateur-border bg-amateur-surface px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-amateur-ink">
                            {getActionCenterTypeLabel(t, item.type)}
                          </p>
                          <p className="mt-1 text-xs text-amateur-muted">
                            {[item.subjectName, getActionCenterItemSummary(t, item)].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                        <Link
                          to={item.deepLink}
                          className="text-sm font-medium text-amateur-accent hover:underline"
                        >
                          {t('pages.actionCenter.openItem')}
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
                <h2 className="font-display text-lg font-semibold text-amateur-ink">
                  {t('pages.reports.commandCenter.title')}
                </h2>
                <div className="mt-4 space-y-3">
                  {report.topOutstandingAthletes.length === 0 ? (
                    <EmptyState
                      title={t('pages.reports.commandCenter.noOutstanding')}
                      hint={t('pages.reports.commandCenter.noOutstandingHint')}
                    />
                  ) : (
                    report.topOutstandingAthletes.map((row) => (
                      <div
                        key={row.athlete.id}
                        className="rounded-xl border border-amateur-border bg-amateur-surface px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <Link
                            to={`/app/athletes/${row.athlete.id}`}
                            className="font-medium text-amateur-accent hover:underline"
                          >
                            {getPersonName(row.athlete)}
                          </Link>
                          <span className="text-sm font-semibold text-amateur-ink">
                            {row.totalOutstanding.toFixed(2)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-amateur-muted">
                          {t('pages.reports.commandCenter.outstandingMeta', {
                            overdueCount: row.overdueCount,
                            partialCount: row.partialCount,
                            unpaidCount: row.unpaidCount,
                          })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-amateur-ink">
                      {t('pages.reports.commandCenter.overdueCharges')}
                    </h2>
                    <p className="mt-1 text-sm text-amateur-muted">
                      {t('pages.reports.commandCenter.overdueChargesHint')}
                    </p>
                  </div>
                  <Link
                    to={buildStarterLink('finance.overdue')}
                    className="text-sm font-medium text-amateur-accent hover:underline"
                  >
                    {t('pages.reports.definitionActions.openStarter')} →
                  </Link>
                </div>
                <div className="mt-4 space-y-3">
                  {report.overdueCharges.length === 0 ? (
                    <EmptyState
                      title={t('pages.reports.commandCenter.noOverdue')}
                      hint={t('pages.reports.commandCenter.noOverdueHint')}
                    />
                  ) : (
                    report.overdueCharges.map((charge: AthleteCharge) => (
                      <div
                        key={charge.id}
                        className="rounded-xl border border-amateur-border bg-amateur-surface px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-amateur-ink">
                              {charge.chargeItem?.name ?? charge.chargeItemId}
                            </p>
                            <p className="text-xs text-amateur-muted">
                              {charge.athlete ? getPersonName(charge.athlete) : t('pages.athleteCharges.openAthlete')}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-red-700">
                            {getMoneyAmount(charge.remainingAmount ?? '0.00', charge.chargeItem?.currency)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-amateur-ink">
                    {t('pages.reports.commandCenter.recentCollections')}
                  </h2>
                  <p className="mt-1 text-sm text-amateur-muted">
                    {t('pages.reports.commandCenter.recentCollectionsHint')}
                  </p>
                </div>
                <div className="mt-4 space-y-3">
                  {report.recentPayments.length === 0 ? (
                    <EmptyState
                      title={t('pages.reports.commandCenter.noPayments')}
                      hint={t('pages.reports.commandCenter.noPaymentsHint')}
                    />
                  ) : (
                    report.recentPayments.map((payment: Payment) => (
                      <div
                        key={payment.id}
                        className="rounded-xl border border-amateur-border bg-amateur-surface px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-amateur-ink">
                              {payment.athlete ? getPersonName(payment.athlete) : '—'}
                            </p>
                            <p className="text-xs text-amateur-muted">
                              {formatDateTime(payment.paidAt, i18n.language)}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-amateur-ink">
                            {payment.currency} {payment.amount}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-amateur-ink">
                      {t('pages.reports.commandCenter.privateLessons')}
                    </h2>
                    <p className="mt-1 text-sm text-amateur-muted">
                      {t('pages.reports.commandCenter.privateLessonsHint')}
                    </p>
                  </div>
                  <Link
                    to={buildStarterLink('lessons.upcoming')}
                    className="text-sm font-medium text-amateur-accent hover:underline"
                  >
                    {t('pages.reports.definitionActions.openStarter')} →
                  </Link>
                </div>
                <div className="mt-4 space-y-3">
                  {(report.upcomingPrivateLessons ?? []).length === 0 ? (
                    <EmptyState
                      title={t('pages.reports.commandCenter.noPrivateLessons')}
                      hint={t('pages.reports.commandCenter.noPrivateLessonsHint')}
                    />
                  ) : (
                    (report.upcomingPrivateLessons ?? []).map((lesson: PrivateLesson) => (
                      <div
                        key={lesson.id}
                        className="rounded-xl border border-amateur-border bg-amateur-surface px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-amateur-ink">
                              {lesson.athlete ? getPersonName(lesson.athlete) : '—'}
                            </p>
                            <p className="text-xs text-amateur-muted">
                              {lesson.coach
                                ? `${lesson.coach.preferredName || `${lesson.coach.firstName} ${lesson.coach.lastName}`}`
                                : '—'}
                              {' · '}
                              {formatDateTime(lesson.scheduledStart, i18n.language)}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-amateur-ink">
                            {lesson.charge?.remainingAmount
                              ? getMoneyAmount(lesson.charge.remainingAmount, lesson.charge.chargeItem?.currency)
                              : t('app.states.empty')}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-amateur-ink">
                      {t('pages.reports.commandCenter.communication')}
                    </h2>
                    <p className="mt-1 text-sm text-amateur-muted">
                      {t('pages.reports.commandCenter.communicationHint')}
                    </p>
                  </div>
                  <Link
                    to="/app/communications"
                    className="text-sm font-medium text-amateur-accent hover:underline"
                  >
                    {t('pages.communications.openBuilder')} →
                  </Link>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <StatCard
                    label={t('pages.communications.summaryAthletes')}
                    value={report.communicationReadiness?.audienceAthletes ?? 0}
                    compact
                  />
                  <StatCard
                    label={t('pages.communications.summaryGuardians')}
                    value={report.communicationReadiness?.reachableGuardians ?? 0}
                    compact
                  />
                  <StatCard
                    label={t('pages.communications.summaryOverdue')}
                    value={report.communicationReadiness?.athletesWithOverdueBalance ?? 0}
                    compact
                    tone="danger"
                  />
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <StatCard
                    label={t('pages.communications.summaryIncomplete')}
                    value={report.communicationReadiness?.incompleteAthletes ?? 0}
                    compact
                  />
                  <StatCard
                    label={t('pages.communications.summaryAwaitingGuardian')}
                    value={report.communicationReadiness?.athletesAwaitingGuardianAction ?? 0}
                    compact
                  />
                  <StatCard
                    label={t('pages.communications.summaryAwaitingReview')}
                    value={report.communicationReadiness?.athletesAwaitingStaffReview ?? 0}
                    compact
                  />
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-amateur-ink">
                    {t('pages.reports.familyWorkflow.title')}
                  </h2>
                  <p className="mt-1 text-sm text-amateur-muted">
                    {t('pages.reports.familyWorkflow.hint')}
                  </p>
                </div>
                <Link
                  to="/app/communications?needsFollowUp=true"
                  className="text-sm font-medium text-amateur-accent hover:underline"
                >
                  {t('pages.communications.openBuilder')} →
                </Link>
              </div>
              <div className="mt-4 space-y-3">
                {(report.familyWorkflow?.items ?? []).length === 0 ? (
                  <EmptyState
                    title={t('pages.reports.familyWorkflow.empty')}
                    hint={t('pages.reports.familyWorkflow.emptyHint')}
                  />
                ) : (
                  report.familyWorkflow?.items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-amateur-border bg-amateur-surface px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-amateur-ink">{item.title}</p>
                          <p className="mt-1 text-xs text-amateur-muted">
                            {[item.athleteName, item.guardianName, getFamilyActionStatusLabel(t, item.status)]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                        <Link
                          to={`/app/athletes/${item.athleteId}#family-actions`}
                          className="text-sm font-medium text-amateur-accent hover:underline"
                        >
                          {t('pages.athletes.detailTitle')}
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </ListPageFrame>
    </div>
  );
}

function categoryForEntity(
  entity: SavedReportView['entity'],
): 'roster' | 'finance' | 'scheduling' | 'contact' | 'attendance' {
  switch (entity) {
    case 'finance_charges':
      return 'finance';
    case 'training_sessions':
      return 'attendance';
    case 'private_lessons':
      return 'scheduling';
    case 'guardians':
      return 'contact';
    case 'athletes':
    default:
      return 'roster';
  }
}
