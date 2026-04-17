import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListPageFrame } from '../components/ui/ListPageFrame';
import { PageHeader } from '../components/ui/PageHeader';
import { DataExplorer } from '../components/reporting/DataExplorer';
import { fetchCatalog } from '../lib/reporting-client';
import type { ReportCatalogEntity, ReportEntityKey } from '../lib/reporting-types';
import { useTenant } from '../lib/tenant-hooks';
import { InlineAlert } from '../components/ui/InlineAlert';

export function ReportBuilderPage() {
  const { t } = useTranslation();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [entities, setEntities] = useState<ReportCatalogEntity[]>([]);
  const [active, setActive] = useState<ReportEntityKey>('athletes');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cat = await fetchCatalog();
      if (cancelled) return;
      setEntities(cat.entities);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <PageHeader
        title={t('pages.reportBuilder.title')}
        subtitle={t('pages.reportBuilder.subtitle')}
      />
      <ListPageFrame>
        {!tenantId && !tenantLoading ? (
          <InlineAlert tone="info">{t('app.errors.needTenant')}</InlineAlert>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {entities.map((entity) => (
                <button
                  key={entity.key}
                  type="button"
                  onClick={() => setActive(entity.key)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    active === entity.key
                      ? 'bg-amateur-accent text-white'
                      : 'border border-amateur-border bg-amateur-surface text-amateur-ink hover:bg-amateur-canvas'
                  }`}
                >
                  {t(entity.labelKey)}
                </button>
              ))}
            </div>
            {entities.length === 0 ? (
              <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>
            ) : (
              <DataExplorer entity={active} embed />
            )}
          </div>
        )}
      </ListPageFrame>
    </div>
  );
}
