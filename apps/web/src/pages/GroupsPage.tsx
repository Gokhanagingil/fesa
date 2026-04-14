import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ListPageFrame } from '../components/ui/ListPageFrame';
import { PageHeader } from '../components/ui/PageHeader';
import { apiGet } from '../lib/api';
import type { ClubGroup } from '../lib/domain-types';
import { useTenant } from '../lib/tenant-hooks';

export function GroupsPage() {
  const { t } = useTranslation();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [query, setQuery] = useState('');
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

  const filteredItems = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (group) =>
        group.name.toLowerCase().includes(term) ||
        group.sportBranch?.name?.toLowerCase().includes(term) ||
        group.teams?.some((team) => team.name.toLowerCase().includes(term)),
    );
  }, [items, query]);

  return (
    <div>
      <PageHeader title={t('pages.groups.title')} subtitle={t('pages.groups.subtitle')} />
      <p className="mb-4 max-w-2xl text-sm text-amateur-muted">{t('pages.groups.memberHint')}</p>
      <ListPageFrame
        search={{ value: query, onChange: setQuery, disabled: !tenantId || tenantLoading }}
        toolbar={
          <Link to="/app/athletes">
            <Button variant="ghost">{t('pages.groups.openAthletes')}</Button>
          </Link>
        }
      >
        {!tenantId && !tenantLoading ? (
          <p className="text-sm text-amateur-muted">{t('app.errors.needTenant')}</p>
        ) : error ? (
          <p className="text-sm text-red-700">{error}</p>
        ) : loading ? (
          <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>
        ) : filteredItems.length === 0 ? (
          <EmptyState title={t('pages.groups.empty')} hint={t('pages.groups.emptyHint')} />
        ) : (
          <div className="grid gap-4">
            {filteredItems.map((group) => (
              <section
                key={group.id}
                className="rounded-2xl border border-amateur-border bg-amateur-canvas/50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-semibold text-amateur-ink">{group.name}</h3>
                    <p className="mt-1 text-sm text-amateur-muted">
                      {group.sportBranch?.name ?? '—'} ·{' '}
                      {t('pages.groups.teamCount', { count: group.teams?.length ?? 0 })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/app/athletes?groupId=${group.id}`}
                      className="text-sm font-medium text-amateur-accent hover:underline"
                    >
                      {t('pages.groups.viewAthletes')}
                    </Link>
                    <Link
                      to="/app/training/new"
                      className="text-sm font-medium text-amateur-accent hover:underline"
                    >
                      {t('pages.groups.planSession')}
                    </Link>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                  <div className="rounded-xl border border-amateur-border bg-amateur-surface p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
                      {t('pages.groups.structureTitle')}
                    </p>
                    <p className="mt-2 text-sm text-amateur-muted">{t('pages.groups.memberHint')}</p>
                  </div>
                  <div className="rounded-xl border border-amateur-border bg-amateur-surface p-4 lg:min-w-[16rem]">
                    <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
                      {t('pages.teams.title')}
                    </p>
                    {group.teams && group.teams.length > 0 ? (
                      <ul className="mt-2 space-y-2 text-sm text-amateur-ink">
                        {group.teams.map((team) => (
                          <li key={team.id}>
                            <Link to={`/app/athletes?teamId=${team.id}`} className="hover:text-amateur-accent">
                              {team.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-amateur-muted">{t('pages.groups.noTeams')}</p>
                    )}
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
      </ListPageFrame>
    </div>
  );
}
