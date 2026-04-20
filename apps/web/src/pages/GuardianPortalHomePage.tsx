import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiGet } from '../lib/api';
import type { ClubUpdateParentSummary, GuardianPortalHome } from '../lib/domain-types';
import {
  formatDateTime,
  getFamilyActionStatusLabel,
  getFamilyActionTypeLabel,
  getGuardianRelationshipLabel,
  getMoneyAmount,
} from '../lib/display';
import { InlineAlert } from '../components/ui/InlineAlert';
import { usePortalBranding } from '../lib/portal-branding';
import { PortalBrandMark } from '../components/ui/PortalBrandMark';

/**
 * Parent home / family dashboard.
 *
 * Information architecture (mobile-first, calm, utility-first):
 *   1. A warm, branded greeting + the club's safe welcome copy if set.
 *   2. "What needs your attention" — only renders when something actually
 *      does. We never show empty pending counters; that would only add
 *      noise for a parent.
 *   3. "Today" — a tiny, scannable summary of training/lessons happening
 *      today for any of the family's athletes. Quietly hidden when empty.
 *   4. "My family" — one card per linked athlete with the few things a
 *      parent wants at a glance (group, next training, balance).
 *   5. "Updates from the club" — a subtle showcase strip. No popups, no
 *      banner spam, no marketing chaos. Always last on the screen.
 */
