import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui/EmptyState';
import { InlineAlert } from '../components/ui/InlineAlert';
import { ListPageFrame } from '../components/ui/ListPageFrame';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { apiGet } from '../lib/api';
import { formatDateTime, getMoneyAmount, getPersonName } from '../lib/display';
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
  const { tenantId, loading: tenantLoading } = useTenant();
  const [definitions, setDefinitions] = useState<ReportingDefinitionsResponse['items']>([]);
  const [report, setReport] = useState<CommandCenterResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const [definitionRes, commandCenter] = await Promise.all([
        apiGet<ReportingDefinitionsResponse>('/api/reporting/definitions'),
        apiGet<CommandCenterResponse>('/api/reporting/command-center'),
      ]);
      setDefinitions(definitionRes.items);
      setReport(commandCenter);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

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

            <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
                <h2 className="font-display text-lg font-semibold text-amateur-ink">
                  {t('pages.reports.availableReports')}
                </h2>
                <p className="mt-1 text-sm text-amateur-muted">{t('pages.reports.readyHint')}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {definitions.map((definition) => (
                    <div
                      key={definition.key}
                      className="rounded-xl border border-amateur-border bg-amateur-surface px-4 py-4"
                    >
                      <p className="font-medium text-amateur-ink">{t(definition.titleKey)}</p>
                      <p className="mt-2 text-xs text-amateur-muted">
                        {definition.domains.join(' · ')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

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
                    to="/app/finance/athlete-charges?status=pending"
                    className="text-sm font-medium text-amateur-accent hover:underline"
                  >
                    {t('pages.athleteCharges.viewAll')} →
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
                    to="/app/private-lessons"
                    className="text-sm font-medium text-amateur-accent hover:underline"
                  >
                    {t('pages.privateLessons.openBoard')} →
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
              </div>
            </section>
          </div>
        )}
      </ListPageFrame>
    </div>
  );
}
