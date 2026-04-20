import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiGet } from '../lib/api';
import type {
  ClubUpdateParentSummary,
  GuardianPortalCommunicationContinuity,
  GuardianPortalContinuityMoment,
  GuardianPortalEssential,
  GuardianPortalHome,
  GuardianPortalLandingSummary,
  GuardianPortalPaymentReadiness,
} from '../lib/domain-types';
import {
  formatDate,
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
  const weekItems = data.thisWeek?.items ?? [];
  const hasWeek = weekItems.length > 0;

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

      <FirstLandingWelcome
        landing={data.landing ?? null}
        guardianFirstName={greetingFirstName}
        clubDisplayName={branding?.displayName ?? null}
      />

      <FamilyEssentialsStrip
        landing={data.landing ?? null}
        hasOutstanding={hasOutstanding}
        pendingCount={pendingActions.length}
      />

      <CommunicationContinuityStrip continuity={data.communication ?? null} />

      <PaymentReadinessCard readiness={data.paymentReadiness ?? null} />

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
        <section className="rounded-3xl border border-amateur-border bg-amateur-surface p-5 shadow-sm scroll-mt-24" id="today">
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

      {hasWeek ? (
        <section
          id="this-week"
          className="rounded-3xl border border-amateur-border bg-amateur-surface p-5 shadow-sm scroll-mt-24"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-base font-semibold text-amateur-ink">
              {t('portal.home.thisWeekTitle')}
            </h2>
            <span className="text-xs text-amateur-muted">{t('portal.home.thisWeekHint')}</span>
          </div>
          <ul className="mt-3 space-y-2">
            {weekItems.map((item) => (
              <li
                key={`${item.kind}-${item.id}`}
                className="flex items-start justify-between gap-3 rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-amateur-ink">
                    {item.kind === 'training'
                      ? item.title ?? t('portal.home.trainingDefault')
                      : item.athleteName ?? t('portal.home.privateLessonDefault')}
                  </p>
                  <p className="mt-1 text-xs text-amateur-muted">
                    {[
                      formatDateTime(item.scheduledStart, i18n.language),
                      item.kind === 'training' ? item.location : item.coachName,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-amateur-muted">
                  {item.kind === 'training'
                    ? t('portal.home.todayBadgeTraining')
                    : t('portal.home.todayBadgeLesson')}
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
                {athlete.inventoryInHand && athlete.inventoryInHand.length > 0 ? (
                  <div className="mt-3 rounded-xl border border-dashed border-amateur-border bg-amateur-surface/60 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-amateur-muted">
                      {t('portal.home.inventoryTitle')}
                    </p>
                    <ul className="mt-1 space-y-0.5 text-xs text-amateur-ink">
                      {athlete.inventoryInHand.map((row) => (
                        <li key={row.id} className="flex items-baseline justify-between gap-3">
                          <span className="truncate">
                            {row.itemName}
                            {row.variantLabel && row.variantLabel !== 'Default'
                              ? ` · ${row.variantLabel}`
                              : ''}
                          </span>
                          {row.quantity > 1 ? (
                            <span className="shrink-0 text-amateur-muted">
                              {t('portal.home.inventoryQuantity', { count: row.quantity })}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
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
 * Family Activation & Landing Pack v1 — calm first-landing welcome.
 *
 * Rendered for ~14 days after activation, on the very first session
 * after a parent activates their account. We deliberately keep this
 * tiny: a warm one-line welcome, the family's first name, and the
 * club's display name so the parent feels recognised. There is no
 * onboarding wizard, no progress bar, and no "you have N steps to
 * complete" gauntlet — just a soft, confident "you're in the right
 * place" message that disappears on its own once the family settles in.
 */
function FirstLandingWelcome({
  landing,
  guardianFirstName,
  clubDisplayName,
}: {
  landing: GuardianPortalLandingSummary | null;
  guardianFirstName: string;
  clubDisplayName: string | null;
}) {
  const { t } = useTranslation();
  if (!landing || !landing.firstLanding) return null;
  return (
    <section
      id="welcome"
      className="rounded-3xl border border-amateur-border bg-amateur-surface p-5 shadow-sm sm:p-6 scroll-mt-24"
      style={{
        backgroundImage:
          'linear-gradient(135deg, var(--portal-accent-soft, transparent) 0%, transparent 80%)',
      }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-wide"
        style={{ color: 'var(--portal-primary, #0d4a3c)' }}
      >
        {t('portal.home.landingBadge')}
      </p>
      <h2 className="mt-1 font-display text-lg font-semibold text-amateur-ink">
        {clubDisplayName
          ? t('portal.home.landingTitleClub', {
              name: guardianFirstName,
              club: clubDisplayName,
            })
          : t('portal.home.landingTitle', { name: guardianFirstName })}
      </h2>
      <p className="mt-2 max-w-prose text-sm text-amateur-muted">
        {t('portal.home.landingBody')}
      </p>
    </section>
  );
}

/**
 * Family Activation & Landing Pack v1 — calm essentials strip.
 *
 * Surfaces the few things that genuinely matter to a freshly-landed
 * family, with clear "done" / "needs attention" affordances. The strip
 * hides itself entirely when nothing needs attention AND the parent is
 * past their first-landing window — that's the calm path for returning
 * families. No checklist scoring, no progress percentages, no nagging.
 */
function FamilyEssentialsStrip({
  landing,
  hasOutstanding,
  pendingCount,
}: {
  landing: GuardianPortalLandingSummary | null;
  hasOutstanding: boolean;
  pendingCount: number;
}) {
  const { t } = useTranslation();
  if (!landing) return null;
  const attentionEntries = landing.essentials.filter((entry) => entry.severity === 'attention');
  // Returning, settled families never see this surface.
  const visible = landing.firstLanding || attentionEntries.length > 0;
  if (!visible) return null;
  // Cap the rendered list to the highest-signal three entries so we
  // never present the family with a long checklist.
  const renderable = pickEssentialsForRender(landing.essentials, hasOutstanding, pendingCount);
  if (renderable.length === 0) return null;
  return (
    <section
      id="essentials"
      className="rounded-3xl border border-amateur-border bg-amateur-surface p-5 shadow-sm scroll-mt-24"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-amateur-ink">
          {t('portal.home.essentialsTitle')}
        </h2>
        <span className="text-xs text-amateur-muted">{t('portal.home.essentialsHint')}</span>
      </div>
      <ul className="mt-3 space-y-2">
        {renderable.map((entry) => (
          <li
            key={entry.key}
            className="flex items-start gap-3 rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-3"
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                entry.done
                  ? 'bg-emerald-100 text-emerald-700'
                  : entry.severity === 'attention'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-amateur-canvas text-amateur-muted'
              }`}
            >
              {entry.done ? '✓' : '·'}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-amateur-ink">
                {t(`portal.home.essentials.${entry.key}.title`)}
              </p>
              <p className="mt-0.5 text-xs text-amateur-muted">
                {entry.done
                  ? t(`portal.home.essentials.${entry.key}.done`)
                  : t(`portal.home.essentials.${entry.key}.body`)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function pickEssentialsForRender(
  essentials: GuardianPortalEssential[],
  hasOutstanding: boolean,
  pendingCount: number,
): GuardianPortalEssential[] {
  const attention = essentials.filter((entry) => entry.severity === 'attention');
  const done = essentials.filter((entry) => entry.severity === 'info');
  // Honor product principle: 1–3 clear next actions, never a long list.
  // We surface every attention item (capped at three) plus a single
  // soft "done" entry so the parent feels acknowledged when they have
  // already completed the essentials. The "check_balance" entry is only
  // rendered when there is actually an open balance OR a pending action
  // worth flagging — we never invent a finance hint where there isn't
  // one to act on.
  const filteredAttention = attention.filter((entry) => {
    if (entry.key === 'check_balance' && !hasOutstanding) return false;
    if (entry.key === 'open_pending_action' && pendingCount === 0) return false;
    return true;
  });
  if (filteredAttention.length > 0) {
    return filteredAttention.slice(0, 3);
  }
  // No attention entries — show a single calm "all set" hint to
  // acknowledge the family. Prefer the "review children" line since it
  // is the most universally meaningful.
  const firstDone = done.find((entry) => entry.key === 'review_children') ?? done[0];
  return firstDone ? [firstDone] : [];
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
              {item.audience && item.audience.scope !== 'all' && item.audience.label ? (
                <span className="rounded-full border border-amateur-border bg-amateur-canvas px-2 py-0.5 text-[11px] font-medium text-amateur-muted">
                  {t(`portal.home.clubUpdateAudienceFor.${item.audience.scope}`, {
                    label: item.audience.label,
                  })}
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

/**
 * Parent Portal v1.3 — Communication Continuity strip.
 *
 * A single calm strip carrying the most recent club->family context the
 * parent should be aware of. We deliberately keep this small (max five
 * moments), restrained in colour, and free of unread theatre. Each
 * moment links back to a surface the parent already has access to:
 *   - club-update moments scroll to the existing "From the club" strip;
 *   - family-request moments deep-link into the existing action page.
 * When the family has nothing recent, the strip hides itself entirely.
 */
function CommunicationContinuityStrip({
  continuity,
}: {
  continuity: GuardianPortalCommunicationContinuity | null;
}) {
  const { t, i18n } = useTranslation();
  if (!continuity || continuity.moments.length === 0) return null;
  return (
    <section
      id="continuity"
      className="rounded-3xl border border-amateur-border bg-amateur-surface p-5 shadow-sm scroll-mt-24"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-amateur-ink">
          {t('portal.home.continuityTitle')}
        </h2>
        <span className="text-xs text-amateur-muted">
          {t('portal.home.continuityHint')}
        </span>
      </div>
      <ul className="mt-3 space-y-2">
        {continuity.moments.map((moment) => (
          <ContinuityMomentRow key={moment.id} moment={moment} language={i18n.language} />
        ))}
      </ul>
      {continuity.hasOpenFamilyRequest ? (
        <p className="mt-3 text-[11px] font-medium text-amateur-muted">
          {t('portal.home.continuityOpenHint')}
        </p>
      ) : null}
    </section>
  );
}

function ContinuityMomentRow({
  moment,
  language,
}: {
  moment: GuardianPortalContinuityMoment;
  language: string;
}) {
  const { t } = useTranslation();
  const occurredAtLabel = formatDateTime(moment.occurredAt, language);
  const badgeLabel =
    moment.kind === 'club_update'
      ? t('portal.home.continuityBadgeClubUpdate')
      : t('portal.home.continuityBadgeFamilyRequest');
  const statusLabel = (() => {
    if (!moment.status) return null;
    if (moment.status === 'published') return null;
    if (moment.status === 'open' || moment.status === 'pending_family_action') {
      return t('portal.home.continuityStatusOpen');
    }
    if (moment.status === 'submitted' || moment.status === 'under_review') {
      return t('portal.home.continuityStatusReview');
    }
    if (moment.status === 'approved' || moment.status === 'completed') {
      return t('portal.home.continuityStatusResolved');
    }
    if (moment.status === 'rejected' || moment.status === 'closed') {
      return t('portal.home.continuityStatusClosed');
    }
    return null;
  })();
  const inner = (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-3">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-amateur-muted">
          <span
            className="rounded-full px-2 py-0.5 text-[10px]"
            style={{
              backgroundColor: 'var(--portal-primary-soft, #e3f4ee)',
              color: 'var(--portal-primary, #0d4a3c)',
            }}
          >
            {badgeLabel}
          </span>
          {statusLabel ? (
            <span className="rounded-full border border-amateur-border bg-amateur-surface/60 px-2 py-0.5 text-[10px] font-medium text-amateur-muted">
              {statusLabel}
            </span>
          ) : null}
          <span className="ml-auto text-[10px] font-medium text-amateur-muted">
            {occurredAtLabel}
          </span>
        </p>
        <p className="mt-1 truncate text-sm font-medium text-amateur-ink">{moment.title}</p>
        {moment.summary ? (
          <p className="mt-1 line-clamp-2 text-xs text-amateur-muted">{moment.summary}</p>
        ) : null}
        {moment.athleteName || moment.audienceLabel ? (
          <p className="mt-1 text-[11px] text-amateur-muted">
            {[
              moment.athleteName,
              moment.audienceLabel
                ? t('portal.home.continuityForAudience', { label: moment.audienceLabel })
                : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        ) : null}
      </div>
    </div>
  );
  if (moment.kind === 'family_request' && moment.actionId) {
    return (
      <li>
        <Link
          to={`/portal/actions/${moment.actionId}`}
          className="block transition-colors hover:opacity-90"
        >
          {inner}
        </Link>
      </li>
    );
  }
  if (moment.kind === 'club_update') {
    return (
      <li>
        <a href="#updates" className="block transition-colors hover:opacity-90">
          {inner}
        </a>
      </li>
    );
  }
  return <li>{inner}</li>;
}

/**
 * Parent Portal v1.3 — Payment Readiness card.
 *
 * Calm, family-facing, never collections. Three states drive the copy
 * and the visual tone:
 *   - "clear":     no open balance — a soft acknowledgement.
 *   - "open":      open charges, none overdue — calm and informational.
 *   - "attention": one or more overdue charges — still calm, but more
 *                  visible, with a "let your club know if there's a
 *                  question" hint instead of any pressure language.
 *
 * We never render `cancelled` or `paid` rows here, never invent
 * urgency, and never expose internal staff metadata. The list of
 * charges is hard-capped server-side (six entries across the family).
 */
function PaymentReadinessCard({
  readiness,
}: {
  readiness: GuardianPortalPaymentReadiness | null;
}) {
  const { t, i18n } = useTranslation();
  if (!readiness) return null;
  const tone = readiness.tone;
  const currency = readiness.currency || 'TRY';
  const totalsOutstanding = readiness.totals.outstandingAmount;
  const totalsOverdue = readiness.totals.overdueAmount;
  const hasOpen = readiness.totals.openCount > 0;
  if (tone === 'clear' && !hasOpen) {
    return (
      <section
        id="payment"
        className="rounded-3xl border border-amateur-border bg-amateur-surface p-5 shadow-sm scroll-mt-24"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-amateur-ink">
            {t('portal.home.paymentTitle')}
          </h2>
          <span className="text-xs text-amateur-muted">
            {t('portal.home.paymentClearTag')}
          </span>
        </div>
        <p className="mt-2 text-sm text-amateur-muted">{t('portal.home.paymentClearBody')}</p>
      </section>
    );
  }
  const ringColor =
    tone === 'attention'
      ? 'var(--portal-ring-soft, #facc15)'
      : 'var(--portal-ring-soft, var(--color-amateur-border))';
  return (
    <section
      id="payment"
      className="rounded-3xl border bg-amateur-surface p-5 shadow-sm scroll-mt-24"
      style={{ borderColor: ringColor }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold text-amateur-ink">
            {t('portal.home.paymentTitle')}
          </h2>
          <p className="mt-1 text-xs text-amateur-muted">
            {tone === 'attention'
              ? t('portal.home.paymentAttentionHint')
              : t('portal.home.paymentOpenHint')}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] uppercase tracking-wide text-amateur-muted">
            {t('portal.home.paymentTotalLabel')}
          </p>
          <p className="text-sm font-semibold text-amateur-ink">
            {getMoneyAmount(totalsOutstanding, currency)}
          </p>
          {Number(totalsOverdue) > 0 ? (
            <p className="text-[11px] font-medium text-amber-700">
              {t('portal.home.paymentOverdueLabel')}{' '}
              {getMoneyAmount(totalsOverdue, currency)}
            </p>
          ) : null}
        </div>
      </div>

      {readiness.nextDue ? (
        <div className="mt-3 rounded-2xl border border-dashed border-amateur-border bg-amateur-canvas px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amateur-muted">
            {t('portal.home.paymentNextDueLabel')}
          </p>
          <p className="mt-1 text-sm font-medium text-amateur-ink">
            {readiness.nextDue.itemName}
          </p>
          <p className="mt-0.5 text-xs text-amateur-muted">
            {[
              readiness.nextDue.athleteName,
              readiness.nextDue.dueDate
                ? t('portal.home.paymentDueOn', {
                    date: formatDate(readiness.nextDue.dueDate, i18n.language),
                  })
                : null,
              getMoneyAmount(
                readiness.nextDue.remainingAmount ?? readiness.nextDue.amount,
                readiness.nextDue.currency || currency,
              ),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
      ) : null}

      {readiness.charges.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {readiness.charges.map((charge) => (
            <li
              key={charge.id}
              className="flex items-start justify-between gap-3 rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-amateur-ink">
                  {charge.itemName}
                </p>
                <p className="mt-0.5 text-xs text-amateur-muted">
                  {[
                    charge.athleteName,
                    charge.dueDate
                      ? t('portal.home.paymentDueOn', {
                          date: formatDate(charge.dueDate, i18n.language),
                        })
                      : t('portal.home.paymentNoDueDate'),
                    charge.billingPeriodLabel,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-amateur-ink">
                  {getMoneyAmount(
                    charge.remainingAmount || charge.amount,
                    charge.currency || currency,
                  )}
                </p>
                <p
                  className={`mt-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                    charge.status === 'overdue'
                      ? 'text-amber-700'
                      : charge.status === 'dueSoon'
                        ? 'text-amateur-ink'
                        : 'text-amateur-muted'
                  }`}
                >
                  {charge.status === 'overdue'
                    ? t('portal.home.paymentStatusOverdue')
                    : charge.status === 'dueSoon'
                      ? t('portal.home.paymentStatusDueSoon')
                      : t('portal.home.paymentStatusOpen')}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-3 text-[11px] text-amateur-muted">
        {tone === 'attention'
          ? t('portal.home.paymentAttentionFooter')
          : t('portal.home.paymentOpenFooter', { currency })}
      </p>
    </section>
  );
}
