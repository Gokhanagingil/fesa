import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ListPageFrame } from '../components/ui/ListPageFrame';
import { PageHeader } from '../components/ui/PageHeader';
import { apiGet } from '../lib/api';
import { useTenant } from '../lib/tenant-hooks';

type TeamRow = {
  id: string;
  name: string;
  code: string | null;
  sportBranch?: { name: string };
  group?: { name: string } | null;
};

export function TeamsPage() {
  const { t } = useTranslation();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [items, setItems] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<{ items: TeamRow[] }>('/api/teams?limit=200');
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
      <PageHeader title={t('pages.teams.title')} subtitle={t('pages.teams.subtitle')} />
      <ListPageFrame
        toolbar={
          <>
            <Button variant="ghost" disabled>
              {t('app.actions.filter')}
            </Button>
            <Button variant="ghost" disabled>
              {t('app.actions.export')}
            </Button>
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
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-amateur-border text-amateur-muted">
                  <th className="pb-2 font-medium">{t('pages.teams.title')}</th>
                  <th className="pb-2 font-medium">{t('pages.groups.title')}</th>
                  <th className="pb-2 font-medium">{t('pages.athletes.branch')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((x) => (
                  <tr key={x.id} className="border-b border-amateur-border/70 last:border-0">
                    <td className="py-3 font-medium">
                      {x.name}
                      {x.code ? <span className="ml-2 text-amateur-muted">({x.code})</span> : null}
                    </td>
                    <td className="py-3 text-amateur-muted">{x.group?.name ?? '—'}</td>
                    <td className="py-3 text-amateur-muted">{x.sportBranch?.name ?? '—'}</td>
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
