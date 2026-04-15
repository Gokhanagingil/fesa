import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiGet } from '../lib/api';
import type { GuardianPortalHome } from '../lib/domain-types';
import {
  formatDate,
  formatDateTime,
  getFamilyActionStatusLabel,
  getFamilyActionTypeLabel,
  getFamilyReadinessStatusLabel,
  getFamilyReadinessTone,
  getGuardianPortalAccessStatusLabel,
  getGuardianPortalAccessTone,
  getGuardianRelationshipLabel,
  getMoneyAmount,
} from '../lib/display';
import { InlineAlert } from '../components/ui/InlineAlert';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';

export function GuardianPortalHomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<GuardianPortalHome | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const next = await apiGet<GuardianPortalHome>('/api/guardian-portal/me');
        setData(next);
      } catch (err) {
        const message = err instanceof Error ? err.message : t('app.errors.loadFailed');
        if (/session|credential|unauthorized/i.test(message)) {
          navigate('/portal/login', { replace: true });
          return;
        }
        setError(message);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, t]);

  const pendingActions = useMemo(
    () =>
      (data?.actions ?? []).filter((item) =>
        ['open', 'pending_family_action', 'rejected'].includes(item.status),
      ),
    [data],
  );
  const awaitingReview = useMemo(
    () => (data?.actions ?? []).filter((item) => ['submitted', 'under_review'].includes(item.status)),
    [data],
  );

  if (loading) {
    return <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>;
  }

  if (!data) {
    return (
      <div className="max-w-3xl">
        <PageHeader title={t('portal.home.title')} subtitle={t('portal.home.subtitle')} />
        {error ? (
          <InlineAlert tone="error">{error}</InlineAlert>
        ) : (
          <InlineAlert tone="info">{t('portal.home.empty')}</InlineAlert>
        )}
      </div>
    );
  }

  const readinessTone = getFamilyReadinessTone(data.readiness.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('portal.home.greeting', { name: data.guardian.name })}
        subtitle={t('portal.home.subtitle')}
        actions={
          <StatusBadge tone={getGuardianPortalAccessTone(data.access.status)}>
            {getGuardianPortalAccessStatusLabel(t, data.access.status)}
          </StatusBadge>
        }
      />

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      <section className="grid gap-3 md:grid-cols-4">
        <StatCard label={t('portal.home.stats.linkedAthletes')} value={data.linkedAthletes.length} compact />
        <StatCard
          label={t('portal.home.stats.pendingActions')}
          value={pendingActions.length}
          compact
          tone={pendingActions.length > 0 ? 'danger' : 'default'}
        />
        <StatCard label={t('portal.home.stats.awaitingReview')} value={awaitingReview.length} compact />
        <StatCard
          label={t('portal.home.stats.outstandingAthletes')}
          value={data.finance.outstandingAthletes}
          compact
        />
      </section>

      <section className="rounded-3xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-amateur-accent">{t('portal.home.readinessBadge')}</p>
            <h2 className="mt-1 font-display text-lg font-semibold text-amateur-ink">
              {t('portal.home.readinessTitle')}
            </h2>
            <p className="mt-2 text-sm text-amateur-muted">
              {t('portal.home.readinessHint', {
                status: getFamilyReadinessStatusLabel(t, data.readiness.status),
              })}
            </p>
          </div>
          <StatusBadge tone={readinessTone}>{getFamilyReadinessStatusLabel(t, data.readiness.status)}</StatusBadge>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-amateur-ink">
                  {t('portal.home.actionsTitle')}
                </h2>
                <p className="mt-1 text-sm text-amateur-muted">{t('portal.home.actionsHint')}</p>
              </div>
            </div>

            {data.actions.length === 0 ? (
              <p className="mt-4 text-sm text-amateur-muted">{t('portal.home.noActions')}</p>
            ) : (
              <div className="mt-4 space-y-3">
                {data.actions.map((action) => (
                  <article
                    key={action.id}
                    className="rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge
                            tone={
                              ['open', 'pending_family_action', 'rejected'].includes(action.status)
                                ? 'warning'
                                : ['submitted', 'under_review'].includes(action.status)
                                  ? 'info'
                                  : 'success'
                            }
                          >
                            {getFamilyActionStatusLabel(t, action.status)}
                          </StatusBadge>
                          <span className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
                            {getFamilyActionTypeLabel(t, action.type)}
                          </span>
                        </div>
                        <h3 className="mt-3 font-medium text-amateur-ink">{action.title}</h3>
                        <p className="mt-1 text-sm text-amateur-muted">
                          {[action.athleteName, action.dueDate ? formatDate(action.dueDate, i18n.language) : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                        {action.description ? (
                          <p className="mt-2 text-sm text-amateur-muted">{action.description}</p>
                        ) : null}
                      </div>
                      <Link to={`/portal/actions/${action.id}`}>
                        <Button variant="ghost">
                          {['open', 'pending_family_action', 'rejected'].includes(action.status)
                            ? t('portal.actions.open')
                            : t('portal.actions.view')}
                        </Button>
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
            <h2 className="font-display text-lg font-semibold text-amateur-ink">
              {t('portal.home.athletesTitle')}
            </h2>
            <p className="mt-1 text-sm text-amateur-muted">{t('portal.home.athletesHint')}</p>
            <div className="mt-4 space-y-3">
              {data.linkedAthletes.map((athlete) => (
                <article key={athlete.linkId} className="rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-amateur-ink">{athlete.athleteName}</h3>
                      <p className="mt-1 text-sm text-amateur-muted">
                        {[
                          getGuardianRelationshipLabel(t, athlete.relationshipType),
                          athlete.groupName,
                          athlete.isPrimaryContact ? t('portal.home.primaryContact') : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <div className="text-right text-sm text-amateur-muted">
                      <p>
                        {t('portal.home.outstanding')}: {getMoneyAmount(athlete.outstandingAmount, 'TRY')}
                      </p>
                      {Number(athlete.overdueAmount) > 0 ? (
                        <p>
                          {t('portal.home.overdue')}: {getMoneyAmount(athlete.overdueAmount, 'TRY')}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {athlete.nextTraining.length > 0 ? (
                    <p className="mt-3 text-sm text-amateur-muted">
                      {t('portal.home.nextTraining')}: {athlete.nextTraining.map((session) => `${session.title} · ${formatDateTime(session.scheduledStart, i18n.language)}`).join(', ')}
                    </p>
                  ) : null}
                  {athlete.nextPrivateLesson ? (
                    <p className="mt-2 text-sm text-amateur-muted">
                      {t('portal.home.nextLesson')}:{' '}
                      {[formatDateTime(athlete.nextPrivateLesson.scheduledStart, i18n.language), athlete.nextPrivateLesson.coachName]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
