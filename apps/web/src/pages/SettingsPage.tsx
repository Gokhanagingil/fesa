import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { InlineAlert } from '../components/ui/InlineAlert';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { CommunicationDeliveryReadinessPanel } from '../components/communication/CommunicationDeliveryReadinessPanel';
import { BrandAdminPanel } from '../components/branding/BrandAdminPanel';
import { TenantLicenseSummary } from '../components/licensing/TenantLicenseSummary';
import { useAuth } from '../lib/auth-context';
import { apiGet } from '../lib/api';
import { useTenant } from '../lib/tenant-hooks';
import type { ClubOverviewResponse, PlatformOverviewResponse } from '../lib/overview-types';

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { session, staffUser } = useAuth();
  const { tenants, tenantId, setTenantId } = useTenant();
  const [searchParams] = useSearchParams();
  const activeTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === tenantId) ?? null,
    [tenantId, tenants],
  );
  const accessibleTenants = session?.accessibleTenants ?? [];
  const platformAdmin = staffUser?.platformRole === 'global_admin';
  const [platformOverview, setPlatformOverview] = useState<PlatformOverviewResponse | null>(null);
  const [clubOverview, setClubOverview] = useState<ClubOverviewResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  // The staff Header links to `/app/settings?section=platform|club` and we
  // also accept `brand` and `delivery` as deep-link anchors. Previously
  // the query string was ignored, so the link looked navigational but did
  // not move the user anywhere. We honor it on mount/change by scrolling
  // the matching section into view; we do not change visibility, so the
  // page still behaves as a single calm settings surface.
  useEffect(() => {
    const section = searchParams.get('section');
    if (!section) return;
    const id = `settings-section-${section}`;
    const target = document.getElementById(id);
    if (!target) return;
    const timer = window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [searchParams]);

  const loadOverview = useCallback(async () => {
    if (!session) {
      setPlatformOverview(null);
      setClubOverview(null);
      return;
    }

    setLoadingOverview(true);
    setOverviewError(null);
    try {
      const [nextClubOverview, nextPlatformOverview] = await Promise.all([
        tenantId
          ? apiGet<ClubOverviewResponse>('/api/auth/club-overview').catch(() => null)
          : Promise.resolve(null),
        platformAdmin
          ? apiGet<PlatformOverviewResponse>('/api/auth/platform-overview').catch(() => null)
          : Promise.resolve(null),
      ]);
      setClubOverview(nextClubOverview);
      setPlatformOverview(nextPlatformOverview);
    } catch (error) {
      setOverviewError(error instanceof Error ? error.message : t('app.errors.loadFailed'));
    } finally {
      setLoadingOverview(false);
    }
  }, [platformAdmin, session, t, tenantId]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const platformActionTotals = useMemo(() => {
    const items = platformOverview?.items ?? [];
    return items.reduce(
      (acc, item) => ({
        unread: acc.unread + item.counts.unreadActions,
        overdue: acc.overdue + item.counts.overdueActions,
        followUp: acc.followUp + item.counts.followUpActions,
      }),
      { unread: 0, overdue: 0, followUp: 0 },
    );
  }, [platformOverview]);

  return (
    <div>
      <PageHeader title={t('pages.settings.title')} subtitle={t('pages.settings.subtitle')} />
      {overviewError ? (
        <InlineAlert tone="error" className="mb-4">
          {overviewError}
        </InlineAlert>
      ) : null}
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-3">
          <StatCard
            label={t('pages.settings.summary.accessibleClubs')}
            value={accessibleTenants.length}
          />
          <StatCard
            label={t('pages.settings.summary.activeClub')}
            value={activeTenant?.name ?? t('pages.settings.summary.noClub')}
          />
          <StatCard
            label={t('pages.settings.summary.role')}
            value={
              platformAdmin
                ? t('pages.settings.roles.globalAdmin')
                : clubOverview?.accessRole && clubOverview.accessRole !== 'global_admin'
                  ? t(`pages.settings.roles.${clubOverview.accessRole}`)
                  : t('pages.settings.summary.noRole')
            }
          />
        </section>

        {platformAdmin ? (
          <section className="grid gap-4 md:grid-cols-3">
            <StatCard
              label={t('pages.settings.actionSummary.unread')}
              value={platformActionTotals.unread}
              tone={platformActionTotals.unread > 0 ? 'danger' : 'default'}
            />
            <StatCard
              label={t('pages.settings.actionSummary.overdue')}
              value={platformActionTotals.overdue}
              tone={platformActionTotals.overdue > 0 ? 'danger' : 'default'}
            />
            <StatCard
              label={t('pages.settings.actionSummary.followUp')}
              value={platformActionTotals.followUp}
              tone={platformActionTotals.followUp > 0 ? 'danger' : 'default'}
            />
          </section>
        ) : null}

        <section
          id="settings-section-club"
          className="scroll-mt-24 rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-amateur-ink">
                {platformAdmin ? t('pages.settings.platformAdminTitle') : t('pages.settings.clubAdminTitle')}
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-amateur-muted">
                {platformAdmin ? t('pages.settings.platformAdminHint') : t('pages.settings.clubAdminHint')}
              </p>
            </div>
            {activeTenant ? (
              <div className="rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-3 text-sm">
                <p className="font-medium text-amateur-ink">{t('pages.settings.currentClub')}</p>
                <p className="mt-1 text-amateur-muted">{activeTenant.name}</p>
              </div>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
              <h3 className="font-display text-base font-semibold text-amateur-ink">
                {t('pages.settings.accessTitle')}
              </h3>
              <div className="mt-4 space-y-3">
                {accessibleTenants.length > 0 ? (
                  accessibleTenants.map((tenant) => {
                    const active = tenant.id === tenantId;
                    return (
                      <article
                        key={tenant.id}
                        className={`rounded-xl border px-4 py-4 text-sm transition ${
                          active
                            ? 'border-amateur-accent/40 bg-amateur-accent-soft/40'
                            : 'border-amateur-border bg-amateur-surface'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-amateur-ink">{tenant.name}</p>
                            <p className="mt-1 text-xs text-amateur-muted">{tenant.slug}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <StatusBadge tone={active ? 'success' : 'default'}>
                              {active
                                ? t('pages.settings.currentContextBadge')
                                : t('pages.settings.availableContextBadge')}
                            </StatusBadge>
                            <StatusBadge tone={tenant.isDefault ? 'info' : 'default'}>
                              {tenant.isDefault
                                ? t('pages.settings.defaultMembership')
                                : t('pages.settings.secondaryMembership')}
                            </StatusBadge>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <p className="text-amateur-muted">
                            {tenant.role
                              ? t(`pages.settings.roles.${tenant.role}`)
                              : t('pages.settings.roles.globalAdmin')}
                          </p>
                          <Button
                            type="button"
                            variant={active ? 'ghost' : 'primary'}
                            onClick={() => setTenantId(tenant.id)}
                          >
                            {active
                              ? t('pages.settings.currentContextAction')
                              : t('pages.settings.switchContextAction')}
                          </Button>
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <InlineAlert tone="info" className="mt-2">
                    {t('pages.settings.noMemberships')}
                  </InlineAlert>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
              <h3 className="font-display text-base font-semibold text-amateur-ink">
                {t('pages.settings.snapshotTitle')}
              </h3>
              <p className="mt-1 text-sm text-amateur-muted">
                {t('pages.settings.snapshotHint')}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <StatCard
                  label={t('pages.settings.snapshotAthletes')}
                  value={clubOverview?.counts.athletes ?? '—'}
                  compact
                />
                <StatCard
                  label={t('pages.settings.snapshotGuardians')}
                  value={clubOverview?.counts.guardians ?? '—'}
                  compact
                />
                <StatCard
                  label={t('pages.settings.snapshotGroups')}
                  value={clubOverview?.counts.groups ?? '—'}
                  compact
                />
                <StatCard
                  label={t('pages.settings.snapshotTeams')}
                  value={clubOverview?.counts.teams ?? '—'}
                  compact
                />
                <StatCard
                  label={t('pages.settings.snapshotCoaches')}
                  value={clubOverview?.counts.coaches ?? '—'}
                  compact
                />
                <StatCard
                  label={t('pages.settings.snapshotPortal')}
                  value={clubOverview?.counts.portalAccess ?? '—'}
                  compact
                />
                <StatCard
                  label={t('pages.settings.snapshotUnreadActions')}
                  value={platformAdmin && activeTenant ? platformOverview?.items.find((item) => item.id === activeTenant.id)?.counts.unreadActions ?? '—' : '—'}
                  compact
                />
                <StatCard
                  label={t('pages.settings.snapshotOverdueActions')}
                  value={platformAdmin && activeTenant ? platformOverview?.items.find((item) => item.id === activeTenant.id)?.counts.overdueActions ?? '—' : '—'}
                  compact
                />
              </div>
              {loadingOverview ? (
                <p className="mt-4 text-sm text-amateur-muted">{t('app.states.loading')}</p>
              ) : null}
            </div>
          </div>
        </section>

        {platformAdmin && (platformOverview?.items.length ?? 0) > 0 ? (
          <section
            id="settings-section-platform"
            className="scroll-mt-24 rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-amateur-ink">
                  {t('pages.settings.platformOverviewTitle')}
                </h2>
                <p className="mt-1 max-w-3xl text-sm text-amateur-muted">
                  {t('pages.settings.platformOverviewHint')}
                </p>
              </div>
              <StatusBadge tone="info">
                {t('pages.settings.platformOverviewCount', {
                  count: platformOverview?.total ?? 0,
                })}
              </StatusBadge>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {platformOverview?.items.map((item) => {
                const active = item.id === tenantId;
                return (
                  <article
                    key={item.id}
                    className={`rounded-2xl border px-4 py-4 shadow-sm ${
                      active
                        ? 'border-amateur-accent/40 bg-amateur-accent-soft/40'
                        : 'border-amateur-border bg-amateur-canvas'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-base font-semibold text-amateur-ink">
                          {item.name}
                        </h3>
                        <p className="mt-1 text-xs text-amateur-muted">{item.slug}</p>
                      </div>
                      <StatusBadge tone={active ? 'success' : 'default'}>
                        {active
                          ? t('pages.settings.currentContextBadge')
                          : t('pages.settings.availableContextBadge')}
                      </StatusBadge>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <StatCard
                        label={t('pages.settings.snapshotAthletes')}
                        value={item.counts.athletes}
                        compact
                      />
                      <StatCard
                        label={t('pages.settings.snapshotGuardians')}
                        value={item.counts.guardians}
                        compact
                      />
                      <StatCard
                        label={t('pages.settings.snapshotGroups')}
                        value={item.counts.groups}
                        compact
                      />
                      <StatCard
                        label={t('pages.settings.snapshotTeams')}
                        value={item.counts.teams}
                        compact
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <StatusBadge tone={item.counts.overdueActions > 0 ? 'danger' : item.counts.unreadActions > 0 ? 'warning' : 'default'}>
                        {t('pages.settings.platformUnreadActions', { count: item.counts.unreadActions })}
                      </StatusBadge>
                      <StatusBadge tone={item.counts.overdueActions > 0 ? 'danger' : 'default'}>
                        {t('pages.settings.platformOverdueActions', { count: item.counts.overdueActions })}
                      </StatusBadge>
                      <StatusBadge tone={item.counts.followUpActions > 0 ? 'info' : 'default'}>
                        {t('pages.settings.platformFollowUpActions', { count: item.counts.followUpActions })}
                      </StatusBadge>
                    </div>
                    <p className="mt-3 text-xs text-amateur-muted">
                      {t('pages.settings.platformOverviewCoachCount', {
                        count: item.counts.coaches,
                      })}
                    </p>
                    {item.actionCenter.topCategories.length > 0 ? (
                      <p className="mt-2 text-xs text-amateur-muted">
                        {t('pages.settings.platformActionMix', {
                          categories: item.actionCenter.topCategories
                            .map((entry) => `${t(`pages.actionCenter.categories.${entry.category}`)} (${entry.count})`)
                            .join(' · '),
                        })}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-amateur-muted">{t('pages.settings.platformActionMixEmpty')}</p>
                    )}
                    <div className="mt-4">
                      <Button
                        type="button"
                        variant={active ? 'ghost' : 'primary'}
                        onClick={() => setTenantId(item.id)}
                      >
                        {active
                          ? t('pages.settings.currentContextAction')
                          : t('pages.settings.switchContextAction')}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        <div id="settings-section-license" className="scroll-mt-24">
          <TenantLicenseSummary tenantId={tenantId} />
        </div>

        <div id="settings-section-brand" className="scroll-mt-24">
          <BrandAdminPanel tenantId={tenantId} />
        </div>

        <div id="settings-section-delivery" className="scroll-mt-24">
          <CommunicationDeliveryReadinessPanel tenantId={tenantId} languageTag={i18n.language} />
        </div>

        <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm">
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
              <h3 className="font-display text-base font-semibold text-amateur-ink">
                {t('pages.settings.preferencesTitle')}
              </h3>
              <p className="mt-1 text-sm text-amateur-muted">
                {t('pages.settings.preferencesHint')}
              </p>
              <ul className="mt-4 space-y-3 text-sm text-amateur-muted">
                <li className="rounded-xl border border-amateur-border bg-amateur-surface px-4 py-3">
                  {t('pages.settings.localePreference')}
                </li>
                <li className="rounded-xl border border-amateur-border bg-amateur-surface px-4 py-3">
                  {t('pages.settings.notificationsPreference')}
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
              <h3 className="font-display text-base font-semibold text-amateur-ink">
                {t('pages.settings.securityTitle')}
              </h3>
              <p className="mt-1 text-sm text-amateur-muted">
                {t('pages.settings.securityHint')}
              </p>
              <ul className="mt-4 space-y-3 text-sm text-amateur-muted">
                <li className="rounded-xl border border-amateur-border bg-amateur-surface px-4 py-3">
                  {t('pages.settings.securityPointStaff')}
                </li>
                <li className="rounded-xl border border-amateur-border bg-amateur-surface px-4 py-3">
                  {t('pages.settings.securityPointMembership')}
                </li>
                <li className="rounded-xl border border-amateur-border bg-amateur-surface px-4 py-3">
                  {t('pages.settings.securityPointGuardian')}
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
