import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { ListPageFrame } from '../components/ui/ListPageFrame';
import { PageHeader } from '../components/ui/PageHeader';
import { DataExplorer, type ExplorerInitialState } from '../components/reporting/DataExplorer';
import { StarterViewsPanel } from '../components/reporting/StarterViewsPanel';
import { Button } from '../components/ui/Button';
import {
  fetchCatalog,
  fetchSavedView,
  fetchStarterView,
  listSavedViews,
} from '../lib/reporting-client';
import type {
  ReportCatalogEntity,
  ReportEntityKey,
  SavedReportView,
  StarterReportView,
} from '../lib/reporting-types';
import { useTenant } from '../lib/tenant-hooks';
import { InlineAlert } from '../components/ui/InlineAlert';

/**
 * The Report Builder is the v2 reporting hub: starter views, entity picker,
 * onboarding guidance, and the embedded explorer all live together so the
 * surface never feels empty on first load.
 */
export function ReportBuilderPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [entities, setEntities] = useState<ReportCatalogEntity[]>([]);
  const [active, setActive] = useState<ReportEntityKey>('athletes');
  const [initialState, setInitialState] = useState<ExplorerInitialState | undefined>(undefined);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [savedViews, setSavedViews] = useState<SavedReportView[]>([]);

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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const views = await listSavedViews();
        if (!cancelled) {
          setSavedViews(views.items);
        }
      } catch {
        if (!cancelled) {
          setSavedViews([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  // Hydrate from URL: ?starter=<id>, ?savedView=<id>, or ?preset=<base64-json>.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const starterId = params.get('starter');
    const savedViewId = params.get('savedView');
    const entityKey = params.get('entity') as ReportEntityKey | null;
    const filterParam = params.get('preset');

    void (async () => {
      if (starterId) {
        try {
          const starter = await fetchStarterView(starterId);
          applyStarter(starter);
        } catch (e) {
          setPendingMessage(e instanceof Error ? e.message : t('app.errors.loadFailed'));
        }
        return;
      }
      if (savedViewId) {
        try {
          const savedView = await fetchSavedView(savedViewId);
          applySavedView(savedView);
        } catch (e) {
          setPendingMessage(e instanceof Error ? e.message : t('app.errors.loadFailed'));
        }
        return;
      }
      if (entityKey) {
        setActive(entityKey);
      }
      if (filterParam) {
        try {
          const decoded = JSON.parse(decodeURIComponent(escape(window.atob(filterParam))));
          setInitialState({
            filter: decoded.filter ?? null,
            columns: decoded.columns ?? undefined,
            sort: decoded.sort ?? undefined,
            search: decoded.search ?? null,
            groupBy: decoded.groupBy ?? null,
            contextLabel: decoded.contextLabel ?? null,
            activeViewId: null,
          });
          if (decoded.entity) setActive(decoded.entity);
        } catch {
          setPendingMessage(t('pages.reportBuilder.invalidPreset'));
        }
      } else if (!entityKey) {
        setInitialState(undefined);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const applyStarter = useCallback((starter: StarterReportView) => {
    setActive(starter.entity);
    setInitialState({
      filter: starter.filter ?? null,
      columns: starter.columns,
      sort: starter.sort,
      search: starter.search ?? null,
      groupBy: starter.groupBy ?? null,
      derivedFromStarterId: starter.id,
      contextLabel: t(starter.titleKey, starter.id),
      activeViewId: null,
    });
    setPendingMessage(null);
  }, [t]);

  const applySavedView = useCallback((view: SavedReportView) => {
    setActive(view.entity);
    setInitialState({
      filter: view.filter ?? null,
      columns: view.columns,
      sort: view.sort,
      search: view.search ?? null,
      groupBy: view.groupBy ?? null,
      derivedFromStarterId: view.derivedFromStarterId ?? null,
      contextLabel: view.name,
      activeViewId: view.id,
    });
    setPendingMessage(null);
  }, []);

  const onPickStarter = useCallback(
    (starter: StarterReportView) => {
      applyStarter(starter);
      setActive(starter.entity);
      // Update URL so the starter link can be shared / refreshed.
      const params = new URLSearchParams(location.search);
      params.set('starter', starter.id);
      params.delete('savedView');
      params.delete('entity');
      params.delete('preset');
      navigate({ search: `?${params.toString()}` }, { replace: true });
    },
    [applyStarter, location.search, navigate],
  );

  const activeEntityLabel = useMemo(() => {
    const found = entities.find((entity) => entity.key === active);
    return found ? t(found.labelKey) : '';
  }, [active, entities, t]);

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
          <div className="space-y-6">
            {pendingMessage ? <InlineAlert tone="info">{pendingMessage}</InlineAlert> : null}

            <div className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amateur-accent">
                {t('pages.reportBuilder.welcomeEyebrow')}
              </p>
              <h2 className="mt-1 font-display text-lg font-semibold text-amateur-ink">
                {t('pages.reportBuilder.welcomeTitle')}
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-amateur-muted">
                {t('pages.reportBuilder.welcomeBody')}
              </p>
              <ul className="mt-3 grid gap-2 text-xs text-amateur-muted md:grid-cols-3">
                <li className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2">
                  <span className="font-semibold text-amateur-ink">1.</span>{' '}
                  {t('pages.reportBuilder.tipPickEntity')}
                </li>
                <li className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2">
                  <span className="font-semibold text-amateur-ink">2.</span>{' '}
                  {t('pages.reportBuilder.tipFilterOrGroup')}
                </li>
                <li className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2">
                  <span className="font-semibold text-amateur-ink">3.</span>{' '}
                  {t('pages.reportBuilder.tipSaveOrExport')}
                </li>
              </ul>
            </div>

            <StarterViewsPanel onApply={onPickStarter} />

            {savedViews.length > 0 ? (
              <section className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amateur-accent">
                      {t('pages.reports.savedViews.title')}
                    </p>
                    <h3 className="mt-1 font-display text-base font-semibold text-amateur-ink">
                      {t('pages.reportBuilder.continueTitle')}
                    </h3>
                    <p className="mt-1 text-sm text-amateur-muted">
                      {t('pages.reportBuilder.continueBody')}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      const params = new URLSearchParams(location.search);
                      params.delete('starter');
                      params.delete('savedView');
                      params.delete('preset');
                      if (params.get('entity') !== active) {
                        params.set('entity', active);
                      }
                      navigate({ search: `?${params.toString()}` }, { replace: true });
                      setInitialState(undefined);
                    }}
                  >
                    {t('pages.reportBuilder.startFresh')}
                  </Button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {savedViews.slice(0, 6).map((view) => (
                    <button
                      key={view.id}
                      type="button"
                      onClick={() => {
                        applySavedView(view);
                        const params = new URLSearchParams(location.search);
                        params.set('savedView', view.id);
                        params.delete('starter');
                        params.delete('preset');
                        params.delete('entity');
                        navigate({ search: `?${params.toString()}` }, { replace: true });
                      }}
                      className="rounded-full border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-ink transition hover:border-amateur-accent/40 hover:bg-amateur-canvas"
                    >
                      <span className="font-semibold">{view.name}</span>
                      <span className="ml-2 text-xs text-amateur-muted">
                        {view.visibility === 'shared'
                          ? t('pages.reports.savedViews.sharedTag')
                          : t('pages.reports.savedViews.private')}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amateur-muted">
                {t('pages.reportBuilder.entityPickerEyebrow')}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {entities.map((entity) => (
                  <button
                    key={entity.key}
                    type="button"
                    onClick={() => {
                      setActive(entity.key);
                      setInitialState(undefined);
                      setPendingMessage(null);
                      const params = new URLSearchParams(location.search);
                      params.set('entity', entity.key);
                      params.delete('starter');
                      params.delete('savedView');
                      params.delete('preset');
                      navigate({ search: `?${params.toString()}` }, { replace: true });
                    }}
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
              {activeEntityLabel ? (
                <p className="mt-2 text-xs text-amateur-muted">
                  {t('pages.reportBuilder.exploringEntity', { name: activeEntityLabel })}
                </p>
              ) : null}
            </div>

            {entities.length === 0 ? (
              <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>
            ) : (
              <DataExplorer entity={active} initialState={initialState} embed />
            )}
          </div>
        )}
      </ListPageFrame>
    </div>
  );
}
