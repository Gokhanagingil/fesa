import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { InlineAlert } from '../components/ui/InlineAlert';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { apiGet } from '../lib/api';
import { getFamilyActionStatusLabel, getFamilyReadinessStatusLabel, getFamilyReadinessTone, getGuardianRelationshipSummary, getPersonName } from '../lib/display';
import type { AthleteGuardianLink, Guardian, GuardianFamilyReadiness } from '../lib/domain-types';
import { useTenant } from '../lib/tenant-hooks';

export function GuardianDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const { tenantId } = useTenant();
  const [guardian, setGuardian] = useState<Guardian | null>(null);
  const [links, setLinks] = useState<AthleteGuardianLink[]>([]);
  const [readiness, setReadiness] = useState<GuardianFamilyReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId || !id) return;
    setLoading(true);
    setError(null);
    try {
      const [guardianRes, athletesRes, readinessRes] = await Promise.all([
        apiGet<Guardian>(`/api/guardians/${id}`),
        apiGet<AthleteGuardianLink[]>(`/api/guardians/${id}/athletes`),
        apiGet<GuardianFamilyReadiness>(`/api/guardians/${id}/family-readiness`),
      ]);
      setGuardian(guardianRes);
      setLinks(athletesRes);
      setReadiness(readinessRes);
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

  const readinessStatus = readiness?.status ?? 'incomplete';
  const readinessTone = getFamilyReadinessTone(readinessStatus);

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

      {error ? (
        <InlineAlert tone="error" className="mb-4">
          {error}
        </InlineAlert>
      ) : null}

      <section className="mb-6 rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-amateur-accent">{t('pages.guardians.familyReadiness.title')}</p>
            <h2 className="mt-1 font-display text-lg font-semibold text-amateur-ink">
              {t('pages.guardians.familyReadiness.subtitle')}
            </h2>
            <p className="mt-2 text-sm text-amateur-muted">
              {t('pages.guardians.familyReadiness.statusLine', {
                status: getFamilyReadinessStatusLabel(t, readinessStatus),
              })}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              readinessTone === 'danger'
                ? 'bg-amber-100 text-amber-700'
                : readinessTone === 'success'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-700'
            }`}
          >
            {getFamilyReadinessStatusLabel(t, readinessStatus)}
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <StatCard label={t('pages.guardians.familyReadiness.linkedAthletes')} value={readiness?.summary.linkedAthletes ?? links.length} compact />
          <StatCard label={t('pages.guardians.familyReadiness.primaryRelationships')} value={readiness?.summary.primaryRelationships ?? 0} compact />
          <StatCard
            label={t('pages.guardians.familyReadiness.awaitingGuardian')}
            value={readiness?.summary.athletesAwaitingGuardianAction ?? 0}
            compact
            tone={(readiness?.summary.athletesAwaitingGuardianAction ?? 0) > 0 ? 'danger' : 'default'}
          />
          <StatCard
            label={t('pages.guardians.familyReadiness.awaitingReview')}
            value={readiness?.summary.athletesAwaitingStaffReview ?? 0}
            compact
            tone={(readiness?.summary.athletesAwaitingStaffReview ?? 0) > 0 ? 'danger' : 'default'}
          />
        </div>
        {readiness?.actions.length ? (
          <div className="mt-4 rounded-xl border border-amateur-border bg-amateur-canvas p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
              {t('pages.guardians.familyReadiness.openActions')}
            </p>
            <ul className="mt-3 space-y-3">
              {readiness.actions.slice(0, 4).map((action) => (
                <li key={action.id} className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-amateur-ink">{action.title}</p>
                      <p className="mt-1 text-sm text-amateur-muted">
                        {[action.athleteName, getFamilyActionStatusLabel(t, action.status)].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <Link
                      to={`/app/athletes/${action.athleteId}#family-actions`}
                      className="text-sm font-medium text-amateur-accent hover:underline"
                    >
                      {t('pages.guardians.familyReadiness.openAthlete')}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

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
