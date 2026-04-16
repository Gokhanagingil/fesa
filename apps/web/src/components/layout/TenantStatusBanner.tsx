import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/auth-context';
import { useTenant } from '../../lib/tenant-hooks';
import { Button } from '../ui/Button';

export function TenantStatusBanner() {
  const { t } = useTranslation();
  const { canAccessCrossTenant } = useAuth();
  const { tenants, tenantId, loading, error, refresh } = useTenant();

  if (loading) {
    return null;
  }

  if (!error && tenants.length > 0 && tenantId) {
    return null;
  }

  const title = error
    ? t('app.tenant.banner.loadTitle')
    : tenants.length === 0
      ? t('app.tenant.banner.emptyTitle')
      : t('app.tenant.banner.selectionTitle');

  const body = error
    ? t('app.tenant.banner.loadBody')
    : tenants.length === 0
      ? canAccessCrossTenant
        ? t('app.tenant.banner.emptyPlatformBody')
        : t('app.tenant.banner.emptyClubBody')
      : t('app.tenant.banner.selectionBody');

  return (
    <div className="border-b border-amateur-border bg-amber-50/70 px-4 py-3 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-white/80 px-4 py-4 shadow-sm">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
            {t('app.tenant.label')}
          </p>
          <h2 className="mt-1 font-display text-base font-semibold text-amateur-ink">
            {title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-amateur-muted">
            {error ?? body}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(error || tenants.length === 0) ? (
            <Button type="button" variant="ghost" onClick={() => void refresh()}>
              {t('app.actions.refresh')}
            </Button>
          ) : null}
          <Link to="/app/settings">
            <Button variant="ghost">{t('app.nav.settings')}</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
