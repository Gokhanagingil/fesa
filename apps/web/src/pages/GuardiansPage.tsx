import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { BulkActionBar, type BulkActionDescriptor } from '../components/ui/BulkActionBar';
import { EmptyState } from '../components/ui/EmptyState';
import { InlineAlert } from '../components/ui/InlineAlert';
import { ListPageFrame } from '../components/ui/ListPageFrame';
import { PageHeader } from '../components/ui/PageHeader';
import { DataExplorer } from '../components/reporting/DataExplorer';
import { apiGet, apiPost } from '../lib/api';
import { downloadCsv, renderCsvFromRows } from '../lib/imports';
import { getPersonName } from '../lib/display';
import type { Guardian } from '../lib/domain-types';
import { useTenant } from '../lib/tenant-hooks';

type GuardianListResponse = { items: Guardian[]; total: number };

type BulkDeleteResponse = {
  requested: number;
  deleted: number;
  skipped: number;
  skippedIds: string[];
};

export function GuardiansPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Guardian[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (q.trim()) params.set('q', q.trim());
      const res = await apiGet<GuardianListResponse>(`/api/guardians?${params.toString()}`);
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [q, t, tenantId]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 250);
    return () => clearTimeout(id);
  }, [load]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => items.some((guardian) => guardian.id === id)));
  }, [items]);

  const selectedGuardians = useMemo(
    () => items.filter((guardian) => selectedIds.includes(guardian.id)),
    [items, selectedIds],
  );

  function toggleSelection(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );
  }

  function toggleVisibleSelection() {
    if (items.length === 0) return;
    const visibleIds = items.map((guardian) => guardian.id);
    const allVisibleSelected = visibleIds.every((id) => selectedIds.includes(id));
    if (allVisibleSelected) {
      setSelectedIds((current) => current.filter((id) => !visibleIds.includes(id)));
      return;
    }
    setSelectedIds((current) => Array.from(new Set([...current, ...visibleIds])));
  }

  const exportSelection = useCallback(
    (target: 'visible' | 'selected') => {
      const targetItems = target === 'selected' ? selectedGuardians : items;
      if (targetItems.length === 0) {
        setError(t('app.exportCsv.emptyHint'));
        return;
      }
      const headers = [
        t('pages.guardians.name'),
        t('pages.athletes.phone'),
        t('pages.athletes.email'),
      ];
      const rows = targetItems.map((guardian) => ({
        [headers[0]]: getPersonName(guardian),
        [headers[1]]: guardian.phone ?? '',
        [headers[2]]: guardian.email ?? '',
      }));
      const csv = renderCsvFromRows(headers, rows);
      const filename = `amateur-guardians-${target}-${new Date().toISOString().slice(0, 10)}.csv`;
      downloadCsv(filename, csv);
      setMessage(t('app.exportCsv.successHint', { count: targetItems.length }));
    },
    [items, selectedGuardians, t],
  );

  async function bulkDelete() {
    if (selectedIds.length === 0) return;
    if (!window.confirm(t('app.bulk.confirmTitle'))) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiPost<BulkDeleteResponse>('/api/guardians/bulk-delete', {
        guardianIds: selectedIds,
        skipLinked: true,
      });
      setMessage(
        `${t('app.bulk.confirmDone')} (${result.deleted} / ${result.requested}, ${result.skipped} skipped)`,
      );
      setSelectedIds([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.bulk.confirmFailed'));
    } finally {
      setBusy(false);
    }
  }

  const handlePrepareMessage = useCallback(() => {
    if (selectedIds.length === 0) return;
    const params = new URLSearchParams();
    selectedIds.forEach((id) => params.append('guardianIds', id));
    params.set('source', 'guardians_selection');
    params.set('sourceKey', `guardians-bulk-${selectedIds.length}`);
    params.set('primaryContactsOnly', 'true');
    params.set('channel', 'whatsapp');
    navigate(`/app/communications?${params.toString()}`);
  }, [navigate, selectedIds]);

  const bulkActions: BulkActionDescriptor[] = useMemo(() => {
    const runDelete = () => {
      void bulkDelete();
    };
    return [
      {
        id: 'prepare-message',
        ghost: true,
        label: t('pages.guardians.bulkPrepareMessage'),
        onClick: handlePrepareMessage,
      },
      {
        id: 'export-selection',
        ghost: true,
        label: t('app.bulk.exportSelection'),
        onClick: () => exportSelection('selected'),
      },
      {
        id: 'delete-selection',
        ghost: true,
        label: t('pages.guardians.bulkDelete'),
        confirm: t('pages.guardians.bulkDeleteConfirm'),
        onClick: runDelete,
      },
    ];
    // bulkDelete reads the latest state via closure; we only need to refresh
    // button bindings when label translations or the export helper change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportSelection, handlePrepareMessage, t]);

  const [searchParams, setSearchParams] = useSearchParams();
  const view = (searchParams.get('view') as 'list' | 'advanced') ?? 'list';

  return (
    <div>
      <PageHeader title={t('pages.guardians.title')} subtitle={t('pages.guardians.subtitle')} />
      <div className="mb-3 inline-flex overflow-hidden rounded-xl border border-amateur-border bg-amateur-surface text-xs">
        {(['list', 'advanced'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              if (option === 'list') next.delete('view');
              else next.set('view', option);
              setSearchParams(next, { replace: true });
            }}
            className={`px-4 py-2 font-semibold uppercase tracking-wide ${
              view === option ? 'bg-amateur-accent text-white' : 'text-amateur-muted hover:text-amateur-ink'
            }`}
          >
            {t(`pages.reports.viewToggle.${option}`)}
          </button>
        ))}
      </div>
      {view === 'advanced' ? (
        <ListPageFrame>
          {!tenantId && !tenantLoading ? (
            <p className="text-sm text-amateur-muted">{t('app.errors.needTenant')}</p>
          ) : (
            <DataExplorer entity="guardians" embed />
          )}
        </ListPageFrame>
      ) : (
        <ListPageFrame
          search={{ value: q, onChange: setQ, disabled: !tenantId || tenantLoading }}
          toolbar={
            <>
              <Button type="button" variant="ghost" onClick={() => exportSelection('visible')}>
                {t('app.exportCsv.label')}
              </Button>
              <Link to="/app/guardians/new">
                <Button>{t('pages.guardians.new')}</Button>
              </Link>
            </>
          }
        >
          {message ? (
            <InlineAlert tone="success" className="mb-4">
              {message}
            </InlineAlert>
          ) : null}
          {!tenantId && !tenantLoading ? (
            <p className="text-sm text-amateur-muted">{t('app.errors.needTenant')}</p>
          ) : error ? (
            <p className="text-sm text-red-700">{error}</p>
          ) : loading ? (
            <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>
          ) : items.length === 0 ? (
            <EmptyState title={t('pages.guardians.empty')} hint={t('pages.guardians.emptyHint')} />
          ) : (
            <div className="space-y-4">
              <BulkActionBar
                title={t('pages.guardians.bulkTitle')}
                subtitle={t('pages.guardians.bulkHint')}
                selectedCount={selectedGuardians.length}
                visibleTotal={items.length}
                allVisibleSelected={
                  items.length > 0 && items.every((guardian) => selectedIds.includes(guardian.id))
                }
                onToggleVisible={toggleVisibleSelection}
                onClearSelection={() => setSelectedIds([])}
                actions={bulkActions}
                busy={busy}
              />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-amateur-border text-amateur-muted">
                      <th className="pb-2 pr-4 font-medium">
                        <span className="sr-only">{t('app.actions.bulk')}</span>
                      </th>
                      <th className="pb-2 pr-4 font-medium">{t('pages.guardians.name')}</th>
                      <th className="pb-2 pr-4 font-medium">{t('pages.athletes.phone')}</th>
                      <th className="pb-2 pr-4 font-medium">{t('pages.athletes.email')}</th>
                      <th className="pb-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((guardian) => (
                      <tr key={guardian.id} className="border-b border-amateur-border/70 last:border-0">
                        <td className="py-3 pr-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(guardian.id)}
                            onChange={() => toggleSelection(guardian.id)}
                            aria-label={t('app.bulk.selectionLabel', {
                              name: getPersonName(guardian),
                            })}
                          />
                        </td>
                        <td className="py-3 pr-4 font-medium text-amateur-ink">
                          {getPersonName(guardian)}
                        </td>
                        <td className="py-3 pr-4 text-amateur-muted">{guardian.phone || '—'}</td>
                        <td className="py-3 pr-4 text-amateur-muted">{guardian.email || '—'}</td>
                        <td className="py-3 text-right">
                          <Link
                            to={`/app/guardians/${guardian.id}`}
                            className="font-medium text-amateur-accent hover:underline"
                          >
                            {t('pages.guardians.detail')}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-amateur-muted">{t('app.count.rows', { count: total })}</p>
              </div>
            </div>
          )}
        </ListPageFrame>
      )}
    </div>
  );
}
