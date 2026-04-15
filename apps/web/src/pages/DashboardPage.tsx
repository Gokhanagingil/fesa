import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { InlineAlert } from '../components/ui/InlineAlert';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { apiGet } from '../lib/api';
import { getLessonStatusLabel, getPersonName } from '../lib/display';
import type { Coach, DashboardSummary, Payment, PrivateLesson } from '../lib/domain-types';
import { useTenant } from '../lib/tenant-hooks';

export function DashboardPage() {
  const { t } = useTranslation();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [privateLessons, setPrivateLessons] = useState<PrivateLesson[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const [dashboard, guardians, coachRes, privateLessonRes] = await Promise.all([
        apiGet<DashboardSummary>('/api/finance/dashboard-summary'),
        apiGet<{ total: number }>('/api/guardians?limit=1'),
        apiGet<{ items: Coach[] }>('/api/coaches?limit=50&isActive=true'),
        apiGet<{ items: PrivateLesson[] }>('/api/private-lessons?limit=5'),
      ]);
      setSummary({
        ...dashboard,
        stats: {
          ...dashboard.stats,
          guardians: guardians.total,
        },
      });
      setCoaches(coachRes.items);
      setPrivateLessons(privateLessonRes.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const attendanceCards = useMemo(
    () => [
      { key: 'present', label: t('app.enums.attendanceStatus.present'), value: summary?.attendance.present ?? 0 },
      { key: 'late', label: t('app.enums.attendanceStatus.late'), value: summary?.attendance.late ?? 0 },
      { key: 'excused', label: t('app.enums.attendanceStatus.excused'), value: summary?.attendance.excused ?? 0 },
      { key: 'absent', label: t('app.enums.attendanceStatus.absent'), value: summary?.attendance.absent ?? 0 },
    ],
    [summary, t],
  );

  const statCards = [
    {
      key: 'athletes',
      label: t('pages.dashboard.stats.athletes'),
      value: summary?.stats.athletes ?? 0,
      href: '/app/athletes',
    },
    {
      key: 'guardians',
      label: t('pages.dashboard.stats.guardians'),
      value: summary?.stats.guardians ?? 0,
      href: '/app/guardians',
    },
    {
      key: 'sessions',
      label: t('pages.dashboard.stats.upcomingSessions'),
      value: summary?.stats.upcomingSessions ?? 0,
      href: '/app/training',
    },
    {
      key: 'overdue',
      label: t('pages.dashboard.stats.overdueTotal'),
      value: summary?.stats.overdueTotal ?? '0.00',
      href: '/app/finance/athlete-charges?status=pending',
    },
  ];

  function renderPayment(payment: Payment) {
    return (
      <li key={payment.id} className="flex items-center justify-between gap-3 py-3">
        <div>
          <p className="font-medium text-amateur-ink">
            {payment.athlete
              ? `${payment.athlete.firstName} ${payment.athlete.lastName}`
              : t('pages.athleteCharges.openAthlete')}
          </p>
          <p className="text-xs text-amateur-muted">
            {[payment.method, payment.reference].filter(Boolean).join(' · ') || t('pages.dashboard.recentCollectionsHint')}
          </p>
        </div>
        <span className="text-sm font-semibold text-amateur-accent">{payment.currency} {payment.amount}</span>
      </li>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('pages.dashboard.title')}
        subtitle={t('pages.dashboard.subtitle')}
        actions={
          <Link to="/app/reports">
            <div className="rounded-xl border border-amateur-border bg-amateur-surface px-4 py-3 text-sm font-semibold text-amateur-accent shadow-sm">
              {t('pages.dashboard.openCommandCenter')}
            </div>
          </Link>
        }
      />
      {!tenantId && !tenantLoading ? <InlineAlert tone="info">{t('app.errors.needTenant')}</InlineAlert> : null}
      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <Link
            key={card.key}
            to={card.href}
            className="transition hover:translate-y-[-1px]"
          >
            <StatCard
              label={card.label}
              value={loading && !summary ? '…' : card.value}
              tone={card.key === 'overdue' ? 'danger' : 'default'}
            />
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-amateur-ink">
                {t('pages.dashboard.commandCenterTitle')}
              </h2>
              <p className="mt-1 text-sm text-amateur-muted">{t('pages.dashboard.commandCenterHint')}</p>
            </div>
            <Link to="/app/reports" className="text-sm font-semibold text-amateur-accent hover:underline">
              {t('pages.dashboard.openCommandCenter')}
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {attendanceCards.map((card) => (
              <StatCard key={card.key} label={card.label} value={loading && !summary ? '…' : card.value} compact />
            ))}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-amateur-border bg-amateur-canvas px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
                {t('pages.dashboard.collectionsTitle')}
              </p>
              <dl className="mt-3 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-amateur-muted">{t('pages.dashboard.stats.collectedTotal')}</dt>
                  <dd className="font-semibold text-amateur-ink">{summary?.stats.collectedTotal ?? '0.00'}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-amateur-muted">{t('pages.dashboard.stats.outstandingTotal')}</dt>
                  <dd className="font-semibold text-amateur-ink">{summary?.stats.outstandingTotal ?? '0.00'}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-amateur-muted">{t('pages.dashboard.stats.overdueTotal')}</dt>
                  <dd className="font-semibold text-red-700">{summary?.stats.overdueTotal ?? '0.00'}</dd>
                </div>
              </dl>
            </div>
            <div className="rounded-xl border border-amateur-border bg-amateur-canvas px-4 py-4">
              <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
                {t('pages.dashboard.upcomingByGroupTitle')}
              </p>
              <ul className="mt-3 space-y-3 text-sm">
                {(summary?.upcomingByGroup ?? []).slice(0, 4).map((row) => (
                  <li key={row.name} className="flex items-center justify-between gap-3">
                    <span className="text-amateur-muted">{row.name ?? t('pages.training.unknownGroup')}</span>
                    <span className="font-semibold text-amateur-ink">{row.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-amateur-ink">
                {t('pages.dashboard.recentCollectionsTitle')}
              </h2>
              <p className="mt-1 text-sm text-amateur-muted">{t('pages.dashboard.recentCollectionsHint')}</p>
            </div>
            <Link to="/app/finance" className="text-sm font-semibold text-amateur-accent hover:underline">
              {t('pages.dashboard.cardFinance')}
            </Link>
          </div>
          {!summary?.recentPayments?.length ? (
            <div className="mt-4 rounded-xl border border-dashed border-amateur-border bg-amateur-canvas/60 px-4 py-6 text-sm text-amateur-muted">
              {t('pages.dashboard.noRecentCollections')}
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-amateur-border">
              {summary.recentPayments.slice(0, 5).map(renderPayment)}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-amateur-ink">
                {t('pages.dashboard.coachesTitle')}
              </h2>
              <p className="mt-1 text-sm text-amateur-muted">{t('pages.dashboard.coachesHint')}</p>
            </div>
            <Link to="/app/coaches" className="text-sm font-semibold text-amateur-accent hover:underline">
              {t('app.nav.coaches')}
            </Link>
          </div>
          {coaches.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-amateur-border bg-amateur-canvas/60 px-4 py-6 text-sm text-amateur-muted">
              {t('pages.coaches.empty')}
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-amateur-border">
              {coaches.slice(0, 4).map((coach) => (
                <li key={coach.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium text-amateur-ink">{getPersonName(coach)}</p>
                    <p className="text-xs text-amateur-muted">
                      {coach.sportBranch?.name ?? '—'}
                      {coach.specialties ? ` · ${coach.specialties}` : ''}
                    </p>
                  </div>
                  <span className="text-xs text-amateur-muted">{coach.isActive ? t('pages.coaches.activeState') : t('pages.coaches.inactiveState')}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-amateur-ink">
                {t('pages.dashboard.privateLessonsTitle')}
              </h2>
              <p className="mt-1 text-sm text-amateur-muted">{t('pages.dashboard.privateLessonsHint')}</p>
            </div>
            <Link to="/app/private-lessons" className="text-sm font-semibold text-amateur-accent hover:underline">
              {t('app.nav.privateLessons')}
            </Link>
          </div>
          {privateLessons.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-amateur-border bg-amateur-canvas/60 px-4 py-6 text-sm text-amateur-muted">
              {t('pages.privateLessons.empty')}
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-amateur-border">
              {privateLessons.map((lesson) => (
                <li key={lesson.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium text-amateur-ink">{lesson.athlete ? getPersonName(lesson.athlete) : '—'}</p>
                    <p className="text-xs text-amateur-muted">
                      {lesson.coach ? getPersonName(lesson.coach) : '—'} · {lesson.focus || t('pages.privateLessons.focus')}
                    </p>
                  </div>
                  <span className="text-xs text-amateur-muted">{getLessonStatusLabel(t, lesson.status)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Link
          to="/app/athletes"
          className="rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm transition hover:border-amateur-accent/40"
        >
          <p className="text-sm font-semibold text-amateur-accent">{t('pages.dashboard.cardPeople')}</p>
          <p className="mt-2 text-sm text-amateur-muted">{t('pages.dashboard.cardPeopleBody')}</p>
        </Link>
        <Link
          to="/app/training"
          className="rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm transition hover:border-amateur-accent/40"
        >
          <p className="text-sm font-semibold text-amateur-accent">{t('pages.dashboard.cardOps')}</p>
          <p className="mt-2 text-sm text-amateur-muted">{t('pages.dashboard.cardOpsBody')}</p>
        </Link>
        <Link
          to="/app/finance"
          className="rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm transition hover:border-amateur-accent/40"
        >
          <p className="text-sm font-semibold text-amateur-accent">{t('pages.dashboard.cardFinance')}</p>
          <p className="mt-2 text-sm text-amateur-muted">{t('pages.dashboard.cardFinanceBody')}</p>
        </Link>
      </div>
    </div>
  );
}
