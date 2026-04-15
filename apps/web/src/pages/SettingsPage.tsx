import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InlineAlert } from '../components/ui/InlineAlert';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { useAuth } from '../lib/auth-context';
import { apiGet } from '../lib/api';
import { useTenant } from '../lib/tenant-hooks';

type PlatformOverview = {
  items: Array<{
    id: string;
    name: string;
    slug: string;
    counts: {
      athletes: number;
      guardians: number;
      coaches: number;
      groups: number;
      teams: number;
    };
  }>;
  total: number;
};

export function SettingsPage() {
  const { t } = useTranslation();
  const { session, staffUser } = useAuth();
  const { tenants, tenantId, setTenantId } = useTenant();
  const [platformOverview, setPlatformOverview] = useState<PlatformOverview | null>(null);
  const [platformLoading, setPlatformLoading] = useState(false);
  const [platformError, setPlatformError] = useState<string | null>(null);
  const activeTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === tenantId) ?? null,
    [tenantId, tenants],
  );
  const memberships = useMemo(() => session?.memberships ?? [], [session]);
  const platformAdmin = staffUser?.platformRole === 'global_admin';
  const activeMembership = useMemo(
    () =>
      memberships.find((membership) => membership.tenantId === tenantId) ??
      memberships.find((membership) => membership.isDefault) ??
      memberships[0] ??
      null,
    [memberships, tenantId],
  );

  useEffect(() => {
    if (!platformAdmin) {
      setPlatformOverview(null);
      setPlatformError(null);
      setPlatformLoading(false);
      return;
    }

    let cancelled = false;

    async function loadPlatformOverview() {
      setPlatformLoading(true);
      setPlatformError(null);
      try {
        const next = await apiGet<PlatformOverview>('/api/auth/platform-overview');
        if (!cancelled) {
          setPlatformOverview(next);
        }
      } catch (error) {
        if (!cancelled) {
          setPlatformError(error instanceof Error ? error.message : t('app.errors.loadFailed'));
        }
      } finally {
        if (!cancelled) {
          setPlatformLoading(false);
        }
      }
    }

    void loadPlatformOverview();

    return () => {
      cancelled = true;
    };
  }, [platformAdmin, t]);

  return (
    <div>
      <PageHeader title={t('pages.settings.title')} subtitle={t('pages.settings.subtitle')} />
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-3">
          <StatCard
            label={t('pages.settings.summary.memberships')}
            value={platformAdmin ? t('pages.settings.summary.platformWide') : memberships.length}
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
                : activeMembership
                  ? t(`pages.settings.roles.${activeMembership.role}`)
                  : t('pages.settings.summary.noRole')
            }
          />
        </section>

        {platformAdmin ? (
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
              <div className="rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-3 text-sm">
                <p className="font-medium text-amateur-ink">{t('pages.settings.platformOverviewTotal')}</p>
                <p className="mt-1 text-amateur-muted">{platformOverview?.total ?? tenants.length}</p>
              </div>
            </div>
            {platformError ? <InlineAlert tone="error" className="mt-4">{platformError}</InlineAlert> : null}
            {platformLoading && !platformOverview ? (
              <div className="mt-4 rounded-xl border border-dashed border-amateur-border bg-amateur-canvas/60 px-4 py-5 text-sm text-amateur-muted">
                {t('app.states.loading')}
              </div>
            ) : (
              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {(platformOverview?.items ?? []).map((item) => {
                  const isActive = tenantId === item.id;
                  return (
                    <div key={item.id} className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="font-display text-base font-semibold text-amateur-ink">{item.name}</h3>
                          <p className="mt-1 text-sm text-amateur-muted">{item.slug}</p>
                        </div>
                        <Button
                          type="button"
                          variant={isActive ? 'primary' : 'ghost'}
                          onClick={() => setTenantId(item.id)}
                        >
                          {isActive ? t('pages.settings.platformOverviewActive') : t('pages.settings.platformOverviewSwitch')}
                        </Button>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
                        <StatCard label={t('pages.settings.platformOverviewCounts.athletes')} value={item.counts.athletes} compact />
                        <StatCard label={t('pages.settings.platformOverviewCounts.guardians')} value={item.counts.guardians} compact />
                        <StatCard label={t('pages.settings.platformOverviewCounts.coaches')} value={item.counts.coaches} compact />
                        <StatCard label={t('pages.settings.platformOverviewCounts.groups')} value={item.counts.groups} compact />
                        <StatCard label={t('pages.settings.platformOverviewCounts.teams')} value={item.counts.teams} compact />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-amateur-ink">
                {platformAdmin
                  ? t('pages.settings.platformAdminTitle')
                  : t('pages.settings.clubAdminTitle')}
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-amateur-muted">
                {platformAdmin
                  ? t('pages.settings.platformAdminHint')
                  : t('pages.settings.clubAdminHint')}
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
                {platformAdmin ? (
                  <div className="rounded-xl border border-amateur-border bg-amateur-surface px-4 py-3 text-sm">
                    <p className="font-medium text-amateur-ink">
                      {t('pages.settings.platformAccessTitle')}
                    </p>
                    <p className="mt-1 text-amateur-muted">
                      {t('pages.settings.platformAccessBody')}
                    </p>
                  </div>
                ) : null}
                {memberships.length > 0 ? (
                  memberships.map((membership) => {
                    const tenant = tenants.find((item) => item.id === membership.tenantId);
                    return (
                      <div
                        key={`${membership.tenantId}-${membership.role}`}
                        className="rounded-xl border border-amateur-border bg-amateur-surface px-4 py-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium text-amateur-ink">
                            {tenant?.name ?? membership.tenantName}
                          </p>
                          <span className="rounded-full bg-amateur-accent-soft px-2.5 py-1 text-[11px] font-medium text-amateur-accent">
                            {t(`pages.settings.roles.${membership.role}`)}
                          </span>
                        </div>
                        <p className="mt-1 text-amateur-muted">
                          {session?.defaultTenantId === membership.tenantId
                            ? t('pages.settings.defaultMembership')
                            : t('pages.settings.secondaryMembership')}
                        </p>
                      </div>
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
                {t('pages.settings.nextTitle')}
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-amateur-muted">
                <li className="rounded-xl border border-amateur-border bg-amateur-surface px-4 py-3">
                  {platformAdmin
                    ? t('pages.settings.nextPlatformTenants')
                    : t('pages.settings.nextClubProfile')}
                </li>
                <li className="rounded-xl border border-amateur-border bg-amateur-surface px-4 py-3">
                  {platformAdmin
                    ? t('pages.settings.nextPlatformMemberships')
                    : t('pages.settings.nextClubMembers')}
                </li>
                <li className="rounded-xl border border-amateur-border bg-amateur-surface px-4 py-3">
                  {t('pages.settings.nextSecurity')}
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
