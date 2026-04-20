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
import { buildStarterLink } from '../lib/report-deep-link';

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

/**
 * Finance Hub — Collections Clarity Pack.
 *
 * The previous hub layout placed five competing equal-weight blocks above the
 * fold (reporting hero, stat row, nav grid, priority collections, lessons
 * follow-up, checklist column). The clarity pack reorders the page so the
 * primary jobs (read totals → look at who needs attention → step into the
 * right action surface) come first, and demotes secondary navigation /
 * reporting deep-links into a calm "more tools" strip below.
 */
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

      {/* 1. Compact summary band — read first, no competing eyebrow text. */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('pages.finance.totalCharged')}
          value={summary?.totals.totalCharged ?? '0.00'}
          helper={t('pages.finance.totalChargedHint')}
          compact
        />
        <StatCard
          label={t('pages.finance.totalCollected')}
          value={summary?.totals.totalCollected ?? '0.00'}
          helper={t('pages.finance.totalCollectedHint')}
          compact
        />
        <StatCard
          label={t('pages.finance.totalOutstanding')}
          value={summary?.totals.totalOutstanding ?? '0.00'}
          helper={t('pages.finance.totalOutstandingHint')}
          compact
        />
        <StatCard
          label={t('pages.finance.totalOverdue')}
          value={summary?.totals.totalOverdue ?? '0.00'}
          helper={t('pages.finance.totalOverdueHint')}
          tone="danger"
          compact
        />
      </div>

      {/* 2. Primary action surface — Athlete Charges is the operational hub. */}
      <section className="mb-6 rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <h2 className="font-display text-lg font-semibold text-amateur-ink">
              {t('pages.finance.athleteChargesLink')}
            </h2>
            <p className="mt-2 text-sm text-amateur-muted">{t('pages.finance.athleteChargesPrimaryHint')}</p>
          </div>
          <Link
            to="/app/finance/athlete-charges"
            className="rounded-xl bg-amateur-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amateur-highlight"
          >
            {t('pages.finance.openAthleteCharges')} →
          </Link>
        </div>
      </section>

      {/* 3. Collections clarity — who needs attention right now. */}
      <section className="mb-6 rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-amateur-ink">
              {t('pages.finance.priorityCollections')}
            </h2>
            <p className="mt-1 text-sm text-amateur-muted">{t('pages.finance.priorityCollectionsHint')}</p>
          </div>
          <Link
            to="/app/finance/athlete-charges"
            className="text-sm font-semibold text-amateur-accent hover:underline"
          >
            {t('pages.athleteCharges.viewAll')} →
          </Link>
        </div>
        {loading && !summary ? (
          <p className="mt-4 text-sm text-amateur-muted">{t('app.states.loading')}</p>
        ) : summary && summary.athletes.length > 0 ? (
          <ul className="mt-4 divide-y divide-amateur-border">
            {summary.athletes.slice(0, 5).map((entry) => (
              <li
                key={entry.athlete.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-amateur-ink">
                    {entry.athlete.preferredName || `${entry.athlete.firstName} ${entry.athlete.lastName}`}
                  </p>
                  <p className="text-xs text-amateur-muted">
                    {t('pages.finance.outstandingAmount', { amount: entry.totalOutstanding.toFixed(2) })}
                    {entry.overdueCount > 0
                      ? ` · ${t('pages.finance.overdueCount', { count: entry.overdueCount })}`
                      : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
                  <Link
                    to={`/app/finance/athlete-charges?athleteId=${entry.athlete.id}`}
                    className="text-amateur-accent hover:underline"
                  >
                    {t('pages.finance.athleteChargesLink')}
                  </Link>
                  <Link
                    to={`/app/communications?athleteIds=${entry.athlete.id}&primaryContactsOnly=true&channel=whatsapp&template=overdue_payment_reminder&source=finance_overdue&sourceKey=priority-${entry.athlete.id}`}
                    className="text-emerald-700 hover:underline"
                  >
                    {t('pages.finance.priorityCollectionsPrepare')}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-amateur-muted">{t('pages.finance.noPriorityCollections')}</p>
        )}
      </section>

      {/* 4. Private lesson follow-up — only surfaces when there is real follow-up to do. */}
      {summary?.privateLessons?.length ? (
        <section className="mb-6 rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-amateur-ink">
                {t('pages.finance.privateLessonCollections')}
              </h2>
              <p className="mt-1 text-sm text-amateur-muted">{t('pages.finance.privateLessonCollectionsHint')}</p>
            </div>
            <Link
              to="/app/private-lessons"
              className="text-sm font-semibold text-amateur-accent hover:underline"
            >
              {t('pages.privateLessons.openBoard')} →
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-amateur-border">
            {summary.privateLessons.slice(0, 5).map((lesson) => (
              <li
                key={lesson.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-amateur-ink">
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
        </section>
      ) : null}

      {/* 5. More finance tools — calm, demoted strip with secondary navigation. */}
      <section className="mb-6 rounded-2xl border border-amateur-border bg-amateur-canvas p-5 shadow-sm">
        <h2 className="font-display text-base font-semibold text-amateur-ink">
          {t('pages.finance.moreToolsTitle')}
        </h2>
        <p className="mt-1 text-sm text-amateur-muted">{t('pages.finance.moreToolsHint')}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Link
            to="/app/finance/charge-items"
            className="rounded-xl border border-amateur-border bg-amateur-surface p-4 transition hover:border-amateur-accent/40"
          >
            <p className="text-sm font-semibold text-amateur-ink">{t('pages.finance.chargeItemsLink')}</p>
            <p className="mt-1 text-xs text-amateur-muted">{t('pages.chargeItems.subtitle')}</p>
          </Link>
          <Link
            to="/app/private-lessons"
            className="rounded-xl border border-amateur-border bg-amateur-surface p-4 transition hover:border-amateur-accent/40"
          >
            <p className="text-sm font-semibold text-amateur-ink">{t('pages.privateLessons.title')}</p>
            <p className="mt-1 text-xs text-amateur-muted">{t('pages.privateLessons.financeHint')}</p>
          </Link>
          <Link
            to="/app/communications?financialState=overdue&primaryContactsOnly=true&channel=whatsapp&template=overdue_payment_reminder&source=finance_overdue"
            className="rounded-xl border border-amateur-border bg-amateur-surface p-4 transition hover:border-amateur-accent/40"
          >
            <p className="text-sm font-semibold text-amateur-ink">{t('pages.communications.title')}</p>
            <p className="mt-1 text-xs text-amateur-muted">{t('pages.communications.financeHint')}</p>
          </Link>
        </div>
        <details className="mt-4 rounded-xl border border-amateur-border bg-amateur-surface p-4">
          <summary className="cursor-pointer text-sm font-semibold text-amateur-ink">
            {t('pages.finance.reportingTitle')}
          </summary>
          <p className="mt-2 text-sm text-amateur-muted">{t('pages.finance.reportingBody')}</p>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <Link
              to={buildStarterLink('finance.overdue')}
              className="rounded-xl border border-amateur-border bg-amateur-canvas p-3 text-sm transition hover:border-amateur-accent/40"
            >
              <p className="font-semibold text-amateur-ink">
                {t('pages.finance.reportingCards.overdueTitle')}
              </p>
              <p className="mt-1 text-xs text-amateur-muted">
                {t('pages.finance.reportingCards.overdueBody')}
              </p>
            </Link>
            <Link
              to={buildStarterLink('finance.outstandingByItem')}
              className="rounded-xl border border-amateur-border bg-amateur-canvas p-3 text-sm transition hover:border-amateur-accent/40"
            >
              <p className="font-semibold text-amateur-ink">
                {t('pages.finance.reportingCards.byItemTitle')}
              </p>
              <p className="mt-1 text-xs text-amateur-muted">
                {t('pages.finance.reportingCards.byItemBody')}
              </p>
            </Link>
            <Link
              to={buildStarterLink('finance.overdueByCategory')}
              className="rounded-xl border border-amateur-border bg-amateur-canvas p-3 text-sm transition hover:border-amateur-accent/40"
            >
              <p className="font-semibold text-amateur-ink">
                {t('pages.finance.reportingCards.byCategoryTitle')}
              </p>
              <p className="mt-1 text-xs text-amateur-muted">
                {t('pages.finance.reportingCards.byCategoryBody')}
              </p>
            </Link>
          </div>
          <Link
            to="/app/reports"
            className="mt-3 inline-flex text-sm font-semibold text-amateur-accent hover:underline"
          >
            {t('pages.finance.reportingOpenHub')} →
          </Link>
        </details>
        <details className="mt-3 rounded-xl border border-amateur-border bg-amateur-surface p-4">
          <summary className="cursor-pointer text-sm font-semibold text-amateur-ink">
            {t('pages.finance.advancedExplorer')}
          </summary>
          <p className="mt-1 text-xs text-amateur-muted">{t('pages.finance.advancedExplorerHint')}</p>
          <div className="mt-3">
            {tenantId ? <DataExplorer entity="finance_charges" embed /> : null}
          </div>
        </details>
      </section>
    </div>
  );
}
