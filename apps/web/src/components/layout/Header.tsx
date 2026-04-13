import { useTranslation } from 'react-i18next';
import { useTenant } from '../../lib/tenant-hooks';
import { LanguageSwitch } from '../ui/LanguageSwitch';

export function Header() {
  const { t } = useTranslation();
  const { tenants, tenantId, setTenantId, loading } = useTenant();

  return (
    <header className="sticky top-0 z-10 border-b border-amateur-border bg-amateur-surface/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
            {t('app.name')}
          </p>
          <p className="truncate text-sm text-amateur-muted">{t('app.tagline')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-amateur-muted">
            <span className="whitespace-nowrap">{t('app.tenant.label')}</span>
            <select
              className="max-w-[14rem] rounded-lg border border-amateur-border bg-amateur-canvas px-2 py-1.5 text-sm text-amateur-ink outline-none focus:ring-2 focus:ring-amateur-accent/30"
              value={tenantId ?? ''}
              disabled={loading || tenants.length === 0}
              onChange={(e) => setTenantId(e.target.value)}
            >
              {tenants.length === 0 ? (
                <option value="">{t('app.tenant.empty')}</option>
              ) : (
                tenants.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <LanguageSwitch />
        </div>
      </div>
    </header>
  );
}
