import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ListPageFrame } from '../components/ui/ListPageFrame';
import { PageHeader } from '../components/ui/PageHeader';
import { apiGet } from '../lib/api';
import { useTenant } from '../lib/tenant-hooks';
import type { TrainingSession } from '../lib/domain-types';

type ListResponse = { items: TrainingSession[]; total: number };

export function TrainingSessionsPage() {
  const { t } = useTranslation();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [items, setItems] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<ListResponse>('/api/training-sessions?limit=100');
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
      <PageHeader title={t('pages.training.title')} subtitle={t('pages.training.subtitle')} />
      <ListPageFrame
        toolbar={
          <>
            <Button variant="ghost" disabled>
              {t('app.actions.filter')}
            </Button>
            <Link to="/app/training/new">
              <Button>{t('pages.training.new')}</Button>
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
          <EmptyState title={t('pages.training.empty')} hint={t('pages.training.emptyHint')} />
        ) : (
          <ul className="divide-y divide-amateur-border">
            {items.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-medium text-amateur-ink">{s.title}</p>
                  <p className="text-sm text-amateur-muted">
                    {new Date(s.scheduledStart).toLocaleString()} — {new Date(s.scheduledEnd).toLocaleString()}
                  </p>
                  {s.location ? (
                    <p className="text-xs text-amateur-muted">
                      {t('pages.training.location')}: {s.location}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amateur-accent-soft px-3 py-1 text-xs font-medium capitalize text-amateur-accent">
                    {s.status}
                  </span>
                  <Link
                    to={`/app/training/${s.id}`}
                    className="text-sm font-semibold text-amateur-accent hover:underline"
                  >
                    {t('pages.training.attendance')} →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ListPageFrame>
    </div>
  );
}
