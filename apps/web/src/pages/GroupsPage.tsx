import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ListPageFrame } from '../components/ui/ListPageFrame';
import { PageHeader } from '../components/ui/PageHeader';
import { apiGet } from '../lib/api';
import { useTenant } from '../lib/tenant-hooks';

type ClubGroup = {
  id: string;
  name: string;
  sportBranch?: { name: string };
  teams?: { id: string; name: string }[];
};

export function GroupsPage() {
  const { t } = useTranslation();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [items, setItems] = useState<ClubGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<{ items: ClubGroup[] }>('/api/groups?limit=200');
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
      <PageHeader title={t('pages.groups.title')} subtitle={t('pages.groups.subtitle')} />
      <p className="mb-4 max-w-2xl text-sm text-amateur-muted">{t('pages.groups.memberHint')}</p>
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
          <ul className="divide-y divide-amateur-border">
            {items.map((g) => (
              <li key={g.id} className="py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-display text-base font-semibold text-amateur-ink">{g.name}</h3>
                  {g.sportBranch ? (
                    <span className="text-xs text-amateur-muted">{g.sportBranch.name}</span>
                  ) : null}
                </div>
                {g.teams && g.teams.length > 0 ? (
                  <p className="mt-2 text-sm text-amateur-muted">
                    {g.teams.map((x) => x.name).join(', ')}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-amateur-muted">—</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </ListPageFrame>
    </div>
  );
}
