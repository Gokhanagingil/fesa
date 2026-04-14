import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ListPageFrame } from '../components/ui/ListPageFrame';
import { PageHeader } from '../components/ui/PageHeader';
import { apiGet } from '../lib/api';
import { getPersonName } from '../lib/display';
import type { Guardian } from '../lib/domain-types';
import { useTenant } from '../lib/tenant-hooks';

type GuardianListResponse = { items: Guardian[]; total: number };

export function GuardiansPage() {
  const { t } = useTranslation();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Guardian[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div>
      <PageHeader title={t('pages.guardians.title')} subtitle={t('pages.guardians.subtitle')} />
      <ListPageFrame
        search={{ value: q, onChange: setQ, disabled: !tenantId || tenantLoading }}
        toolbar={
          <Link to="/app/guardians/new">
            <Button>{t('pages.guardians.new')}</Button>
          </Link>
        }
      >
        {!tenantId && !tenantLoading ? (
          <p className="text-sm text-amateur-muted">{t('app.errors.needTenant')}</p>
        ) : error ? (
          <p className="text-sm text-red-700">{error}</p>
        ) : loading ? (
          <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>
        ) : items.length === 0 ? (
          <EmptyState title={t('pages.guardians.empty')} hint={t('pages.guardians.emptyHint')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-amateur-border text-amateur-muted">
                  <th className="pb-2 pr-4 font-medium">{t('pages.guardians.name')}</th>
                  <th className="pb-2 pr-4 font-medium">{t('pages.athletes.phone')}</th>
                  <th className="pb-2 pr-4 font-medium">{t('pages.athletes.email')}</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {items.map((guardian) => (
                  <tr key={guardian.id} className="border-b border-amateur-border/70 last:border-0">
                    <td className="py-3 pr-4 font-medium text-amateur-ink">{getPersonName(guardian)}</td>
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
        )}
      </ListPageFrame>
    </div>
  );
}
