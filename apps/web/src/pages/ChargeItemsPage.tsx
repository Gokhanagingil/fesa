import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ListPageFrame } from '../components/ui/ListPageFrame';
import { PageHeader } from '../components/ui/PageHeader';
import { apiGet, apiPost } from '../lib/api';
import { useTenant } from '../lib/tenant-hooks';
import type { ChargeItem } from '../lib/domain-types';

export function ChargeItemsPage() {
  const { t } = useTranslation();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [items, setItems] = useState<ChargeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('dues');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('TRY');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<{ items: ChargeItem[] }>('/api/charge-items?limit=200');
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [tenantId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPost('/api/charge-items', {
        name,
        category,
        defaultAmount: parseFloat(amount),
        currency,
      });
      setShow(false);
      setName('');
      setAmount('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('app.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title={t('pages.chargeItems.title')} subtitle={t('pages.chargeItems.subtitle')} />
      <ListPageFrame
        toolbar={
          <>
            <Button variant="ghost" disabled>
              {t('app.actions.filter')}
            </Button>
            <Button type="button" onClick={() => setShow((s) => !s)}>
              {t('pages.chargeItems.new')}
            </Button>
          </>
        }
      >
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
            <Button type="submit" disabled={saving}>
              {t('pages.athletes.save')}
            </Button>
          </form>
        ) : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
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
                    <td className="py-3">{c.isActive ? '✓' : '—'}</td>
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
