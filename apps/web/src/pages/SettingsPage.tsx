import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { InlineAlert } from '../components/ui/InlineAlert';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { useAuth } from '../lib/auth-context';
import { useTenant } from '../lib/tenant-hooks';
import type { StaffSessionTenant } from '../lib/auth-types';

export function SettingsPage() {
  const { t } = useTranslation();
  const { session, staffUser } = useAuth();
  const { tenants, tenantId } = useTenant();
  const activeTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === tenantId) ?? null,
    [tenantId, tenants],
  );
  const memberships = session?.availableTenants ?? [];
  const platformAdmin = staffUser?.platformRole === 'global_admin';

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
                : memberships[0]
                  ? t(`pages.settings.roles.${memberships[0].role}`)
                  : t('pages.settings.summary.noRole')
            }
          />
        </section>

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
                  memberships.map((membership: StaffSessionTenant) => {
                    const tenant = tenants.find((item) => item.id === membership.id);
                    return (
                      <div
                        key={`${membership.id}-${membership.role}`}
                        className="rounded-xl border border-amateur-border bg-amateur-surface px-4 py-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium text-amateur-ink">
                            {tenant?.name ?? membership.name}
                          </p>
                          <span className="rounded-full bg-amateur-accent-soft px-2.5 py-1 text-[11px] font-medium text-amateur-accent">
                            {t(`pages.settings.roles.${membership.role}`)}
                          </span>
                        </div>
                        <p className="mt-1 text-amateur-muted">
                          {session?.activeTenantId === membership.id
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
