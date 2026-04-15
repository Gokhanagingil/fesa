import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InlineAlert } from '../components/ui/InlineAlert';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { useAuth } from '../lib/auth-context';
import { apiGet } from '../lib/api';
import { useTenant } from '../lib/tenant-hooks';
import type { ClubOverviewResponse, PlatformOverviewResponse } from '../lib/overview-types';

export function SettingsPage() {
  const { t } = useTranslation();
  const { session, staffUser } = useAuth();
  const { tenants, tenantId, setTenantId } = useTenant();
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

        <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm">
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
              </div>
              {loadingOverview ? (
                <p className="mt-4 text-sm text-amateur-muted">{t('app.states.loading')}</p>
              ) : null}
            </div>
          </div>
        </section>

        {platformAdmin && (platformOverview?.items.length ?? 0) > 0 ? (
          <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm">
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
                    <p className="mt-3 text-xs text-amateur-muted">
                      {t('pages.settings.platformOverviewCoachCount', {
                        count: item.counts.coaches,
                      })}
                    </p>
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
