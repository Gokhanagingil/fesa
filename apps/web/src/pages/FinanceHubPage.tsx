import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { InlineAlert } from '../components/ui/InlineAlert';
import { DataExplorer } from '../components/reporting/DataExplorer';
import { apiGet } from '../lib/api';
import { getLessonStatusLabel, getPersonName } from '../lib/display';
import type { TrainingSessionStatus } from '../lib/domain-types';
import { useTenant } from '../lib/tenant-hooks';

type FinanceSummaryResponse = {
  totals: {
    totalCharged: string;
    totalCollected: string;
    totalOutstanding: string;
    totalOverdue: string;
  };
  athletes: Array<{
    athlete: {
      id: string;
      firstName: string;
      lastName: string;
      preferredName: string | null;
    };
    totalOutstanding: number;
    overdueCount: number;
  }>;
  recentPayments: Array<{
    id: string;
    amount: string;
    currency: string;
  }>;
  privateLessons?: Array<{
    id: string;
    athleteId: string;
    scheduledStart: string;
    status: TrainingSessionStatus;
    athlete?: {
      id: string;
      firstName: string;
      lastName: string;
      preferredName: string | null;
    };
  }>;
};

export function FinanceHubPage() {
  const { t, i18n } = useTranslation();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [summary, setSummary] = useState<FinanceSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<FinanceSummaryResponse>('/api/finance/athlete-summaries');
      setSummary(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [tenantId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHeader title={t('pages.finance.title')} subtitle={t('pages.finance.subtitle')} />
      <details className="mb-6 rounded-2xl border border-amateur-border bg-amateur-surface p-4 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-amateur-ink">
          {t('pages.finance.advancedExplorer')}
        </summary>
        <p className="mt-1 text-xs text-amateur-muted">{t('pages.finance.advancedExplorerHint')}</p>
        <div className="mt-3">
          {tenantId ? <DataExplorer entity="finance_charges" embed /> : null}
        </div>
      </details>
      {!tenantId && !tenantLoading ? (
        <InlineAlert tone="info" className="mb-6">
          {t('app.errors.needTenant')}
        </InlineAlert>
      ) : null}
      {error ? (
        <InlineAlert tone="error" className="mb-6">
          {error}
        </InlineAlert>
      ) : null}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('pages.finance.totalCharged')}
          value={summary?.totals.totalCharged ?? '0.00'}
          helper={t('pages.finance.totalChargedHint')}
        />
        <StatCard
          label={t('pages.finance.totalCollected')}
          value={summary?.totals.totalCollected ?? '0.00'}
          helper={t('pages.finance.totalCollectedHint')}
        />
        <StatCard
          label={t('pages.finance.totalOutstanding')}
          value={summary?.totals.totalOutstanding ?? '0.00'}
          helper={t('pages.finance.totalOutstandingHint')}
        />
        <StatCard
          label={t('pages.finance.totalOverdue')}
          value={summary?.totals.totalOverdue ?? '0.00'}
          helper={t('pages.finance.totalOverdueHint')}
          tone="danger"
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Link
              to="/app/finance/charge-items"
              className="rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm transition hover:border-amateur-accent/40"
            >
              <h2 className="font-display text-lg font-semibold text-amateur-ink">
                {t('pages.finance.chargeItemsLink')}
              </h2>
              <p className="mt-2 text-sm text-amateur-muted">{t('pages.chargeItems.subtitle')}</p>
            </Link>
            <Link
              to="/app/finance/athlete-charges"
              className="rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm transition hover:border-amateur-accent/40"
            >
              <h2 className="font-display text-lg font-semibold text-amateur-ink">
                {t('pages.finance.athleteChargesLink')}
              </h2>
              <p className="mt-2 text-sm text-amateur-muted">{t('pages.athleteCharges.subtitle')}</p>
            </Link>
            <Link
              to="/app/private-lessons"
              className="rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm transition hover:border-amateur-accent/40"
            >
              <h2 className="font-display text-lg font-semibold text-amateur-ink">
                {t('pages.privateLessons.title')}
              </h2>
              <p className="mt-2 text-sm text-amateur-muted">{t('pages.privateLessons.financeHint')}</p>
            </Link>
            <Link
              to="/app/communications"
              className="rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm transition hover:border-amateur-accent/40"
            >
              <h2 className="font-display text-lg font-semibold text-amateur-ink">
                {t('pages.communications.title')}
              </h2>
              <p className="mt-2 text-sm text-amateur-muted">{t('pages.communications.financeHint')}</p>
            </Link>
          </div>
          <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-amateur-ink">
                  {t('pages.finance.priorityCollections')}
                </h2>
                <p className="mt-1 text-sm text-amateur-muted">{t('pages.finance.priorityCollectionsHint')}</p>
              </div>
              <Link to="/app/finance/athlete-charges" className="text-sm font-semibold text-amateur-accent hover:underline">
                {t('pages.athleteCharges.viewAll')} →
              </Link>
            </div>
            {loading && !summary ? (
              <p className="mt-4 text-sm text-amateur-muted">{t('app.states.loading')}</p>
            ) : summary && summary.athletes.length > 0 ? (
              <ul className="mt-4 divide-y divide-amateur-border">
                {summary.athletes.slice(0, 5).map((entry) => (
                  <li key={entry.athlete.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-medium text-amateur-ink">
                        {entry.athlete.preferredName || `${entry.athlete.firstName} ${entry.athlete.lastName}`}
                      </p>
                      <p className="text-xs text-amateur-muted">
                        {t('pages.finance.outstandingAmount', { amount: entry.totalOutstanding.toFixed(2) })}
                        {entry.overdueCount > 0 ? ` · ${t('pages.finance.overdueCount', { count: entry.overdueCount })}` : ''}
                      </p>
                    </div>
                    <Link
                      to={`/app/athletes/${entry.athlete.id}`}
                      className="text-sm font-semibold text-amateur-accent hover:underline"
                    >
                      {t('pages.athleteCharges.openAthlete')}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-amateur-muted">{t('pages.finance.noPriorityCollections')}</p>
            )}
          </section>
          <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-amateur-ink">
                  {t('pages.finance.privateLessonCollections')}
                </h2>
                <p className="mt-1 text-sm text-amateur-muted">{t('pages.finance.privateLessonCollectionsHint')}</p>
              </div>
              <Link to="/app/private-lessons" className="text-sm font-semibold text-amateur-accent hover:underline">
                {t('pages.privateLessons.openBoard')} →
              </Link>
            </div>
            {summary?.privateLessons?.length ? (
              <ul className="mt-4 divide-y divide-amateur-border">
                {summary.privateLessons.slice(0, 5).map((lesson) => (
                  <li key={lesson.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-medium text-amateur-ink">
                        {lesson.athlete ? getPersonName(lesson.athlete) : t('pages.athleteCharges.openAthlete')}
                      </p>
                      <p className="text-xs text-amateur-muted">
                        {new Date(lesson.scheduledStart).toLocaleString(i18n.language)} ·{' '}
                        {getLessonStatusLabel(t, lesson.status)}
                      </p>
                    </div>
                    <Link
                      to={`/app/private-lessons?athleteId=${lesson.athleteId}`}
                      className="text-sm font-semibold text-amateur-accent hover:underline"
                    >
                      {t('pages.privateLessons.openBoard')}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-amateur-muted">{t('pages.finance.noPrivateLessonCollections')}</p>
            )}
          </section>
        </div>
        <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm">
          <p className="text-sm font-semibold text-amateur-accent">{t('pages.finance.hubChecklistTitle')}</p>
          <ul className="mt-4 space-y-3 text-sm text-amateur-muted">
            {(
              [
                'pages.finance.hubChecklist1',
                'pages.finance.hubChecklist2',
                'pages.finance.hubChecklist3',
              ] as const
            ).map((key) => (
              <li key={key} className="flex gap-3">
                <span className="mt-1 text-amateur-accent">•</span>
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-amateur-muted">{t('pages.finance.hubBody')}</p>
          <div className="mt-6 rounded-xl border border-amateur-border bg-amateur-canvas px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
              {t('pages.finance.recentCollections')}
            </p>
            <p className="mt-2 text-sm text-amateur-ink">
              {summary?.recentPayments.length
                ? t('pages.finance.recentCollectionsCount', { count: summary.recentPayments.length })
                : t('pages.finance.noCollectionsYet')}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
