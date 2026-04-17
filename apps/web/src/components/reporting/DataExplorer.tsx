import { useCallback, useEffect, useState } from 'react';
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
  type ReportRunResponse,
  type ReportSortClause,
  type SavedReportView,
} from '../../lib/reporting-types';
import { AdvancedFilterBuilder } from './AdvancedFilterBuilder';

type Props = {
  entity: ReportEntityKey;
  /** Optional preset filter applied on first render (e.g. when navigated from a card). */
  initialFilter?: ReportFilterNode | null;
  /** Optional UI heading shown above the explorer. */
  heading?: string;
  /** Hide built-in heading; useful when this is embedded inside a richer page. */
  embed?: boolean;
};

const PAGE_SIZE = 25;

export function DataExplorer({ entity, initialFilter = null, heading, embed }: Props) {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState<ReportCatalogEntity | null>(null);
  const [filter, setFilter] = useState<ReportFilterNode | null>(initialFilter);
  const [search, setSearch] = useState('');
  const [columns, setColumns] = useState<string[]>([]);
  const [sort, setSort] = useState<ReportSortClause[]>([]);
  const [page, setPage] = useState(0);
  const [response, setResponse] = useState<ReportRunResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedViews, setSavedViews] = useState<SavedReportView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [showColumnsPicker, setShowColumnsPicker] = useState(false);
  const [showFilters, setShowFilters] = useState<boolean>(!isFilterEmpty(initialFilter));
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const cat = await fetchCatalog();
      if (cancelled) return;
      const found = cat.entities.find((e) => e.key === entity) ?? null;
      setCatalog(found);
      if (found) {
        setColumns(found.defaultColumns);
        setSort(found.defaultSort ? [found.defaultSort] : []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entity]);

  useEffect(() => {
    setFilter(initialFilter ?? null);
    setShowFilters(!isFilterEmpty(initialFilter ?? null));
  }, [initialFilter]);

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
        columns: columns.length ? columns : undefined,
        sort,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setResponse(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [catalog, columns, entity, filter, page, search, sort, t]);

  useEffect(() => {
    const id = setTimeout(() => void run(), 200);
    return () => clearTimeout(id);
  }, [run]);

  if (!catalog) {
    return <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>;
  }

  const fieldByKey = new Map(catalog.fields.map((field) => [field.key, field]));
  const totalPages = response ? Math.max(1, Math.ceil(response.total / PAGE_SIZE)) : 1;

  const onApplyView = (view: SavedReportView) => {
    setActiveViewId(view.id);
    setFilter(view.filter ?? null);
    setColumns(view.columns.length ? view.columns : catalog.defaultColumns);
    setSort(view.sort.length ? view.sort : catalog.defaultSort ? [catalog.defaultSort] : []);
    setSearch(view.search ?? '');
    setPage(0);
    setShowFilters(!isFilterEmpty(view.filter));
    setInfo(t('pages.reports.savedViews.applied', { name: view.name }));
  };

  const onClearAll = () => {
    setActiveViewId(null);
    setFilter(null);
    setColumns(catalog.defaultColumns);
    setSort(catalog.defaultSort ? [catalog.defaultSort] : []);
    setSearch('');
    setPage(0);
  };

  const onExport = async () => {
    setExporting(true);
    setError(null);
    try {
      await exportReportCsv({
        entity,
        filter: filter ?? undefined,
        search: search.trim() || undefined,
        columns: columns.length ? columns : undefined,
        sort,
        limit: catalog.exportRowLimit,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {!embed && heading ? (
        <h2 className="font-display text-lg font-semibold text-amateur-ink">{heading}</h2>
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
            {filterCount(filter) > 0 ? ` (${filterCount(filter)})` : ''}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowColumnsPicker((v) => !v)}
          >
            {t('pages.reports.explorer.columns')} ({columns.length})
          </Button>
          <Button type="button" variant="ghost" onClick={onClearAll}>
            {t('pages.reports.explorer.reset')}
          </Button>
          <Button type="button" onClick={() => setShowSaveDialog(true)}>
            {t('pages.reports.explorer.save')}
          </Button>
          <Button type="button" variant="ghost" disabled={exporting} onClick={() => void onExport()}>
            {exporting ? t('pages.reports.explorer.exporting') : t('pages.reports.explorer.exportCsv')}
          </Button>
        </div>

        {savedViews.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-amateur-muted">{t('pages.reports.savedViews.title')}:</span>
            {savedViews.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => onApplyView(view)}
                className={`rounded-full border px-3 py-1 ${
                  activeViewId === view.id
                    ? 'border-amateur-accent bg-amateur-accent text-white'
                    : 'border-amateur-border text-amateur-ink hover:bg-amateur-canvas'
                }`}
                title={view.description ?? ''}
              >
                {view.name}
                {view.visibility === 'shared' ? ` · ${t('pages.reports.savedViews.shared')}` : ''}
              </button>
            ))}
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

      {showColumnsPicker ? (
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
            {response
              ? t('pages.reports.explorer.summary', { count: response.total })
              : t('app.states.loading')}
          </p>
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
        </div>
        {loading ? (
          <p className="px-4 py-6 text-sm text-amateur-muted">{t('app.states.loading')}</p>
        ) : !response || response.rows.length === 0 ? (
          <EmptyState
            title={t('pages.reports.explorer.empty')}
            hint={t('pages.reports.explorer.emptyHint')}
          />
        ) : (
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
                          setSort((current) => {
                            const existing = current.find((c) => c.field === col);
                            if (!existing) return [{ field: col, direction: 'asc' }];
                            if (existing.direction === 'asc') return [{ field: col, direction: 'desc' }];
                            return [];
                          });
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
        )}
      </div>

      {showSaveDialog ? (
        <SaveViewDialog
          existing={savedViews.find((v) => v.id === activeViewId) ?? null}
          onCancel={() => setShowSaveDialog(false)}
          onSave={async ({ name, description, visibility, mode }) => {
            setSaving(true);
            try {
              if (mode === 'update' && activeViewId) {
                await updateSavedView(activeViewId, {
                  name,
                  description,
                  visibility,
                  filter,
                  columns,
                  sort,
                  search: search.trim() || null,
                });
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
                });
                setActiveViewId(created.id);
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
  onCancel,
  onSave,
  onDelete,
  saving,
}: {
  existing: SavedReportView | null;
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
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [visibility, setVisibility] = useState<'private' | 'shared'>(existing?.visibility ?? 'private');
  const [mode, setMode] = useState<'create' | 'update'>(existing ? 'update' : 'create');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-2xl">
        <h3 className="font-display text-lg font-semibold text-amateur-ink">
          {t('pages.reports.savedViews.dialogTitle')}
        </h3>
        {existing ? (
          <div className="mt-3 inline-flex overflow-hidden rounded-xl border border-amateur-border text-xs">
            {(['create', 'update'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMode(option)}
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
              {t('pages.reports.savedViews.private')}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="visibility"
                checked={visibility === 'shared'}
                onChange={() => setVisibility('shared')}
              />
              {t('pages.reports.savedViews.shared')}
            </label>
          </fieldset>
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          {onDelete ? (
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
