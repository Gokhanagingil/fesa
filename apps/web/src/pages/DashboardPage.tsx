import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { InlineAlert } from '../components/ui/InlineAlert';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { useAuth } from '../lib/auth-context';
import { apiGet } from '../lib/api';
import {
  getActionCenterItemSummary,
  getActionCenterUrgencyLabel,
  getActionCenterUrgencyTone,
  getLessonStatusLabel,
  getPersonName,
} from '../lib/display';
import type { Coach, CommandCenterResponse, Payment, PrivateLesson } from '../lib/domain-types';
import type { ClubOverviewResponse, PlatformOverviewResponse } from '../lib/overview-types';
import { useTenant } from '../lib/tenant-hooks';

export function DashboardPage() {
  const { t } = useTranslation();
  const { canAccessCrossTenant } = useAuth();
  const { tenantId, loading: tenantLoading, tenants, setTenantId } = useTenant();
  const [summary, setSummary] = useState<CommandCenterResponse | null>(null);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [privateLessons, setPrivateLessons] = useState<PrivateLesson[]>([]);
  const [clubOverview, setClubOverview] = useState<ClubOverviewResponse | null>(null);
  const [platformOverview, setPlatformOverview] = useState<PlatformOverviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const [dashboard, guardians, coachRes, privateLessonRes, currentClubOverview, currentPlatformOverview] =
        await Promise.all([
        apiGet<CommandCenterResponse>('/api/reporting/command-center'),
        apiGet<{ total: number }>('/api/guardians?limit=1'),
        apiGet<{ items: Coach[] }>('/api/coaches?limit=50&isActive=true'),
        apiGet<{ items: PrivateLesson[] }>('/api/private-lessons?limit=5'),
        tenantId
          ? apiGet<ClubOverviewResponse>('/api/auth/club-overview').catch(() => null)
          : Promise.resolve(null),
        canAccessCrossTenant
          ? apiGet<PlatformOverviewResponse>('/api/auth/platform-overview').catch(() => null)
          : Promise.resolve(null),
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
      setClubOverview(currentClubOverview);
      setPlatformOverview(currentPlatformOverview);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [canAccessCrossTenant, t, tenantId]);

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

  const activeTenantName = useMemo(
    () => tenants.find((tenant) => tenant.id === tenantId)?.name ?? null,
    [tenantId, tenants],
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
      href: '/app/finance/athlete-charges?overdueOnly=true',
    },
    {
      key: 'follow-up',
      label: t('pages.dashboard.stats.familyFollowUp'),
      value: summary?.familyWorkflow?.pendingFamilyAction ?? 0,
      href: '/app/communications?needsFollowUp=true',
    },
    {
      key: 'action-center',
      label: t('pages.dashboard.stats.actionCenterUnread'),
      value: summary?.actionCenter?.counts.unread ?? 0,
      href: '/app/action-center',
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
      <div className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <section className="rounded-3xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amateur-accent">
                {canAccessCrossTenant
                  ? t('pages.dashboard.context.modePlatform')
                  : t('pages.dashboard.context.modeClub')}
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-amateur-ink">
                {activeTenantName ?? t('pages.dashboard.context.noClub')}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-amateur-muted">
                {canAccessCrossTenant
                  ? t('pages.dashboard.context.platformBody', {
                      count: platformOverview?.total ?? tenants.length,
                    })
                  : t('pages.dashboard.context.clubBody')}
              </p>
            </div>
            <div className="rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-3 text-sm">
              <p className="font-medium text-amateur-ink">
                {t('pages.dashboard.context.currentClub')}
              </p>
              <p className="mt-1 text-amateur-muted">
                {activeTenantName ?? t('pages.dashboard.context.noClub')}
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label={t('pages.dashboard.context.availableClubs')}
              value={platformOverview?.total ?? tenants.length}
              compact
            />
            <StatCard
              label={t('pages.dashboard.context.visibleAthletes')}
              value={clubOverview?.counts.athletes ?? summary?.stats.athletes ?? 0}
              compact
            />
            <StatCard
              label={t('pages.dashboard.context.visibleGroups')}
              value={clubOverview?.counts.groups ?? 0}
              compact
            />
          </div>
          <p className="mt-4 text-sm text-amateur-muted">
            {canAccessCrossTenant
              ? t('pages.dashboard.context.switchHint')
              : t('pages.dashboard.context.clubReadyHint')}
          </p>
        </section>

        <section className="rounded-3xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-amateur-ink">
                {t('pages.dashboard.context.snapshotTitle')}
              </h2>
              <p className="mt-1 text-sm text-amateur-muted">
                {t('pages.dashboard.context.snapshotHint')}
              </p>
            </div>
            <Link to="/app/settings" className="text-sm font-semibold text-amateur-accent hover:underline">
              {t('app.nav.settings')}
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <StatCard
              label={t('pages.dashboard.stats.athletes')}
              value={clubOverview?.counts.athletes ?? summary?.stats.athletes ?? 0}
              compact
            />
            <StatCard
              label={t('pages.dashboard.stats.guardians')}
              value={clubOverview?.counts.guardians ?? summary?.stats.guardians ?? 0}
              compact
            />
            <StatCard
              label={t('pages.dashboard.context.portalAccess')}
              value={clubOverview?.counts.portalAccess ?? 0}
              compact
            />
            <StatCard
              label={t('pages.dashboard.context.coaches')}
              value={clubOverview?.counts.coaches ?? coaches.length}
              compact
            />
            <StatCard
              label={t('pages.dashboard.context.groups')}
              value={clubOverview?.counts.groups ?? 0}
              compact
            />
            <StatCard
              label={t('pages.dashboard.context.teams')}
              value={clubOverview?.counts.teams ?? 0}
              compact
            />
          </div>
        </section>
      </div>

      {canAccessCrossTenant && (platformOverview?.items.length ?? 0) > 0 ? (
        <section className="mb-6 rounded-3xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-amateur-ink">
                {t('pages.dashboard.context.clubCatalogTitle')}
              </h2>
              <p className="mt-1 text-sm text-amateur-muted">
                {t('pages.dashboard.context.clubCatalogHint')}
              </p>
            </div>
            <Link to="/app/settings" className="text-sm font-semibold text-amateur-accent hover:underline">
              {t('app.nav.settings')}
            </Link>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {platformOverview?.items.map((club) => {
              const active = club.id === tenantId;
              return (
                <article
                  key={club.id}
                  className={`rounded-2xl border px-4 py-4 shadow-sm transition ${
                    active
                      ? 'border-amateur-accent/40 bg-amateur-accent-soft/40'
                      : 'border-amateur-border bg-amateur-canvas'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-base font-semibold text-amateur-ink">
                        {club.name}
                      </h3>
                      <p className="mt-1 text-xs text-amateur-muted">{club.slug}</p>
                    </div>
                    <StatusBadge tone={active ? 'success' : 'default'}>
                      {active
                        ? t('pages.dashboard.context.currentClubBadge')
                        : t('pages.dashboard.context.availableClubBadge')}
                    </StatusBadge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl border border-amateur-border/70 bg-amateur-surface px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-amateur-muted">
                        {t('pages.dashboard.stats.athletes')}
                      </p>
                      <p className="mt-1 font-semibold text-amateur-ink">{club.counts.athletes}</p>
                    </div>
                    <div className="rounded-xl border border-amateur-border/70 bg-amateur-surface px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-amateur-muted">
                        {t('pages.dashboard.stats.guardians')}
                      </p>
                      <p className="mt-1 font-semibold text-amateur-ink">{club.counts.guardians}</p>
                    </div>
                    <div className="rounded-xl border border-amateur-border/70 bg-amateur-surface px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-amateur-muted">
                        {t('pages.dashboard.context.groups')}
                      </p>
                      <p className="mt-1 font-semibold text-amateur-ink">{club.counts.groups}</p>
                    </div>
                    <div className="rounded-xl border border-amateur-border/70 bg-amateur-surface px-3 py-2">
                      <p className="text-xs uppercase tracking-wide text-amateur-muted">
                        {t('pages.dashboard.context.teams')}
                      </p>
                      <p className="mt-1 font-semibold text-amateur-ink">{club.counts.teams}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <p className="text-xs text-amateur-muted">
                      {t('pages.dashboard.context.coachCount', { count: club.counts.coaches })}
                    </p>
                    <Button
                      type="button"
                      variant={active ? 'ghost' : 'primary'}
                      onClick={() => setTenantId(club.id)}
                    >
                      {active
                        ? t('pages.dashboard.context.currentClubAction')
                        : t('pages.dashboard.context.switchClubAction')}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {statCards.map((card) => (
          <Link
            key={card.key}
            to={card.href}
            className="transition hover:translate-y-[-1px]"
          >
            <StatCard
              label={card.label}
              value={loading && !summary ? '…' : card.value}
              tone={
                card.key === 'overdue' || card.key === 'follow-up' || card.key === 'action-center'
                  ? 'danger'
                  : 'default'
              }
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
          <div className="mt-4 rounded-xl border border-amateur-border bg-amateur-canvas px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
                  {t('pages.dashboard.familyWorkflowTitle')}
                </p>
                <p className="mt-1 text-sm text-amateur-muted">{t('pages.dashboard.familyWorkflowHint')}</p>
              </div>
              <Link to="/app/communications?needsFollowUp=true" className="text-sm font-semibold text-amateur-accent hover:underline">
                {t('pages.communications.openBuilder')}
              </Link>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <StatCard
                label={t('pages.dashboard.familyWorkflowPending')}
                value={summary?.familyWorkflow?.pendingFamilyAction ?? 0}
                compact
                tone={(summary?.familyWorkflow?.pendingFamilyAction ?? 0) > 0 ? 'danger' : 'default'}
              />
              <StatCard
                label={t('pages.dashboard.familyWorkflowReview')}
                value={summary?.familyWorkflow?.awaitingStaffReview ?? 0}
                compact
                tone={(summary?.familyWorkflow?.awaitingStaffReview ?? 0) > 0 ? 'danger' : 'default'}
              />
              <StatCard
                label={t('pages.dashboard.familyWorkflowIncomplete')}
                value={summary?.familyWorkflow?.incompleteAthletes ?? 0}
                compact
              />
              <StatCard
                label={t('pages.dashboard.familyWorkflowCompleted')}
                value={summary?.familyWorkflow?.completed ?? 0}
                compact
              />
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-amateur-border bg-amateur-canvas px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
                  {t('pages.dashboard.actionCenterTitle')}
                </p>
                <p className="mt-1 text-sm text-amateur-muted">{t('pages.dashboard.actionCenterHint')}</p>
              </div>
              <Link to="/app/action-center" className="text-sm font-semibold text-amateur-accent hover:underline">
                {t('pages.dashboard.openActionCenter')}
              </Link>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <StatCard
                label={t('pages.dashboard.actionCenterUnread')}
                value={summary?.actionCenter?.counts.unread ?? 0}
                compact
                tone={(summary?.actionCenter?.counts.unread ?? 0) > 0 ? 'danger' : 'default'}
              />
              <StatCard
                label={t('pages.dashboard.actionCenterOverdue')}
                value={summary?.actionCenter?.counts.overdue ?? 0}
                compact
                tone={(summary?.actionCenter?.counts.overdue ?? 0) > 0 ? 'danger' : 'default'}
              />
              <StatCard
                label={t('pages.dashboard.actionCenterToday')}
                value={summary?.actionCenter?.counts.today ?? 0}
                compact
                tone={(summary?.actionCenter?.counts.today ?? 0) > 0 ? 'danger' : 'default'}
              />
              <StatCard
                label={t('pages.dashboard.actionCenterFinance')}
                value={summary?.actionCenter?.counts.byCategory.finance ?? 0}
                compact
              />
            </div>
            {(summary?.actionCenter?.items ?? []).length > 0 ? (
              <div className="mt-4 space-y-3">
                {summary?.actionCenter?.items.map((item) => (
                  <Link
                    key={item.itemKey}
                    to={item.deepLink}
                    className="block rounded-xl border border-amateur-border bg-amateur-surface px-4 py-3 transition hover:border-amateur-accent/30"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge tone={getActionCenterUrgencyTone(item.urgency)}>
                            {getActionCenterUrgencyLabel(t, item.urgency)}
                          </StatusBadge>
                          {!item.read ? (
                            <StatusBadge tone="warning">{t('pages.dashboard.actionCenterNeedsReview')}</StatusBadge>
                          ) : null}
                        </div>
                        <p className="mt-2 font-medium text-amateur-ink">{item.subjectName}</p>
                        <p className="mt-1 text-xs text-amateur-muted">
                          {getActionCenterItemSummary(t, item)}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-amateur-border bg-amateur-surface/60 px-4 py-5 text-sm text-amateur-muted">
                {t('pages.dashboard.actionCenterEmpty')}
              </div>
            )}
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
