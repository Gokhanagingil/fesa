import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { InlineAlert } from '../components/ui/InlineAlert';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { apiGet, apiPatch, apiPost } from '../lib/api';
import {
  formatDateTime,
  getFamilyActionStatusLabel,
  getFamilyReadinessStatusLabel,
  getFamilyReadinessTone,
  getGuardianPortalAccessStatusLabel,
  getGuardianPortalAccessTone,
  getGuardianRelationshipSummary,
  getPersonName,
} from '../lib/display';
import type {
  AthleteGuardianLink,
  Guardian,
  GuardianFamilyReadiness,
  GuardianInviteDeliveryReadiness,
  GuardianInviteDeliverySummary,
  GuardianPortalAccessSummary,
} from '../lib/domain-types';
import { useTenant } from '../lib/tenant-hooks';

type AccessWithExtras = GuardianPortalAccessSummary & {
  inviteLink?: string;
  absoluteInviteLink?: string;
};

export function GuardianDetailPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { tenantId } = useTenant();
  const [guardian, setGuardian] = useState<Guardian | null>(null);
  const [links, setLinks] = useState<AthleteGuardianLink[]>([]);
  const [readiness, setReadiness] = useState<GuardianFamilyReadiness | null>(null);
  const [portalAccess, setPortalAccess] = useState<AccessWithExtras | null>(null);
  const [deliveryReadiness, setDeliveryReadiness] =
    useState<GuardianInviteDeliveryReadiness | null>(null);
  const [latestInviteLink, setLatestInviteLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [savingPortal, setSavingPortal] = useState(false);
  const [verifyingDelivery, setVerifyingDelivery] = useState(false);
  const [copyAck, setCopyAck] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId || !id) return;
    setLoading(true);
    setError(null);
    try {
      const [guardianRes, athletesRes, readinessRes, portalAccessRes, deliveryRes] =
        await Promise.all([
          apiGet<Guardian>(`/api/guardians/${id}`),
          apiGet<AthleteGuardianLink[]>(`/api/guardians/${id}/athletes`),
          apiGet<GuardianFamilyReadiness>(`/api/guardians/${id}/family-readiness`),
          apiGet<AccessWithExtras | null>(
            `/api/guardian-portal/staff/guardians/${id}/access`,
          ).catch(() => null),
          apiGet<GuardianInviteDeliveryReadiness>(
            `/api/guardian-portal/staff/invite-delivery/readiness`,
          ).catch(() => null),
        ]);
      setGuardian(guardianRes);
      setLinks(athletesRes);
      setReadiness(readinessRes);
      setPortalAccess(portalAccessRes);
      setDeliveryReadiness(deliveryRes);
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

  function resolveAbsoluteLink(access: AccessWithExtras | null): string | null {
    if (!access) return null;
    if (access.absoluteInviteLink) return access.absoluteInviteLink;
    if (access.inviteLink) return `${window.location.origin}${access.inviteLink}`;
    return null;
  }

  async function invitePortalAccess() {
    if (!id || !guardian?.email) return;
    setSavingPortal(true);
    setError(null);
    setMessage(null);
    setCopyAck(false);
    try {
      const result = await apiPost<AccessWithExtras>(
        `/api/guardian-portal/staff/guardians/${id}/access`,
        { email: guardian.email, language: i18n.language === 'tr' ? 'tr' : 'en' },
      );
      setPortalAccess(result);
      const absolute = resolveAbsoluteLink(result);
      setLatestInviteLink(absolute);
      const delivery = result.delivery ?? result.inviteDelivery ?? null;
      setMessage(messageForDelivery(delivery));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    } finally {
      setSavingPortal(false);
    }
  }

  function messageForDelivery(delivery: GuardianInviteDeliverySummary | null): string {
    if (!delivery) return t('pages.guardians.portalAccess.inviteIssued');
    switch (delivery.state) {
      case 'sent':
        return t('pages.guardians.portalAccess.deliverySent');
      case 'failed':
        return t('pages.guardians.portalAccess.deliveryFailed');
      case 'unavailable':
        return t('pages.guardians.portalAccess.deliveryUnavailable');
      case 'shared_manually':
        return t('pages.guardians.portalAccess.deliveryShared');
      case 'pending':
      default:
        return t('pages.guardians.portalAccess.inviteIssued');
    }
  }

  async function togglePortalAccess(action: 'enable' | 'disable') {
    if (!portalAccess) return;
    setSavingPortal(true);
    setError(null);
    setMessage(null);
    try {
      const result =
        action === 'enable'
          ? await apiPatch<AccessWithExtras>(
              `/api/guardian-portal/staff/access/${portalAccess.id}/enable`,
              {},
            )
          : await apiPatch<AccessWithExtras>(
              `/api/guardian-portal/staff/access/${portalAccess.id}/disable`,
              {},
            );
      setPortalAccess(result);
      if (action === 'enable') {
        const absolute = resolveAbsoluteLink(result);
        setLatestInviteLink(absolute);
        setMessage(messageForDelivery(result.delivery ?? result.inviteDelivery ?? null));
      } else {
        setLatestInviteLink(null);
        setMessage(t('pages.guardians.portalAccess.disabled'));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    } finally {
      setSavingPortal(false);
    }
  }

  async function copyInviteLink() {
    const link = latestInviteLink ?? resolveAbsoluteLink(portalAccess);
    if (!link) {
      setError(t('pages.guardians.portalAccess.copyMissing'));
      return;
    }
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const ta = document.createElement('textarea');
        ta.value = link;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      setCopyAck(true);
      setTimeout(() => setCopyAck(false), 2500);
    } catch {
      setError(t('pages.guardians.portalAccess.copyFailed'));
    }
  }

  async function markInviteShared() {
    if (!portalAccess) return;
    setSavingPortal(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiPatch<AccessWithExtras>(
        `/api/guardian-portal/staff/access/${portalAccess.id}/mark-shared`,
        {},
      );
      setPortalAccess(result);
      setMessage(t('pages.guardians.portalAccess.deliveryShared'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    } finally {
      setSavingPortal(false);
    }
  }

  async function verifyInviteDelivery() {
    setVerifyingDelivery(true);
    setError(null);
    try {
      const next = await apiPost<GuardianInviteDeliveryReadiness>(
        `/api/guardian-portal/staff/invite-delivery/verify`,
        {},
      );
      setDeliveryReadiness(next);
      if (next.state === 'configured' && next.verified) {
        setMessage(t('pages.guardians.portalAccess.deliveryVerifyOk'));
      } else if (next.state === 'error') {
        setMessage(null);
        setError(t('pages.guardians.portalAccess.deliveryVerifyFailed'));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    } finally {
      setVerifyingDelivery(false);
    }
  }

  function renderDeliveryBadge(summary: GuardianInviteDeliverySummary | null | undefined) {
    if (!summary || !summary.state) return null;
    const tone =
      summary.state === 'sent'
        ? 'success'
        : summary.state === 'shared_manually'
          ? 'info'
          : summary.state === 'unavailable' || summary.state === 'pending'
            ? 'warning'
            : 'danger';
    return (
      <StatusBadge tone={tone}>
        {t(`pages.guardians.portalAccess.deliveryStateLabel.${summary.state}`)}
      </StatusBadge>
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

      {error ? (
        <InlineAlert tone="error" className="mb-4">
          {error}
        </InlineAlert>
      ) : null}
      {message ? (
        <InlineAlert tone="success" className="mb-4">
          {message}
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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-amateur-ink">
                {t('pages.guardians.portalAccess.title')}
              </h2>
              <p className="mt-1 text-sm text-amateur-muted">{t('pages.guardians.portalAccess.hint')}</p>
            </div>
            {portalAccess ? (
              <StatusBadge tone={getGuardianPortalAccessTone(portalAccess.status)}>
                {getGuardianPortalAccessStatusLabel(t, portalAccess.status)}
              </StatusBadge>
            ) : null}
          </div>
          {!guardian.email ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {t('pages.guardians.portalAccess.missingEmail')}
            </div>
          ) : portalAccess ? (
            <div className="mt-4 space-y-4">
              <DeliveryReadinessRow
                readiness={deliveryReadiness}
                verifying={verifyingDelivery}
                onVerify={() => void verifyInviteDelivery()}
              />
              {portalAccess.recoveryRequestedAt ? (
                <InlineAlert tone="warning">
                  {t('pages.guardians.portalAccess.recoveryRequested', {
                    when: formatDateTime(portalAccess.recoveryRequestedAt, i18n.language),
                    count: portalAccess.recoveryRequestCount ?? 1,
                  })}
                </InlineAlert>
              ) : null}
              <DeliveryStatusCard
                summary={portalAccess.inviteDelivery ?? portalAccess.delivery ?? null}
                badge={renderDeliveryBadge(portalAccess.inviteDelivery ?? portalAccess.delivery ?? null)}
                language={i18n.language}
              />
              <InviteLinkPanel
                link={
                  portalAccess.status === 'active'
                    ? null
                    : latestInviteLink ?? resolveAbsoluteLink(portalAccess)
                }
                copyAck={copyAck}
                onCopy={() => void copyInviteLink()}
                onMarkShared={() => void markInviteShared()}
                disabled={savingPortal}
                deliveryState={(portalAccess.inviteDelivery ?? portalAccess.delivery ?? null)?.state ?? null}
              />
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label={t('pages.guardians.portalAccess.pendingActions')} value={portalAccess.pendingActions} compact />
                <StatCard label={t('pages.guardians.portalAccess.awaitingReview')} value={portalAccess.awaitingReview} compact />
                <StatCard label={t('pages.guardians.portalAccess.linkedAthletes')} value={portalAccess.linkedAthletes} compact />
              </div>
              <dl className="grid gap-2 text-sm text-amateur-muted">
                <div className="flex items-center justify-between gap-3">
                  <dt>{t('pages.guardians.portalAccess.invitedAt')}</dt>
                  <dd>{formatDateTime(portalAccess.invitedAt, i18n.language)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>{t('pages.guardians.portalAccess.activatedAt')}</dt>
                  <dd>{formatDateTime(portalAccess.activatedAt, i18n.language)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>{t('pages.guardians.portalAccess.lastLoginAt')}</dt>
                  <dd>{formatDateTime(portalAccess.lastLoginAt, i18n.language)}</dd>
                </div>
              </dl>
              {/* Parent Access Stabilization Pass — single primary
                  action with clear hierarchy.

                  Discovery surfaced a real friction point: the action
                  row used to render Disable + Resend as two equal ghost
                  buttons, leaving staff guessing which one was the
                  primary path. We now choose the primary action based
                  on the access state:
                    - `disabled`: "Re-enable portal" is the only path.
                    - `invited` / recovery flag set: "Resend invite" is
                      primary, "Disable" is the calmer secondary.
                    - `active`: "Disable" is primary (the only thing
                      staff usually wants to do here); "Resend invite"
                      stays available as a quiet secondary for the rare
                      case where the family asked for a fresh link.

                  Touch targets are at least 44px tall so staff can
                  manage access reliably from a phone. */}
              <div className="flex flex-wrap gap-2">
                {portalAccess.status === 'disabled' ? (
                  <Button
                    type="button"
                    onClick={() => void togglePortalAccess('enable')}
                    disabled={savingPortal}
                    className="min-h-[44px]"
                  >
                    {t('pages.guardians.portalAccess.enable')}
                  </Button>
                ) : portalAccess.status === 'active' &&
                  !portalAccess.recoveryRequestedAt ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void togglePortalAccess('disable')}
                      disabled={savingPortal}
                      className="min-h-[44px]"
                    >
                      {t('pages.guardians.portalAccess.disable')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void invitePortalAccess()}
                      disabled={savingPortal}
                      className="min-h-[44px]"
                    >
                      {t('pages.guardians.portalAccess.sendFreshLink')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      onClick={() => void invitePortalAccess()}
                      disabled={savingPortal}
                      className="min-h-[44px]"
                    >
                      {t('pages.guardians.portalAccess.resendInvite')}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void togglePortalAccess('disable')}
                      disabled={savingPortal}
                      className="min-h-[44px]"
                    >
                      {t('pages.guardians.portalAccess.disable')}
                    </Button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-amateur-border bg-amateur-canvas px-4 py-4">
              <DeliveryReadinessRow
                readiness={deliveryReadiness}
                verifying={verifyingDelivery}
                onVerify={() => void verifyInviteDelivery()}
              />
              <p className="mt-3 text-sm text-amateur-muted">{t('pages.guardians.portalAccess.notEnabled')}</p>
              <div className="mt-3">
                <Button type="button" onClick={() => void invitePortalAccess()} disabled={savingPortal}>
                  {t('pages.guardians.portalAccess.invite')}
                </Button>
              </div>
            </div>
          )}
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

type DeliveryReadinessRowProps = {
  readiness: GuardianInviteDeliveryReadiness | null;
  verifying: boolean;
  onVerify: () => void;
};

function DeliveryReadinessRow({ readiness, verifying, onVerify }: DeliveryReadinessRowProps) {
  const { t } = useTranslation();
  if (!readiness) return null;
  const tone =
    readiness.state === 'configured' && readiness.verified
      ? 'success'
      : readiness.state === 'configured'
        ? 'info'
        : readiness.state === 'error'
          ? 'danger'
          : 'warning';
  const labelKey =
    readiness.state === 'configured' && readiness.verified
      ? 'pages.guardians.portalAccess.deliveryReadiness.verified'
      : readiness.state === 'configured'
        ? 'pages.guardians.portalAccess.deliveryReadiness.configured'
        : readiness.state === 'error'
          ? 'pages.guardians.portalAccess.deliveryReadiness.error'
          : 'pages.guardians.portalAccess.deliveryReadiness.unavailable';
  const hintKey =
    readiness.state === 'configured'
      ? 'pages.guardians.portalAccess.deliveryReadiness.configuredHint'
      : readiness.state === 'error'
        ? 'pages.guardians.portalAccess.deliveryReadiness.errorHint'
        : 'pages.guardians.portalAccess.deliveryReadiness.unavailableHint';
  return (
    <div className="rounded-xl border border-amateur-border bg-amateur-canvas px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusBadge tone={tone}>{t(labelKey)}</StatusBadge>
          {readiness.fromAddress ? (
            <span className="text-xs text-amateur-muted">{readiness.fromAddress}</span>
          ) : null}
        </div>
        {readiness.state === 'configured' ? (
          <Button
            type="button"
            variant="ghost"
            onClick={onVerify}
            disabled={verifying}
            className="min-h-[40px]"
          >
            {verifying
              ? t('app.states.loading')
              : t('pages.guardians.portalAccess.deliveryReadiness.verify')}
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-amateur-muted">{t(hintKey)}</p>
    </div>
  );
}

type DeliveryStatusCardProps = {
  summary: GuardianInviteDeliverySummary | null;
  badge: ReactNode;
  language: string;
};

function DeliveryStatusCard({ summary, badge, language }: DeliveryStatusCardProps) {
  const { t } = useTranslation();
  if (!summary || !summary.state) return null;
  const tone =
    summary.state === 'sent'
      ? 'success'
      : summary.state === 'shared_manually'
        ? 'info'
        : summary.state === 'unavailable' || summary.state === 'pending'
          ? 'warning'
          : 'error';
  const message = t(summary.toneKey);
  const stamp =
    summary.state === 'sent'
      ? formatDateTime(summary.deliveredAt ?? summary.attemptedAt, language)
      : summary.state === 'shared_manually'
        ? formatDateTime(summary.sharedAt ?? summary.attemptedAt, language)
        : formatDateTime(summary.attemptedAt, language);
  return (
    <InlineAlert tone={tone}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {badge}
          <span>{message}</span>
        </div>
        <span className="text-xs opacity-70">{stamp}</span>
      </div>
    </InlineAlert>
  );
}

type InviteLinkPanelProps = {
  link: string | null;
  copyAck: boolean;
  onCopy: () => void;
  onMarkShared: () => void;
  disabled: boolean;
  deliveryState: GuardianInviteDeliverySummary['state'] | null;
};

function InviteLinkPanel({
  link,
  copyAck,
  onCopy,
  onMarkShared,
  disabled,
  deliveryState,
}: InviteLinkPanelProps) {
  const { t } = useTranslation();
  if (!link) return null;
  // Parent Access Stabilization Pass — when the email path is not
  // working, the manual share fallback IS the primary path. We promote
  // "Mark as shared" to the primary button in that case so staff are
  // never left wondering what to do next; in the calmer "email
  // accepted" / "already shared" cases we keep "Copy link" as primary
  // and keep the fallback available as a quiet ghost button so staff
  // can re-stamp if they sent a fresh copy through another channel.
  const fallbackIsPrimary =
    deliveryState === 'unavailable' ||
    deliveryState === 'failed' ||
    deliveryState === 'pending';
  const showMarkShared = deliveryState !== 'shared_manually';
  return (
    <div className="rounded-xl border border-dashed border-amateur-border bg-amateur-canvas px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
          {t('pages.guardians.portalAccess.shareTitle')}
        </p>
        {copyAck ? (
          <span className="text-xs text-emerald-700">
            {t('pages.guardians.portalAccess.copyAck')}
          </span>
        ) : null}
      </div>
      <p className="mt-2 break-all rounded-lg bg-amateur-surface px-3 py-2 text-xs text-amateur-ink">
        {link}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant={fallbackIsPrimary ? 'ghost' : 'primary'}
          onClick={onCopy}
          disabled={disabled}
          className="min-h-[44px]"
        >
          {t('pages.guardians.portalAccess.copyLink')}
        </Button>
        {showMarkShared ? (
          <Button
            type="button"
            variant={fallbackIsPrimary ? 'primary' : 'ghost'}
            onClick={onMarkShared}
            disabled={disabled}
            className="min-h-[44px]"
          >
            {t('pages.guardians.portalAccess.markShared')}
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-amateur-muted">
        {fallbackIsPrimary
          ? t('pages.guardians.portalAccess.shareHintFallback')
          : t('pages.guardians.portalAccess.shareHint')}
      </p>
    </div>
  );
}
