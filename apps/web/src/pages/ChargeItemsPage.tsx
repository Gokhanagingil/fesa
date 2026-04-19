import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { InlineAlert } from '../components/ui/InlineAlert';
import { ListPageFrame } from '../components/ui/ListPageFrame';
import { PageHeader } from '../components/ui/PageHeader';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import { useTenant } from '../lib/tenant-hooks';
import type { ChargeItem } from '../lib/domain-types';

export function ChargeItemsPage() {
  const { t } = useTranslation();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<ChargeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('dues');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('TRY');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (q.trim()) params.set('q', q.trim());
      const res = await apiGet<{ items: ChargeItem[] }>(`/api/charge-items?${params.toString()}`);
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [q, tenantId, t]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 250);
    return () => clearTimeout(id);
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setName('');
    setCategory('dues');
    setAmount('');
    setCurrency('TRY');
    setIsActive(true);
  }

  function openCreateForm() {
    resetForm();
    setShow(true);
    setMessage(null);
  }

  function openEditForm(item: ChargeItem) {
    setEditingId(item.id);
    setName(item.name);
    setCategory(item.category);
    setAmount(item.defaultAmount);
    setCurrency(item.currency);
    setIsActive(item.isActive);
    setShow(true);
    setMessage(null);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name,
        category,
        defaultAmount: parseFloat(amount),
        currency,
        isActive,
      };
      if (editingId) {
        await apiPatch(`/api/charge-items/${editingId}`, payload);
        setMessage(t('pages.chargeItems.updated'));
      } else {
        await apiPost('/api/charge-items', payload);
        setMessage(t('pages.chargeItems.created'));
      }
      setShow(false);
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('app.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: ChargeItem) {
    try {
      await apiPatch(`/api/charge-items/${item.id}`, { isActive: !item.isActive });
      setMessage(
        item.isActive ? t('pages.chargeItems.deactivated') : t('pages.chargeItems.activated'),
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('app.errors.saveFailed'));
    }
  }

  async function removeItem(item: ChargeItem) {
    try {
      await apiDelete(`/api/charge-items/${item.id}`);
      setMessage(t('pages.chargeItems.deleted'));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('app.errors.saveFailed'));
    }
  }

  const activeCount = useMemo(() => items.filter((item) => item.isActive).length, [items]);

  return (
    <div>
      <PageHeader title={t('pages.chargeItems.title')} subtitle={t('pages.chargeItems.subtitle')} />
      <ListPageFrame
        search={{ value: q, onChange: setQ, disabled: !tenantId || tenantLoading }}
        toolbar={
          <>
            <Button type="button" variant="ghost" onClick={() => setShow((s) => !s)}>
              {show ? t('app.actions.cancel') : t('app.actions.manage')}
            </Button>
            <Button type="button" onClick={openCreateForm}>
              {t('pages.chargeItems.new')}
            </Button>
          </>
        }
      >
        {message ? (
          <InlineAlert tone="success" className="mb-4">
            {message}
          </InlineAlert>
        ) : null}
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-amateur-border bg-amateur-canvas px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
              {t('pages.chargeItems.summaryTotal')}
            </p>
            <p className="mt-1 font-display text-2xl font-semibold text-amateur-ink">{items.length}</p>
          </div>
          <div className="rounded-xl border border-amateur-border bg-amateur-canvas px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
              {t('pages.chargeItems.summaryActive')}
            </p>
            <p className="mt-1 font-display text-2xl font-semibold text-amateur-ink">{activeCount}</p>
          </div>
          <div className="rounded-xl border border-amateur-border bg-amateur-canvas px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
              {t('pages.chargeItems.summaryInactive')}
            </p>
            <p className="mt-1 font-display text-2xl font-semibold text-amateur-ink">
              {items.length - activeCount}
            </p>
          </div>
        </div>
        {!tenantId && !tenantLoading ? (
          <p className="text-sm text-amateur-muted">{t('app.errors.needTenant')}</p>
        ) : show ? (
          <form
            onSubmit={create}
            className="mb-6 flex flex-col gap-3 rounded-xl border border-amateur-border bg-amateur-canvas p-4 sm:flex-row sm:flex-wrap sm:items-end"
          >
            <label className="flex min-w-[8rem] flex-1 flex-col gap-1 text-sm">
              <span>{t('pages.chargeItems.name')}</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg border border-amateur-border bg-amateur-surface px-2 py-2"
              />
            </label>
            <label className="flex min-w-[6rem] flex-col gap-1 text-sm">
              <span>{t('pages.chargeItems.category')}</span>
              <input
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-lg border border-amateur-border bg-amateur-surface px-2 py-2"
              />
            </label>
            <label className="flex min-w-[6rem] flex-col gap-1 text-sm">
              <span>{t('pages.chargeItems.amount')}</span>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="rounded-lg border border-amateur-border bg-amateur-surface px-2 py-2"
              />
            </label>
            <label className="flex w-24 flex-col gap-1 text-sm">
              <span>{t('pages.chargeItems.currency')}</span>
              <input
                required
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
                className="rounded-lg border border-amateur-border bg-amateur-surface px-2 py-2"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              {t('pages.chargeItems.active')}
            </label>
            <Button type="submit" disabled={saving}>
              {t('pages.athletes.save')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShow(false);
                resetForm();
              }}
            >
              {t('pages.athletes.cancel')}
            </Button>
          </form>
        ) : null}
        {error ? (
          <InlineAlert tone="error" className="mb-4">
            {error}
          </InlineAlert>
        ) : null}
        {loading ? (
          <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>
        ) : items.length === 0 ? (
          <EmptyState title={t('pages.chargeItems.empty')} hint={t('pages.finance.hubBody')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-amateur-border text-amateur-muted">
                  <th className="pb-2 font-medium">{t('pages.chargeItems.name')}</th>
                  <th className="pb-2 font-medium">{t('pages.chargeItems.category')}</th>
                  <th className="pb-2 font-medium">{t('pages.chargeItems.amount')}</th>
                  <th className="pb-2 font-medium">{t('pages.chargeItems.active')}</th>
                  <th className="pb-2 font-medium">{t('app.actions.manage')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className="border-b border-amateur-border/70 last:border-0">
                    <td className="py-3 font-medium">{c.name}</td>
                    <td className="py-3 text-amateur-muted">{c.category}</td>
                    <td className="py-3">
                      {c.currency} {c.defaultAmount}
                    </td>
                    <td className="py-3">
                      {c.isActive ? t('pages.chargeItems.activeState') : t('pages.chargeItems.inactiveState')}
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="ghost" onClick={() => openEditForm(c)}>
                          {t('pages.athletes.edit')}
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => void toggleActive(c)}>
                          {c.isActive
                            ? t('pages.chargeItems.deactivateAction')
                            : t('pages.chargeItems.activateAction')}
                        </Button>
                        <button
                          type="button"
                          onClick={() => void removeItem(c)}
                          className="text-sm font-medium text-amateur-muted transition hover:text-red-700"
                        >
                          {t('pages.athletes.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ListPageFrame>
    </div>
  );
}
