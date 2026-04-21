import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { InlineAlert } from '../ui/InlineAlert';
import {
  createSavedView,
  deleteSavedView,
  exportReportCsv,
  fetchCatalog,
  listSavedViews,
  runReport,
  updateSavedView,
} from '../../lib/reporting-client';
import {
  isFilterEmpty,
  type ReportCatalogEntity,
  type ReportEntityKey,
  type ReportFieldDefinition,
  type ReportFilterNode,
  type ReportGroupBy,
  type ReportRunResponse,
  type ReportSortClause,
  type SavedReportView,
  type StarterReportView,
} from '../../lib/reporting-types';
import { useFeatureAvailability } from '../../lib/feature-availability';
import { useTenant } from '../../lib/tenant-hooks';
import { FeatureAvailabilityNotice } from '../licensing/FeatureAvailabilityNotice';
import { AdvancedFilterBuilder } from './AdvancedFilterBuilder';
import { GroupingPanel } from './GroupingPanel';

/**
 * Initial state passed to the explorer when it is opened from a starter view,
 * a saved view, or a deep link from the dashboard.
 *
 * The explorer treats this as the canonical "first paint" so filters / columns
 * / sort / grouping all line up before the first network call.
 */
export type ExplorerInitialState = {
  filter?: ReportFilterNode | null;
  search?: string | null;
  columns?: string[];
  sort?: ReportSortClause[];
  groupBy?: ReportGroupBy | null;
  derivedFromStarterId?: string | null;
  /** Optional pre-applied saved view (so the controls reflect "active view"). */
  activeViewId?: string | null;
  /** Optional friendly label rendered above the explorer body. */
  contextLabel?: string;
};

type Props = {
  entity: ReportEntityKey;
  /** Optional preset filter applied on first render (legacy entry point). */
  initialFilter?: ReportFilterNode | null;
  /** v2: full first-paint state (filter + columns + sort + groupBy etc.). */
  initialState?: ExplorerInitialState;
  /** Optional UI heading shown above the explorer. */
  heading?: string;
  /** Hide built-in heading; useful when this is embedded inside a richer page. */
  embed?: boolean;
};

const PAGE_SIZE = 25;