export function GuardianPortalHomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { setBranding } = usePortalBranding();
  const [data, setData] = useState<GuardianPortalHome | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const next = await apiGet<GuardianPortalHome>('/api/guardian-portal/me');
        setData(next);
        if (next.branding) {
          setBranding(next.branding);
        }
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
  }, [navigate, setBranding, t]);

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
      <div className="space-y-4">
        {error ? (
          <InlineAlert tone="error">{error}</InlineAlert>
        ) : (
          <InlineAlert tone="info">{t('portal.home.empty')}</InlineAlert>
        )}
      </div>
    );
  }

  const branding = data.branding ?? null;
  const greetingFirstName = data.guardian.name.split(' ')[0] || data.guardian.name;
  const todayTraining = data.today?.training ?? [];
  const todayLessons = data.today?.privateLessons ?? [];
  const hasToday = todayTraining.length + todayLessons.length > 0;
  const hasOutstanding = data.finance.outstandingAthletes > 0 || data.finance.overdueAthletes > 0;

  return (
    <div className="space-y-6">
      <section
        className="overflow-hidden rounded-3xl border border-amateur-border bg-amateur-surface p-5 shadow-sm sm:p-6"
        style={{
          backgroundImage:
            'linear-gradient(135deg, var(--portal-primary-soft, transparent) 0%, transparent 70%)',
        }}
      >
        <div className="flex items-start gap-4">
          <PortalBrandMark branding={branding} size="md" className="hidden sm:inline-flex" />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
              {branding?.displayName ?? t('portal.brand')}
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-amateur-ink sm:text-3xl">
              {t('portal.home.greeting', { name: greetingFirstName })}
            </h1>
            {branding?.welcomeTitle ? (
              <p className="mt-3 font-display text-lg text-amateur-ink/90">{branding.welcomeTitle}</p>
            ) : null}
            <p className="mt-2 max-w-prose text-sm text-amateur-muted">
              {branding?.welcomeMessage ?? t('portal.home.welcomeFallback')}
            </p>
          </div>
        </div>
      </section>

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

      {pendingActions.length > 0 || awaitingReview.length > 0 || hasOutstanding ? (
        <section
          className="rounded-3xl border bg-amateur-surface p-5 shadow-sm"
          style={{
            borderColor: 'var(--portal-ring-soft, var(--color-amateur-border))',
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-base font-semibold text-amateur-ink">
              {t('portal.home.attentionTitle')}
            </h2>
            <span className="text-xs text-amateur-muted">{t('portal.home.attentionHint')}</span>
          </div>
          <ul className="mt-3 space-y-2">
            {pendingActions.slice(0, 3).map((action) => (
              <li key={action.id}>
                <Link
                  to={`/portal/actions/${action.id}`}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-3 transition-colors hover:bg-amateur-surface"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-amateur-ink">{action.title}</p>
                    <p className="mt-1 text-xs text-amateur-muted">
                      {[action.athleteName, getFamilyActionTypeLabel(t, action.type)]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold"
                    style={{
                      backgroundColor: 'var(--portal-primary-soft, #e3f4ee)',
                      color: 'var(--portal-primary, #0d4a3c)',
                    }}
                  >
                    {t('portal.home.actionOpen')}
                  </span>
                </Link>
              </li>
            ))}
            {awaitingReview.length > 0 ? (
              <li className="rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-3 text-sm text-amateur-muted">
                {t('portal.home.awaitingReviewLine', { count: awaitingReview.length })}
              </li>
            ) : null}
            {hasOutstanding ? (
              <li className="rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-3 text-sm text-amateur-muted">
                {t('portal.home.financeLine', {
                  outstanding: data.finance.outstandingAthletes,
                  overdue: data.finance.overdueAthletes,
                })}
              </li>
            ) : null}
          </ul>
        </section>
      ) : (
        <section className="rounded-3xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
          <h2 className="font-display text-base font-semibold text-amateur-ink">
            {t('portal.home.allClearTitle')}
          </h2>
          <p className="mt-1 text-sm text-amateur-muted">{t('portal.home.allClearBody')}</p>
        </section>
      )}

      {hasToday ? (
        <section className="rounded-3xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
          <h2 className="font-display text-base font-semibold text-amateur-ink">
            {t('portal.home.todayTitle')}
          </h2>
          <p className="mt-1 text-sm text-amateur-muted">{t('portal.home.todayHint')}</p>
          <ul className="mt-3 space-y-2">
            {todayTraining.map((session) => (
              <li
                key={session.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-amateur-ink">
                    {session.title ?? t('portal.home.trainingDefault')}
                  </p>
                  <p className="mt-1 text-xs text-amateur-muted">
                    {[
                      formatDateTime(session.scheduledStart, i18n.language),
                      session.location ?? null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-amateur-muted">
                  {t('portal.home.todayBadgeTraining')}
                </span>
              </li>
            ))}
            {todayLessons.map((lesson) => (
              <li
                key={lesson.id}
                className="flex items-start justify-between gap-3 rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-amateur-ink">
                    {lesson.athleteName ?? t('portal.home.privateLessonDefault')}
                  </p>
                  <p className="mt-1 text-xs text-amateur-muted">
                    {[
                      formatDateTime(lesson.scheduledStart, i18n.language),
                      lesson.coachName ?? null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-amateur-muted">
                  {t('portal.home.todayBadgeLesson')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        id="family"
        className="rounded-3xl border border-amateur-border bg-amateur-surface p-5 shadow-sm scroll-mt-24"
      >
        <h2 className="font-display text-base font-semibold text-amateur-ink">
          {t('portal.home.familyTitle')}
        </h2>
        <p className="mt-1 text-sm text-amateur-muted">{t('portal.home.familyHint')}</p>
        {data.linkedAthletes.length === 0 ? (
          <p className="mt-4 text-sm text-amateur-muted">{t('portal.home.familyEmpty')}</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {data.linkedAthletes.map((athlete) => (
              <li
                key={athlete.linkId}
                className="rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium text-amateur-ink">
                      {athlete.athleteName}
                    </p>
                    <p className="mt-1 text-xs text-amateur-muted">
                      {[
                        getGuardianRelationshipLabel(t, athlete.relationshipType),
                        athlete.groupName,
                        athlete.isPrimaryContact ? t('portal.home.primaryContact') : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  {Number(athlete.outstandingAmount) > 0 ? (
                    <div className="shrink-0 text-right">
                      <p className="text-[11px] uppercase tracking-wide text-amateur-muted">
                        {t('portal.home.outstanding')}
                      </p>
                      <p className="text-sm font-semibold text-amateur-ink">
                        {getMoneyAmount(athlete.outstandingAmount, 'TRY')}
                      </p>
                      {Number(athlete.overdueAmount) > 0 ? (
                        <p className="text-[11px] font-medium text-rose-600">
                          {t('portal.home.overdue')}{' '}
                          {getMoneyAmount(athlete.overdueAmount, 'TRY')}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {athlete.nextTraining.length > 0 ? (
                  <p className="mt-3 text-xs text-amateur-muted">
                    {t('portal.home.nextTraining')}:{' '}
                    {athlete.nextTraining
                      .map(
                        (session) =>
                          `${session.title} · ${formatDateTime(session.scheduledStart, i18n.language)}`,
                      )
                      .join(' · ')}
                  </p>
                ) : null}
                {athlete.nextPrivateLesson ? (
                  <p className="mt-1 text-xs text-amateur-muted">
                    {t('portal.home.nextLesson')}:{' '}
                    {[
                      formatDateTime(athlete.nextPrivateLesson.scheduledStart, i18n.language),
                      athlete.nextPrivateLesson.coachName,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.actions.length > 0 ? (
        <section className="rounded-3xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
          <h2 className="font-display text-base font-semibold text-amateur-ink">
            {t('portal.home.allRequestsTitle')}
          </h2>
          <p className="mt-1 text-sm text-amateur-muted">{t('portal.home.allRequestsHint')}</p>
          <ul className="mt-3 space-y-2">
            {data.actions.map((action) => (
              <li key={action.id}>
                <Link
                  to={`/portal/actions/${action.id}`}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-3 transition-colors hover:bg-amateur-surface"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-amateur-ink">{action.title}</p>
                    <p className="mt-1 text-xs text-amateur-muted">
                      {[action.athleteName, getFamilyActionStatusLabel(t, action.status)]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ClubUpdatesStrip
        updates={data.clubUpdates ?? []}
        fallbackTitle={branding?.welcomeTitle ?? null}
        fallbackBody={branding?.welcomeMessage ?? null}
      />
    </div>
  );
}

/**
 * Parent Portal v1.1 — calm "From the club" strip.
 *
 * Renders the small slice of published, in-window club updates that the
 * API allows us to show. The visual treatment is deliberately subtle —
 * soft brand-aware accents, a clear category pill, and never more than
 * one card width — so this never feels like a marketing feed. When the
 * club has not published anything yet, we fall back to the welcome
 * message they configured, or a single calm line if they haven't set
 * one of those either.
 */
function ClubUpdatesStrip({
  updates,
  fallbackTitle,
  fallbackBody,
}: {
  updates: ClubUpdateParentSummary[];
  fallbackTitle: string | null;
  fallbackBody: string | null;
}) {
  const { t, i18n } = useTranslation();

  if (updates.length === 0) {
    return (
      <section
        id="updates"
        className="rounded-3xl border border-dashed border-amateur-border bg-amateur-surface/60 p-5 text-sm text-amateur-muted scroll-mt-24"
      >
        <p className="font-medium text-amateur-ink">
          {fallbackTitle ?? t('portal.home.updatesTitle')}
        </p>
        <p className="mt-1">{fallbackBody ?? t('portal.home.updatesPlaceholder')}</p>
      </section>
    );
  }

  return (
    <section
      id="updates"
      className="rounded-3xl border border-amateur-border bg-amateur-surface p-5 shadow-sm scroll-mt-24"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-amateur-ink">
          {t('portal.home.clubUpdatesTitle')}
        </h2>
        <span className="text-xs text-amateur-muted">{t('portal.home.clubUpdatesHint')}</span>
      </div>
      <ul className="mt-3 space-y-3">
        {updates.map((item) => (
          <li
            key={item.id}
            className="rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-4"
            style={{
              boxShadow: item.pinned ? '0 0 0 1px var(--portal-ring-soft, transparent) inset' : undefined,
            }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
                style={{
                  backgroundColor: 'var(--portal-primary-soft, #e3f4ee)',
                  color: 'var(--portal-primary, #0d4a3c)',
                }}
              >
                {t(`portal.home.clubUpdateCategory.${item.category}`)}
              </span>
              {item.pinned ? (
                <span className="text-[11px] font-medium text-amateur-muted">
                  {t('portal.home.clubUpdatePinned')}
                </span>
              ) : null}
              {item.publishedAt ? (
                <span className="ml-auto text-[11px] text-amateur-muted">
                  {formatDateTime(item.publishedAt, i18n.language)}
                </span>
              ) : null}
            </div>
            <p className="mt-2 font-display text-sm font-semibold text-amateur-ink">{item.title}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-amateur-muted">{item.body}</p>
            {item.linkUrl ? (
              <a
                href={item.linkUrl}
                rel="noreferrer noopener"
                target={item.linkUrl.startsWith('http') ? '_blank' : undefined}
                className="mt-3 inline-flex items-center text-xs font-semibold"
                style={{ color: 'var(--portal-primary, #0d4a3c)' }}
              >
                {item.linkLabel ?? t('portal.home.clubUpdateOpenLink')}
                <span aria-hidden="true" className="ml-1">→</span>
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
