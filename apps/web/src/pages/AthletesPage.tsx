import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ListPageFrame } from '../components/ui/ListPageFrame';
import { PageHeader } from '../components/ui/PageHeader';
import { apiGet } from '../lib/api';
import { useTenant } from '../lib/tenant-hooks';
import type { Athlete } from '../lib/domain-types';

type ListResponse = { items: Athlete[]; total: number };

export function AthletesPage() {
  const { t } = useTranslation();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Athlete[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      params.set('limit', '100');
      const path = `/api/athletes?${params.toString()}`;
      const res = await apiGet<ListResponse>(path);
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [tenantId, q, t]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 250);
    return () => clearTimeout(id);
  }, [load]);

  return (
    <div>
      <PageHeader title={t('pages.athletes.title')} subtitle={t('pages.athletes.subtitle')} />
      <ListPageFrame
        search={{ value: q, onChange: setQ, disabled: !tenantId || tenantLoading }}
        toolbar={
          <>
            <Button variant="ghost" disabled>
              {t('app.actions.filter')}
            </Button>
            <Button variant="ghost" disabled>
              {t('app.actions.export')}
            </Button>
            <Link to="/app/athletes/new">
              <Button>{t('pages.athletes.new')}</Button>
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
          <EmptyState title={t('pages.athletes.empty')} hint={t('pages.athletes.emptyHint')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-amateur-border text-amateur-muted">
                  <th className="pb-2 pr-4 font-medium">{t('pages.athletes.lastName')}</th>
                  <th className="pb-2 pr-4 font-medium">{t('pages.athletes.firstName')}</th>
                  <th className="pb-2 pr-4 font-medium">{t('pages.athletes.status')}</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id} className="border-b border-amateur-border/70 last:border-0">
                    <td className="py-3 pr-4 font-medium text-amateur-ink">{a.lastName}</td>
                    <td className="py-3 pr-4">{a.firstName}</td>
                    <td className="py-3 pr-4 capitalize text-amateur-muted">{a.status}</td>
                    <td className="py-3 text-right">
                      <Link
                        to={`/app/athletes/${a.id}`}
                        className="font-medium text-amateur-accent hover:underline"
                      >
                        {t('pages.athletes.detailTitle')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-amateur-muted">
              {total} {total === 1 ? 'row' : 'rows'}
            </p>
          </div>
        )}
      </ListPageFrame>
    </div>
  );
}