export function DataExplorer({ entity, initialFilter = null, initialState, heading, embed }: Props) {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState<ReportCatalogEntity | null>(null);
  const [filter, setFilter] = useState<ReportFilterNode | null>(initialState?.filter ?? initialFilter);
  const [search, setSearch] = useState(initialState?.search ?? '');
  const [columns, setColumns] = useState<string[]>(initialState?.columns ?? []);
  const [sort, setSort] = useState<ReportSortClause[]>(initialState?.sort ?? []);
  const [groupBy, setGroupBy] = useState<ReportGroupBy | null>(initialState?.groupBy ?? null);
  const [derivedFromStarterId, setDerivedFromStarterId] = useState<string | null>(
    initialState?.derivedFromStarterId ?? null,
  );
  const [contextLabel, setContextLabel] = useState<string | null>(initialState?.contextLabel ?? null);
  const [page, setPage] = useState(0);
  const [response, setResponse] = useState<ReportRunResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedViews, setSavedViews] = useState<SavedReportView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(initialState?.activeViewId ?? null);
  const [showColumnsPicker, setShowColumnsPicker] = useState(false);
  const [showFilters, setShowFilters] = useState<boolean>(
    !isFilterEmpty(initialState?.filter ?? initialFilter),
  );
  const [showGrouping, setShowGrouping] = useState<boolean>(Boolean(initialState?.groupBy));
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { tenantId } = useTenant();
  const { availability: builderAvailability } = useFeatureAvailability(
    'reporting.advanced_builder',
    tenantId,
  );
  const builderAvailable = builderAvailability?.available !== false;
  const [info, setInfo] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cat = await fetchCatalog();
      if (cancelled) return;
      const found = cat.entities.find((e) => e.key === entity) ?? null;
      setCatalog(found);
      if (found) {
        const hasExplicitInitialState = typeof initialState !== 'undefined';
        setColumns(hasExplicitInitialState ? (initialState?.columns ?? found.defaultColumns) : found.defaultColumns);
        setSort(hasExplicitInitialState ? (initialState?.sort ?? (found.defaultSort ? [found.defaultSort] : [])) : found.defaultSort ? [found.defaultSort] : []);
        if (!hasExplicitInitialState) {
          setFilter(initialFilter ?? null);
          setSearch('');
          setGroupBy(null);
          setDerivedFromStarterId(null);
          setActiveViewId(null);
          setContextLabel(null);
          setShowFilters(!isFilterEmpty(initialFilter ?? null));
          setShowGrouping(false);
        }
        setShowColumnsPicker(false);
        setPage(0);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity]);

  // Re-apply legacy initialFilter prop changes (kept for backward compat).
  useEffect(() => {
    if (initialState) return;
    setFilter(initialFilter ?? null);
    setShowFilters(!isFilterEmpty(initialFilter ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFilter]);

  // Re-apply v2 initialState when it changes (e.g. user picks a different starter).
  useEffect(() => {
    if (!initialState) return;
    setFilter(initialState.filter ?? null);
    setSearch(initialState.search ?? '');
    setColumns(initialState.columns ?? []);
    setSort(initialState.sort ?? []);
    setGroupBy(initialState.groupBy ?? null);
    setDerivedFromStarterId(initialState.derivedFromStarterId ?? null);
    setActiveViewId(initialState.activeViewId ?? null);
    setContextLabel(initialState.contextLabel ?? null);
    setShowFilters(!isFilterEmpty(initialState.filter ?? null));
    setShowGrouping(Boolean(initialState.groupBy));
    setPage(0);
  }, [initialState]);

  const loadViews = useCallback(async () => {
    try {
      const res = await listSavedViews(entity);
      setSavedViews(res.items);
    } catch {
      setSavedViews([]);
    }
  }, [entity]);

  useEffect(() => {
    void loadViews();
  }, [loadViews]);

  const run = useCallback(async () => {
    if (!catalog) return;
    setLoading(true);
    setError(null);
    try {
      const res = await runReport({
        entity,
        filter: filter ?? undefined,
        search: search.trim() || undefined,
        columns: groupBy ? undefined : columns.length ? columns : undefined,
        sort: groupBy ? [] : sort,
        limit: groupBy ? groupBy.limit ?? 50 : PAGE_SIZE,
        offset: groupBy ? 0 : page * PAGE_SIZE,
        groupBy: groupBy ?? undefined,
      });
      setResponse(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [catalog, columns, entity, filter, groupBy, page, search, sort, t]);

  useEffect(() => {
    const id = setTimeout(() => void run(), 200);
    return () => clearTimeout(id);
  }, [run]);

  const fieldByKey = useMemo(
    () => new Map((catalog?.fields ?? []).map((field) => [field.key, field])),
    [catalog],
  );

  if (!catalog) {
    return <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>;
  }

  const totalPages = response && !groupBy ? Math.max(1, Math.ceil(response.total / PAGE_SIZE)) : 1;

  const onApplySavedView = (view: SavedReportView) => {
    setActiveViewId(view.id);
    setFilter(view.filter ?? null);
    setColumns(view.columns.length ? view.columns : catalog.defaultColumns);
    setSort(view.sort.length ? view.sort : catalog.defaultSort ? [catalog.defaultSort] : []);
    setSearch(view.search ?? '');
    setGroupBy(view.groupBy ?? null);
    setDerivedFromStarterId(view.derivedFromStarterId ?? null);
    setContextLabel(view.name);
    setPage(0);
    setShowFilters(!isFilterEmpty(view.filter));
    setShowGrouping(Boolean(view.groupBy));
    setInfo(t('pages.reports.savedViews.applied', { name: view.name }));
  };

  const onClearAll = () => {
    setActiveViewId(null);
    setFilter(null);
    setColumns(catalog.defaultColumns);
    setSort(catalog.defaultSort ? [catalog.defaultSort] : []);
    setSearch('');
    setGroupBy(null);
    setDerivedFromStarterId(null);
    setContextLabel(null);
    setPage(0);
    setShowFilters(false);
    setShowGrouping(false);
  };

  const onExport = async () => {
    setExporting(true);
    setError(null);
    try {
      await exportReportCsv({
        entity,
        filter: filter ?? undefined,
        search: search.trim() || undefined,
        columns: groupBy ? undefined : columns.length ? columns : undefined,
        sort: groupBy ? [] : sort,
        limit: groupBy ? groupBy.limit ?? 200 : catalog.exportRowLimit,
        groupBy: groupBy ?? undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setExporting(false);
    }
  };

  const filterCountValue = filterCount(filter);
  const ownViews = savedViews.filter((view) => view.visibility !== 'shared');
  const sharedViews = savedViews.filter((view) => view.visibility === 'shared');
  const isFromStarter = Boolean(derivedFromStarterId);

  return (
    <div className="space-y-4">
      {!embed && heading ? (
        <h2 className="font-display text-lg font-semibold text-amateur-ink">{heading}</h2>
      ) : null}

      {contextLabel ? (
        <div className="rounded-2xl border border-amateur-accent/30 bg-amateur-accent-soft/40 px-4 py-3 text-sm text-amateur-ink">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-amateur-accent">
                {isFromStarter
                  ? t('pages.reports.context.starter')
                  : t('pages.reports.context.savedView')}
              </span>
              <p className="mt-0.5 font-semibold">{contextLabel}</p>
            </div>
            <Button type="button" variant="ghost" onClick={onClearAll}>
              {t('pages.reports.context.startFresh')}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-amateur-border bg-amateur-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder={t('pages.reports.explorer.searchPlaceholder')}
            className="min-w-[220px] flex-1 rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-ink"
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowFilters((v) => !v)}
          >
            {showFilters
              ? t('pages.reports.explorer.hideFilters')
              : t('pages.reports.explorer.showFilters')}
            {filterCountValue > 0 ? ` (${filterCountValue})` : ''}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setShowGrouping((visible) => {
                const nextVisible = !visible;
                if (nextVisible && !groupBy) {
                  const defaultDimension = catalog.fields.find((field) => field.groupable);
                  setGroupBy(
                    defaultDimension
                      ? {
                          field: defaultDimension.key,
                          measures: [{ op: 'count', alias: 'count' }],
                          sort: { alias: 'count', direction: 'desc' },
                          limit: 50,
                        }
                      : null,
                  );
                  setPage(0);
                }
                if (!nextVisible) {
                  setGroupBy(null);
                  setPage(0);
                }
                return nextVisible;
              });
            }}
          >
            {groupBy
              ? t('pages.reports.aggregate.toggleOn')
              : showGrouping
              ? t('pages.reports.aggregate.toggleHide')
              : t('pages.reports.aggregate.toggleShow')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowColumnsPicker((v) => !v)}
            disabled={Boolean(groupBy)}
            title={groupBy ? t('pages.reports.aggregate.columnsHiddenWhileGrouped') : undefined}
          >
            {t('pages.reports.explorer.columns')} ({columns.length})
          </Button>
          <Button type="button" variant="ghost" onClick={onClearAll}>
            {t('pages.reports.explorer.reset')}
          </Button>
          <Button
            type="button"
            disabled={!builderAvailable}
            onClick={() => setShowSaveDialog(true)}
          >
            {activeViewId ? t('pages.reports.savedViews.update') : t('pages.reports.explorer.save')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={exporting || !builderAvailable}
            onClick={() => void onExport()}
          >
            {exporting ? t('pages.reports.explorer.exporting') : t('pages.reports.explorer.exportCsv')}
          </Button>
        </div>

        <FeatureAvailabilityNotice
          availability={builderAvailability}
          className="mt-3"
        />

        {savedViews.length > 0 ? (
          <div className="mt-3 space-y-2 text-xs">
            {ownViews.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-amateur-muted">{t('pages.reports.savedViews.ownTitle')}:</span>
                {ownViews.map((view) => (
                  <SavedViewChip
                    key={view.id}
                    view={view}
                    active={activeViewId === view.id}
                    onClick={() => onApplySavedView(view)}
                  />
                ))}
              </div>
            ) : null}
            {sharedViews.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-amateur-muted">{t('pages.reports.savedViews.sharedTitle')}:</span>
                {sharedViews.map((view) => (
                  <SavedViewChip
                    key={view.id}
                    view={view}
                    active={activeViewId === view.id}
                    onClick={() => onApplySavedView(view)}
                    sharedTag={t('pages.reports.savedViews.sharedTag')}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : showOnboarding ? (
          <div className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-dashed border-amateur-border bg-amateur-canvas px-3 py-2 text-xs text-amateur-muted">
            <span>{t('pages.reports.savedViews.firstRun')}</span>
            <button
              type="button"
              onClick={() => setShowOnboarding(false)}
              className="text-amateur-accent hover:underline"
            >
              {t('pages.reports.savedViews.dismissHint')}
            </button>
          </div>
        ) : null}
      </div>

      {info ? <InlineAlert tone="success">{info}</InlineAlert> : null}

      {showFilters ? (
        <AdvancedFilterBuilder
          entity={catalog}
          value={filter}
          onChange={(next) => {
            setFilter(next);
            setPage(0);
          }}
        />
      ) : null}

      {showGrouping ? (
        <GroupingPanel
          entity={catalog}
          value={groupBy}
          onChange={(next) => {
            setGroupBy(next);
            setPage(0);
          }}
        />
      ) : null}

      {showColumnsPicker && !groupBy ? (
        <ColumnsPicker
          catalog={catalog}
          selected={columns}
          onChange={(next) => {
            setColumns(next);
            setPage(0);
          }}
        />
      ) : null}

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      <div className="rounded-2xl border border-amateur-border bg-amateur-surface shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-amateur-border px-4 py-3 text-sm text-amateur-muted">
          <p>
            {response && groupBy
              ? t('pages.reports.aggregate.summary', { count: response.rows.length })
              : response
              ? t('pages.reports.explorer.summary', { count: response.total })
              : t('app.states.loading')}
          </p>
          {!groupBy ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={page === 0 || loading}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                ←
              </Button>
              <span>
                {page + 1} / {totalPages}
              </span>
              <Button
                type="button"
                variant="ghost"
                disabled={loading || page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                →
              </Button>
            </div>
          ) : null}
        </div>
        {loading ? (
          <p className="px-4 py-6 text-sm text-amateur-muted">{t('app.states.loading')}</p>
        ) : !response || response.rows.length === 0 ? (
          <EmptyState
            title={t('pages.reports.explorer.empty')}
            hint={t('pages.reports.explorer.emptyHint')}
          />
        ) : groupBy ? (
          <GroupedTable response={response} fieldByKey={fieldByKey} />
        ) : (
          <RowsTable
            response={response}
            columns={columns}
            sort={sort}
            onSort={setSort}
            fieldByKey={fieldByKey}
          />
        )}
      </div>

      {showSaveDialog ? (
        <SaveViewDialog
          existing={savedViews.find((v) => v.id === activeViewId) ?? null}
          showDuplicateMode={Boolean(activeViewId) || isFromStarter}
          defaultDuplicate={isFromStarter}
          onCancel={() => setShowSaveDialog(false)}
          onSave={async ({ name, description, visibility, mode }) => {
            setSaving(true);
            try {
              if (mode === 'update' && activeViewId) {
                const updated = await updateSavedView(activeViewId, {
                  name,
                  description,
                  visibility,
                  filter,
                  columns,
                  sort,
                  search: search.trim() || null,
                  groupBy,
                });
                setActiveViewId(updated.id);
                setContextLabel(updated.name);
              } else {
                const created = await createSavedView({
                  entity,
                  name,
                  description,
                  visibility,
                  filter,
                  columns,
                  sort,
                  search: search.trim() || null,
                  groupBy,
                  derivedFromStarterId: derivedFromStarterId ?? undefined,
                });
                setActiveViewId(created.id);
                setContextLabel(created.name);
                setDerivedFromStarterId(null);
              }
              setInfo(t('pages.reports.savedViews.saved', { name }));
              setShowSaveDialog(false);
              await loadViews();
            } catch (e) {
              setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
            } finally {
              setSaving(false);
            }
          }}
          onDelete={
            activeViewId
              ? async () => {
                  setSaving(true);
                  try {
                    await deleteSavedView(activeViewId);
                    setActiveViewId(null);
                    setContextLabel(null);
                    setShowSaveDialog(false);
                    await loadViews();
                  } catch (e) {
                    setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
                  } finally {
                    setSaving(false);
                  }
                }
              : undefined
          }
          saving={saving}
        />
      ) : null}
    </div>
  );
}

function SavedViewChip({
  view,
  active,
  onClick,
  sharedTag,
}: {
  view: SavedReportView;
  active: boolean;
  onClick: () => void;
  sharedTag?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={view.description ?? ''}
      className={`rounded-full border px-3 py-1 ${
        active
          ? 'border-amateur-accent bg-amateur-accent text-white'
          : 'border-amateur-border text-amateur-ink hover:bg-amateur-canvas'
      }`}
    >
      {view.name}
      {sharedTag ? <span className="ml-1 opacity-70">· {sharedTag}</span> : null}
      {view.groupBy ? <span className="ml-1 opacity-70">· Σ</span> : null}
    </button>
  );
}

function RowsTable({
  response,
  columns,
  sort,
  onSort,
  fieldByKey,
}: {
  response: ReportRunResponse;
  columns: string[];
  sort: ReportSortClause[];
  onSort: (next: ReportSortClause[]) => void;
  fieldByKey: Map<string, ReportFieldDefinition>;
}) {
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-amateur-border bg-amateur-canvas text-amateur-muted">
            {columns.map((col) => {
              const def = fieldByKey.get(col);
              if (!def) return <th key={col} className="px-4 py-2 font-medium">{col}</th>;
              const isSorted = sort.find((clause) => clause.field === col);
              const arrow = isSorted ? (isSorted.direction === 'asc' ? '▲' : '▼') : '';
              return (
                <th
                  key={col}
                  className={`px-4 py-2 font-medium ${def.sortable ? 'cursor-pointer hover:text-amateur-ink' : ''}`}
                  onClick={() => {
                    if (def.sortable === false) return;
                    const existing = sort.find((c) => c.field === col);
                    if (!existing) onSort([{ field: col, direction: 'asc' }]);
                    else if (existing.direction === 'asc') onSort([{ field: col, direction: 'desc' }]);
                    else onSort([]);
                  }}
                >
                  {t(def.labelKey, def.label ?? def.key)} {arrow}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {response.rows.map((row, idx) => (
            <tr key={idx} className="border-b border-amateur-border/70 last:border-0">
              {columns.map((col) => {
                const def = fieldByKey.get(col);
                return (
                  <td key={col} className="px-4 py-2 align-top text-amateur-ink">
                    {renderCell(row[col], def)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupedTable({
  response,
  fieldByKey,
}: {
  response: ReportRunResponse;
  fieldByKey: Map<string, ReportFieldDefinition>;
}) {
  const { t } = useTranslation();
  const labels: Array<{ key: string; labelKey?: string; label?: string; isMeasure?: boolean }> =
    response.columnLabels ?? response.columns.map((key) => ({ key, label: key }));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead>
          <tr className="border-b border-amateur-border bg-amateur-canvas text-amateur-muted">
            {labels.map((entry) => (
              <th key={entry.key} className="px-4 py-2 font-medium">
                {entry.labelKey ? t(entry.labelKey, entry.label ?? entry.key) : entry.label ?? entry.key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {response.rows.map((row, idx) => (
            <tr key={idx} className="border-b border-amateur-border/70 last:border-0">
              {labels.map((entry) => {
                const value = row[entry.key];
                if (entry.isMeasure) {
                  return (
                    <td key={entry.key} className="px-4 py-2 align-top text-amateur-ink">
                      {value === null || value === undefined
                        ? '—'
                        : typeof value === 'number'
                        ? value.toLocaleString(undefined, { maximumFractionDigits: 2 })
                        : String(value)}
                    </td>
                  );
                }
                const def = fieldByKey.get(entry.key);
                return (
                  <td key={entry.key} className="px-4 py-2 align-top text-amateur-ink">
                    {renderCell(value, def)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ColumnsPicker({
  catalog,
  selected,
  onChange,
}: {
  catalog: ReportCatalogEntity;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const { t } = useTranslation();
  const set = new Set(selected);
  const selectableFields = catalog.fields.filter((f) => f.selectable !== false);
  return (
    <div className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
      <p className="text-sm font-semibold text-amateur-ink">{t('pages.reports.explorer.columnsTitle')}</p>
      <p className="mt-1 text-xs text-amateur-muted">{t('pages.reports.explorer.columnsHint')}</p>
      <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
        {selectableFields.map((field) => (
          <label key={field.key} className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2">
            <input
              type="checkbox"
              checked={set.has(field.key)}
              onChange={(e) => {
                if (e.target.checked) {
                  onChange([...selected, field.key]);
                } else {
                  onChange(selected.filter((k) => k !== field.key));
                }
              }}
            />
            <span>{t(field.labelKey, field.label ?? field.key)}</span>
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="ghost" onClick={() => onChange(catalog.defaultColumns)}>
          {t('pages.reports.explorer.resetColumns')}
        </Button>
      </div>
    </div>
  );
}

function SaveViewDialog({
  existing,
  showDuplicateMode,
  defaultDuplicate,
  onCancel,
  onSave,
  onDelete,
  saving,
}: {
  existing: SavedReportView | null;
  showDuplicateMode: boolean;
  defaultDuplicate: boolean;
  onCancel: () => void;
  onSave: (input: {
    name: string;
    description: string | null;
    visibility: 'private' | 'shared';
    mode: 'create' | 'update';
  }) => void;
  onDelete?: () => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const initialMode: 'create' | 'update' = defaultDuplicate || !existing ? 'create' : 'update';
  const [name, setName] = useState(existing && initialMode === 'update' ? existing.name : '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [visibility, setVisibility] = useState<'private' | 'shared'>(existing?.visibility ?? 'private');
  const [mode, setMode] = useState<'create' | 'update'>(initialMode);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-2xl">
        <h3 className="font-display text-lg font-semibold text-amateur-ink">
          {t('pages.reports.savedViews.dialogTitle')}
        </h3>
        <p className="mt-1 text-sm text-amateur-muted">
          {t('pages.reports.savedViews.dialogHelper')}
        </p>
        {showDuplicateMode && existing ? (
          <div className="mt-3 inline-flex overflow-hidden rounded-xl border border-amateur-border text-xs">
            {(['update', 'create'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setMode(option);
                  if (option === 'create') setName('');
                  if (option === 'update' && existing) setName(existing.name);
                }}
                className={`px-3 py-1.5 font-semibold uppercase tracking-wide ${
                  mode === option ? 'bg-amateur-accent text-white' : 'bg-amateur-surface text-amateur-muted'
                }`}
              >
                {t(`pages.reports.savedViews.mode.${option}`)}
              </button>
            ))}
          </div>
        ) : null}
        <div className="mt-3 space-y-3 text-sm">
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-amateur-muted">
              {t('pages.reports.savedViews.name')}
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              placeholder={t('pages.reports.savedViews.namePlaceholder')}
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-amateur-muted">
              {t('pages.reports.savedViews.description')}
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              placeholder={t('pages.reports.savedViews.descriptionPlaceholder')}
            />
          </label>
          <fieldset className="space-y-1 text-xs text-amateur-muted">
            <legend className="uppercase tracking-wide">{t('pages.reports.savedViews.visibility')}</legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="visibility"
                checked={visibility === 'private'}
                onChange={() => setVisibility('private')}
              />
              <span>
                {t('pages.reports.savedViews.private')}
                <span className="ml-1 text-[10px] opacity-70">
                  · {t('pages.reports.savedViews.privateHint')}
                </span>
              </span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="visibility"
                checked={visibility === 'shared'}
                onChange={() => setVisibility('shared')}
              />
              <span>
                {t('pages.reports.savedViews.shared')}
                <span className="ml-1 text-[10px] opacity-70">
                  · {t('pages.reports.savedViews.sharedHint')}
                </span>
              </span>
            </label>
          </fieldset>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          {onDelete && mode === 'update' ? (
            <Button
              type="button"
              variant="ghost"
              onClick={onDelete}
              disabled={saving}
              className="text-rose-700"
            >
              {t('pages.reports.savedViews.delete')}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
              {t('app.actions.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() =>
                onSave({
                  name: name.trim(),
                  description: description.trim() || null,
                  visibility,
                  mode,
                })
              }
              disabled={saving || !name.trim()}
            >
              {saving ? t('app.states.saving') : t('app.actions.save')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderCell(value: string | number | boolean | null, def?: ReportFieldDefinition): string {
  if (value === null || value === undefined || value === '') return '—';
  if (def?.type === 'boolean') {
    return value ? '✓' : '—';
  }
  if (def?.type === 'currency') {
    const n = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(n)) {
      return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  }
  if (def?.type === 'date') {
    return String(value).slice(0, 10);
  }
  if (def?.type === 'datetime') {
    const d = new Date(String(value));
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString();
    }
  }
  if (def?.type === 'enum' && def.options) {
    const option = def.options.find((opt) => opt.value === String(value));
    if (option) {
      return option.label ?? option.value;
    }
  }
  return String(value);
}

function filterCount(node: ReportFilterNode | null | undefined): number {
  if (!node) return 0;
  if (node.type === 'condition') return 1;
  return node.children.reduce((sum, child) => sum + filterCount(child), 0);
}

export type { StarterReportView };
