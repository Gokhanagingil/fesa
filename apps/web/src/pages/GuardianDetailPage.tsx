import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { apiGet } from '../lib/api';
import { getGuardianRelationshipSummary, getPersonName } from '../lib/display';
import type { AthleteGuardianLink, Guardian } from '../lib/domain-types';
import { useTenant } from '../lib/tenant-hooks';

export function GuardianDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { tenantId } = useTenant();
  const [guardian, setGuardian] = useState<Guardian | null>(null);
  const [links, setLinks] = useState<AthleteGuardianLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId || !id) return;
    setLoading(true);
    setError(null);
    try {
      const [guardianRes, athletesRes] = await Promise.all([
        apiGet<Guardian>(`/api/guardians/${id}`),
        apiGet<AthleteGuardianLink[]>(`/api/guardians/${id}/athletes`),
      ]);
      setGuardian(guardianRes);
      setLinks(athletesRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [id, t, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !guardian) {
    return (
      <div>
        <PageHeader title={t('pages.guardians.detailTitle')} subtitle="" />
        <p className="text-sm text-amateur-muted">{error ?? t('app.states.loading')}</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={getPersonName(guardian)}
        subtitle={t('pages.guardians.detailTitle')}
        actions={
          <Link to={`/app/guardians/${guardian.id}/edit`}>
            <Button variant="ghost">{t('pages.athletes.edit')}</Button>
          </Link>
        }
      />

      {error ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold text-amateur-ink">
            {t('pages.guardians.contact')}
          </h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <div>
              <dt className="text-amateur-muted">{t('pages.athletes.phone')}</dt>
              <dd>{guardian.phone || '—'}</dd>
            </div>
            <div>
              <dt className="text-amateur-muted">{t('pages.athletes.email')}</dt>
              <dd>{guardian.email || '—'}</dd>
            </div>
            <div>
              <dt className="text-amateur-muted">{t('pages.athletes.notes')}</dt>
              <dd className="whitespace-pre-wrap">{guardian.notes || '—'}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-amateur-ink">
                {t('pages.guardians.linkedAthletes')}
              </h2>
              <p className="mt-1 text-sm text-amateur-muted">{t('pages.guardians.linkedAthletesHint')}</p>
            </div>
            <Link to="/app/athletes">
              <Button variant="ghost">{t('pages.athletes.title')}</Button>
            </Link>
          </div>

          {links.length === 0 ? (
            <div className="mt-4">
              <EmptyState title={t('pages.guardians.noAthletes')} hint={t('pages.guardians.noAthletesHint')} />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-amateur-border">
              {links.map((link) => (
                <li key={link.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium text-amateur-ink">
                      {link.athlete ? getPersonName(link.athlete) : t('pages.guardians.unknownAthlete')}
                    </p>
                    <p className="text-sm text-amateur-muted">{getGuardianRelationshipSummary(t, link)}</p>
                  </div>
                  {link.athlete ? (
                    <Link
                      to={`/app/athletes/${link.athlete.id}`}
                      className="text-sm font-medium text-amateur-accent hover:underline"
                    >
                      {t('pages.athletes.detailTitle')}
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
