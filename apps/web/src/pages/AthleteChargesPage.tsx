import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ListPageFrame } from '../components/ui/ListPageFrame';
import { PageHeader } from '../components/ui/PageHeader';
import { apiGet } from '../lib/api';
import { useTenant } from '../lib/tenant-hooks';
import type { AthleteCharge } from '../lib/domain-types';

export function AthleteChargesPage() {
  const { t } = useTranslation();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [items, setItems] = useState<AthleteCharge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<{ items: AthleteCharge[] }>('/api/athlete-charges?limit=200');
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

  return (
    <div>
      <PageHeader title={t('pages.athleteCharges.title')} subtitle={t('pages.athleteCharges.subtitle')} />
      <ListPageFrame
        toolbar={
          <>
            <Button variant="ghost" disabled>
              {t('app.actions.filter')}
            </Button>
            <Link to="/app/athletes">
              <Button variant="ghost">{t('pages.athletes.title')}</Button>
            </Link>
          </>
        }
      >
        {!tenantId && !tenantLoading ? (
          <p className="text-sm text-amateur-muted">{t('app.errors.needTenant')}</p>
        ) : error ? (
          <p className="text-sm text-red-700">{error}</p>
        ) : loading ? (
          <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>
        ) : items.length === 0 ? (
          <EmptyState title={t('pages.athleteCharges.empty')} hint={t('pages.finance.hubBody')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-amateur-border text-amateur-muted">
                  <th className="pb-2 font-medium">{t('pages.athleteCharges.item')}</th>
                  <th className="pb-2 font-medium">{t('pages.athleteCharges.amount')}</th>
                  <th className="pb-2 font-medium">{t('pages.athleteCharges.due')}</th>
                  <th className="pb-2 font-medium">{t('pages.athleteCharges.status')}</th>
                  <th className="pb-2 font-medium">{t('pages.athleteCharges.athlete')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className="border-b border-amateur-border/70 last:border-0">
                    <td className="py-3 font-medium">{c.chargeItem?.name ?? c.chargeItemId}</td>
                    <td className="py-3">
                      {c.chargeItem ? `${c.chargeItem.currency} ` : ''}
                      {c.amount}
                    </td>
                    <td className="py-3">{c.dueDate ? c.dueDate.slice(0, 10) : '—'}</td>
                    <td className="py-3 capitalize text-amateur-muted">{c.status}</td>
                    <td className="py-3">
                      <Link
                        to={`/app/athletes/${c.athleteId}`}
                        className="font-medium text-amateur-accent hover:underline"
                      >
                        {t('pages.athletes.detailTitle')}
                      </Link>
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
