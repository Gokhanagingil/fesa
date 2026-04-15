import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { InlineAlert } from '../components/ui/InlineAlert';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import { useTenant } from '../lib/tenant-hooks';
import {
  getFamilyActionStatusLabel,
  getFamilyActionTypeLabel,
  getFamilyReadinessStatusLabel,
  getFamilyReadinessTone,
  getFamilyActionActorLabel,
  formatDate,
  formatDateTime,
  getChargeStatusLabel,
  getLessonStatusLabel,
  getGuardianRelationshipLabel,
  getPersonName,
  getAthleteStatusLabel,
  getMoneyAmount,
  getChargeCurrencyAmount,
} from '../lib/display';
import type {
  Athlete,
  AthleteCharge,
  AthleteFamilyReadiness,
  AthleteFinanceSummaryResponse,
  AthleteGuardianLink,
  ChargeItem,
  FamilyActionRequest,
  FamilyActionRequestStatus,
  FamilyActionRequestType,
  PrivateLesson,
  Guardian,
  GuardianRelationshipType,
  Team,
  TeamMembership,
  GuardianPortalActionReviewRequest,
} from '../lib/domain-types';

export function AthleteDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const { tenantId } = useTenant();
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [guardians, setGuardians] = useState<AthleteGuardianLink[]>([]);
  const [teams, setTeams] = useState<TeamMembership[]>([]);
  const [allGuardians, setAllGuardians] = useState<Guardian[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [chargeItems, setChargeItems] = useState<ChargeItem[]>([]);
  const [charges, setCharges] = useState<AthleteCharge[]>([]);
  const [privateLessons, setPrivateLessons] = useState<PrivateLesson[]>([]);
  const [familyReadiness, setFamilyReadiness] = useState<AthleteFamilyReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(searchParams.get('message'));

  const [showLink, setShowLink] = useState(false);
  const [guardianId, setGuardianId] = useState('');
  const [relationship, setRelationship] = useState<GuardianRelationshipType>('mother');
  const [primaryContact, setPrimaryContact] = useState(false);

  const [teamId, setTeamId] = useState('');
  const [requestTitle, setRequestTitle] = useState('');
  const [requestDescription, setRequestDescription] = useState('');
  const [requestDueDate, setRequestDueDate] = useState('');
  const [requestType, setRequestType] = useState<FamilyActionRequestType>('contact_details_completion');
  const [requestGuardianId, setRequestGuardianId] = useState('');

  const load = useCallback(async () => {
    if (!id || !tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const [a, g, tm, ag, tr, ci, ac, lessons, readiness] = await Promise.all([
        apiGet<Athlete>(`/api/athletes/${id}`),
        apiGet<AthleteGuardianLink[]>(`/api/athletes/${id}/guardians`),
        apiGet<TeamMembership[]>(`/api/athletes/${id}/teams`),
        apiGet<{ items: Guardian[] }>('/api/guardians?limit=200'),
        apiGet<{ items: Team[] }>('/api/teams?limit=200'),
        apiGet<{ items: ChargeItem[] }>('/api/charge-items?limit=200&isActive=true'),
        apiGet<AthleteFinanceSummaryResponse>(`/api/finance/athlete-summaries?athleteId=${id}`),
        apiGet<{ items: PrivateLesson[] }>(`/api/private-lessons?athleteId=${id}&limit=20`),
        apiGet<AthleteFamilyReadiness>(`/api/athletes/${id}/family-readiness`),
      ]);
      setAthlete(a);
      setGuardians(g);
      setTeams(tm);
      setAllGuardians(ag.items);
      setChargeItems(ci.items);
      setCharges(ac.charges.slice(0, 20));
      setPrivateLessons(lessons.items);
      setFamilyReadiness(readiness);
      const sameBranch = tr.items.filter((x) => x.sportBranchId === a.sportBranchId);
      setAllTeams(sameBranch);
      if (!requestGuardianId && readiness.actions[0]?.guardianId) {
        setRequestGuardianId(readiness.actions[0].guardianId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [id, requestGuardianId, tenantId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function linkGuardian() {
    if (!id || !guardianId) return;
    try {
      await apiPost(`/api/athletes/${id}/guardians`, {
        guardianId,
        relationshipType: relationship,
        isPrimaryContact: primaryContact,
      });
      setShowLink(false);
      setGuardianId('');
      setMessage(t('pages.guardians.linkSuccess'));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    }
  }

  async function addTeam() {
    if (!id || !teamId) return;
    try {
      await apiPost(`/api/athletes/${id}/teams`, { teamId });
      setTeamId('');
      setMessage(t('pages.athletes.teamAdded'));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    }
  }

  async function endMembership(membershipId: string) {
    if (!id) return;
    try {
      await apiPost(`/api/athletes/${id}/teams/${membershipId}/end`, {});
      setMessage(t('pages.athletes.teamEnded'));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    }
  }

  async function unlinkGuardian(linkId: string) {
    if (!id) return;
    try {
      await apiDelete(`/api/athletes/${id}/guardians/${linkId}`);
      setMessage(t('pages.guardians.unlinkSuccess'));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    }
  }

  const [chargeItemId, setChargeItemId] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');

  async function addCharge() {
    if (!id || !chargeItemId || !chargeAmount) return;
    try {
      await apiPost('/api/athlete-charges', {
        athleteId: id,
        chargeItemId,
        amount: parseFloat(chargeAmount),
      });
      setChargeItemId('');
      setChargeAmount('');
      setMessage(t('pages.athleteCharges.created'));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    }
  }

  async function updateChargeStatus(chargeId: string, status: AthleteCharge['status']) {
    try {
      await apiPatch(`/api/athlete-charges/${chargeId}`, { status });
      setMessage(t('pages.athleteCharges.updated'));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    }
  }

  async function createFamilyActionRequest() {
    if (!id || !requestTitle.trim()) return;
    try {
      await apiPost('/api/family-actions', {
        athleteId: id,
        guardianId: requestGuardianId || undefined,
        type: requestType,
        title: requestTitle.trim(),
        description: requestDescription.trim() || undefined,
        dueDate: requestDueDate || undefined,
      });
      setRequestTitle('');
      setRequestDescription('');
      setRequestDueDate('');
      setMessage(t('pages.athletes.familyActions.created'));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    }
  }

  async function transitionFamilyAction(request: FamilyActionRequest, status: FamilyActionRequestStatus) {
    try {
      await apiPost(`/api/family-actions/${request.id}/transition`, { status });
      setMessage(t('pages.athletes.familyActions.updated'));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    }
  }

  async function reviewPortalSubmission(
    request: FamilyActionRequest,
    decision: GuardianPortalActionReviewRequest['decision'],
  ) {
    try {
      await apiPost(`/api/guardian-portal/staff/actions/${request.id}/review`, { decision });
      setMessage(t(`pages.athletes.familyActions.${decision === 'approved' ? 'portalApproved' : 'portalRejected'}`));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    }
  }

  const activeTeams = teams.filter((m) => !m.endedAt);
  const endedTeams = teams.filter((m) => m.endedAt);
  const availableGuardians = useMemo(
    () => allGuardians.filter((g) => !guardians.some((row) => row.guardian.id === g.id)),
    [allGuardians, guardians],
  );
  const primaryContacts = guardians.filter((row) => row.isPrimaryContact);
  const outstandingTotal = charges.reduce((sum, charge) => sum + Number(charge.remainingAmount ?? 0), 0);
  const overdueCount = charges.filter((charge) => charge.isOverdue).length;
  const openLessons = privateLessons.filter((lesson) => lesson.status !== 'completed').length;
  const readinessIssueCodes = familyReadiness?.issueCodes ?? [];
  const pendingFamilyActions = familyReadiness?.summary.pendingFamilyActions ?? 0;
  const awaitingStaffReview = familyReadiness?.summary.awaitingStaffReview ?? 0;
  const availableActionGuardians = guardians.map((row) => row.guardian);

  if (loading || !athlete) {
    return (
      <div>
        <PageHeader title={t('pages.athletes.detailTitle')} subtitle="" />
        <p className="text-sm text-amateur-muted">
          {error ?? t('app.states.loading')}
        </p>
      </div>
    );
  }

  const displayName = getPersonName(athlete);
  const readinessStatus = familyReadiness?.status ?? 'incomplete';
  const enrollmentChecklist = [
    {
      key: 'status',
      done: athlete.status === 'active' || athlete.status === 'trial' || athlete.status === 'paused',
      label: t('pages.athletes.readinessStatus'),
      detail: getAthleteStatusLabel(t, athlete.status),
      actionLabel: t('pages.athletes.edit'),
      actionHref: `/app/athletes/${athlete.id}/edit`,
    },
    {
      key: 'guardian',
      done: primaryContacts.length > 0,
      label: t('pages.athletes.readinessGuardian'),
      detail:
        primaryContacts.length > 0
          ? t('pages.athletes.readinessGuardianReady', { count: primaryContacts.length })
          : t('pages.athletes.readinessGuardianMissing'),
      actionLabel: t('pages.athletes.linkGuardian'),
      actionHref: '#guardians',
    },
    {
      key: 'group',
      done: Boolean(athlete.primaryGroupId),
      label: t('pages.athletes.readinessGroup'),
      detail: athlete.primaryGroup?.name ?? t('pages.athletes.readinessGroupMissing'),
      actionLabel: t('pages.athletes.edit'),
      actionHref: `/app/athletes/${athlete.id}/edit`,
    },
    {
      key: 'team',
      done: true,
      label: t('pages.athletes.readinessTeam'),
      detail:
        activeTeams.length > 0
          ? t('pages.athletes.readinessTeamAssigned', { count: activeTeams.length })
          : t('pages.athletes.readinessTeamOptional'),
      actionLabel: t('pages.athletes.addTeam'),
      actionHref: '#teams',
    },
    {
      key: 'finance',
      done: outstandingTotal <= 0,
      label: t('pages.athletes.readinessFinance'),
      detail:
        outstandingTotal > 0
          ? t('pages.athletes.readinessFinanceOpen', {
              amount: getMoneyAmount(
                outstandingTotal,
                charges.find((charge) => charge.chargeItem?.currency)?.chargeItem?.currency ?? 'TRY',
              ),
            })
          : t('pages.athletes.readinessFinanceReady'),
      actionLabel: t('pages.finance.athleteChargesLink'),
      actionHref: `/app/finance/athlete-charges?athleteId=${athlete.id}`,
    },
    {
      key: 'familyFollowUp',
      done: pendingFamilyActions === 0 && awaitingStaffReview === 0,
      label: t('pages.athletes.familyActions.readinessLabel'),
      detail:
        pendingFamilyActions > 0 || awaitingStaffReview > 0
          ? t('pages.athletes.familyActions.readinessOpen', {
              pendingFamilyActions,
              awaitingStaffReview,
            })
          : t('pages.athletes.familyActions.readinessClear'),
      actionLabel: t('pages.athletes.familyActions.jumpToQueue'),
      actionHref: '#family-actions',
    },
  ];
  const nextActions = enrollmentChecklist.filter((item) => !item.done).slice(0, 3);
  const readinessTone = getFamilyReadinessTone(readinessStatus);

  return (
    <div>
      <PageHeader
        title={displayName}
        subtitle={t('pages.athletes.detailTitle')}
        actions={
          <Link to={`/app/athletes/${athlete.id}/edit`}>
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

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-amateur-ink">
                {athlete.firstName} {athlete.lastName}
              </h2>
              <p className="text-sm text-amateur-muted">
                {getAthleteStatusLabel(t, athlete.status)}
              </p>
              <p className="mt-2 text-sm text-amateur-muted">
                {t('pages.athletes.familyActions.readinessHeadline', {
                  status: getFamilyReadinessStatusLabel(t, readinessStatus),
                })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-amateur-accent-soft px-3 py-1 text-xs font-medium text-amateur-accent">
                {athlete.primaryGroup?.name ?? t('pages.athletes.noGroup')}
              </span>
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
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-amateur-muted">{t('pages.athletes.birthDate')}</dt>
              <dd>{formatDate(athlete.birthDate, i18n.language)}</dd>
            </div>
            <div>
              <dt className="text-amateur-muted">{t('pages.athletes.jersey')}</dt>
              <dd>{athlete.jerseyNumber ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-amateur-muted">{t('pages.athletes.branch')}</dt>
              <dd>{athlete.sportBranch?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-amateur-muted">{t('pages.athletes.primaryGroup')}</dt>
              <dd>{athlete.primaryGroup?.name ?? t('pages.athletes.noGroup')}</dd>
            </div>
            <div>
              <dt className="text-amateur-muted">{t('pages.athletes.teamCount')}</dt>
              <dd>{activeTeams.length}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-amateur-muted">{t('pages.athletes.notes')}</dt>
              <dd className="whitespace-pre-wrap">{athlete.notes ?? '—'}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
          <h3 className="font-display font-semibold text-amateur-ink">{t('pages.athleteCharges.quickAssign')}</h3>
          <p className="mt-1 text-xs text-amateur-muted">{t('pages.athleteCharges.quickAssignHint')}</p>
          <div className="mt-4 flex flex-col gap-2">
            <select
              value={chargeItemId}
              onChange={(e) => setChargeItemId(e.target.value)}
              className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm"
            >
              <option value="">{t('pages.athleteCharges.item')}</option>
              {chargeItems.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.currency} {c.defaultAmount})
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder={t('pages.athleteCharges.amount')}
              value={chargeAmount}
              onChange={(e) => setChargeAmount(e.target.value)}
              className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm"
            />
            <Button type="button" onClick={() => void addCharge()} disabled={!chargeItemId || !chargeAmount}>
              {t('pages.athleteCharges.new')}
            </Button>
            <Link
              to={`/app/finance/athlete-charges?athleteId=${athlete.id}`}
              className="text-center text-sm font-medium text-amateur-accent hover:underline"
            >
              {t('pages.finance.athleteChargesLink')} →
            </Link>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-amateur-accent">{t('pages.athletes.enrollmentTitle')}</p>
            <h3 className="mt-1 font-display text-lg font-semibold text-amateur-ink">
              {t('pages.athletes.enrollmentSubtitle')}
            </h3>
            <p className="mt-2 max-w-2xl text-sm text-amateur-muted">{t('pages.athletes.enrollmentHint')}</p>
            {readinessIssueCodes.length > 0 ? (
              <p className="mt-2 text-sm text-amateur-muted">
                {t('pages.athletes.familyActions.issueSummary', {
                  count: readinessIssueCodes.length,
                })}
              </p>
            ) : null}
          </div>
          <div className="grid min-w-[14rem] gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <StatCard
              label={t('pages.athletes.enrollmentOutstanding')}
              value={getMoneyAmount(
                outstandingTotal,
                charges.find((charge) => charge.chargeItem?.currency)?.chargeItem?.currency ?? 'TRY',
              )}
              tone={outstandingTotal > 0 ? 'danger' : 'default'}
              compact
            />
            <StatCard
              label={t('pages.athletes.enrollmentOverdue')}
              value={overdueCount}
              tone={overdueCount > 0 ? 'danger' : 'default'}
              compact
            />
            <StatCard label={t('pages.athletes.enrollmentLessons')} value={openLessons} compact />
          </div>
        </div>
        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="grid gap-3">
            {enrollmentChecklist.map((item) => (
              <div
                key={item.key}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amateur-border bg-amateur-canvas px-4 py-3"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                      item.done
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {item.done ? '✓' : '!'}
                  </span>
                  <div>
                    <p className="font-medium text-amateur-ink">{item.label}</p>
                    <p className="text-sm text-amateur-muted">{item.detail}</p>
                  </div>
                </div>
                <Link to={item.actionHref} className="text-sm font-semibold text-amateur-accent hover:underline">
                  {item.actionLabel}
                </Link>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-amateur-border bg-amateur-canvas px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
              {t('pages.athletes.nextActionsTitle')}
            </p>
            {nextActions.length === 0 ? (
              <p className="mt-3 text-sm text-amateur-muted">{t('pages.athletes.nextActionsClear')}</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {nextActions.map((item) => (
                  <li key={item.key} className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-3">
                    <p className="font-medium text-amateur-ink">{item.label}</p>
                    <p className="mt-1 text-sm text-amateur-muted">{item.detail}</p>
                    <Link
                      to={item.actionHref}
                      className="mt-2 inline-flex text-sm font-semibold text-amateur-accent hover:underline"
                    >
                      {item.actionLabel}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section id="family-actions" className="mt-6 rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold">{t('pages.athletes.familyActions.title')}</h3>
            <p className="text-sm text-amateur-muted">{t('pages.athletes.familyActions.hint')}</p>
          </div>
          <Link to={`/app/communications?athleteIds=${athlete.id}&needsFollowUp=true`}>
            <Button variant="ghost">{t('pages.athletes.familyActions.openFollowUp')}</Button>
          </Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <StatCard
            label={t('pages.athletes.familyActions.pendingFamily')}
            value={pendingFamilyActions}
            compact
            tone={pendingFamilyActions > 0 ? 'danger' : 'default'}
          />
          <StatCard
            label={t('pages.athletes.familyActions.awaitingReview')}
            value={awaitingStaffReview}
            compact
            tone={awaitingStaffReview > 0 ? 'danger' : 'default'}
          />
          <StatCard
            label={t('pages.athletes.familyActions.closed')}
            value={familyReadiness?.summary.completedActions ?? 0}
            compact
          />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div className="rounded-xl border border-amateur-border bg-amateur-canvas p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
              {t('pages.athletes.familyActions.newRequest')}
            </p>
            <div className="mt-3 space-y-3">
              <label className="flex flex-col gap-1 text-sm">
                <span>{t('pages.athletes.familyActions.requestType')}</span>
                <select
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value as FamilyActionRequestType)}
                  className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                >
                  {(
                    [
                      'contact_details_completion',
                      'guardian_profile_update',
                      'consent_acknowledgement',
                      'enrollment_readiness',
                      'profile_correction',
                    ] as FamilyActionRequestType[]
                  ).map((value) => (
                    <option key={value} value={value}>
                      {getFamilyActionTypeLabel(t, value)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>{t('pages.athletes.familyActions.requestGuardian')}</span>
                <select
                  value={requestGuardianId}
                  onChange={(e) => setRequestGuardianId(e.target.value)}
                  className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                >
                  <option value="">{t('pages.athletes.familyActions.anyLinkedGuardian')}</option>
                  {availableActionGuardians.map((guardian) => (
                    <option key={guardian.id} value={guardian.id}>
                      {getPersonName(guardian)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>{t('pages.athletes.familyActions.requestTitle')}</span>
                <input
                  value={requestTitle}
                  onChange={(e) => setRequestTitle(e.target.value)}
                  className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>{t('pages.athletes.familyActions.requestDueDate')}</span>
                <input
                  type="date"
                  value={requestDueDate}
                  onChange={(e) => setRequestDueDate(e.target.value)}
                  className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>{t('pages.athletes.familyActions.requestDescription')}</span>
                <textarea
                  rows={4}
                  value={requestDescription}
                  onChange={(e) => setRequestDescription(e.target.value)}
                  className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                />
              </label>
              <Button type="button" onClick={() => void createFamilyActionRequest()} disabled={!requestTitle.trim()}>
                {t('pages.athletes.familyActions.create')}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-amateur-border bg-amateur-canvas p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
              {t('pages.athletes.familyActions.queueTitle')}
            </p>
            {familyReadiness?.actions.length ? (
              <div className="mt-3 space-y-3">
                {familyReadiness.actions.map((request) => (
                  <article key={request.id} className="rounded-xl border border-amateur-border bg-amateur-surface px-4 py-4">
                    {(() => {
                      const portalEvent = request.events.find((event) => event.actor === 'family');
                      const portalSubmission =
                        request.payload?.portalSubmission && typeof request.payload.portalSubmission === 'object'
                          ? (request.payload.portalSubmission as {
                              source?: string;
                              suggestedUpdates?: { phone?: string; email?: string; notes?: string };
                            })
                          : null;

                      return (
                        <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-amateur-ink">{request.title}</p>
                        <p className="mt-1 text-xs text-amateur-muted">
                          {[
                            getFamilyActionTypeLabel(t, request.type),
                            request.guardianName,
                            request.dueDate ? formatDate(request.dueDate, i18n.language) : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                        {portalEvent ? (
                          <p className="mt-2 text-xs font-medium text-sky-700">
                            {t('pages.athletes.familyActions.portalOriginLabel', {
                              actor: getFamilyActionActorLabel(t, portalEvent.actor),
                            })}
                          </p>
                        ) : null}
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        {getFamilyActionStatusLabel(t, request.status)}
                      </span>
                    </div>
                    {request.description ? (
                      <p className="mt-2 text-sm text-amateur-muted">{request.description}</p>
                    ) : null}
                    {request.latestResponseText ? (
                      <p className="mt-2 text-sm text-amateur-muted">
                        {t('pages.athletes.familyActions.latestResponse')}: {request.latestResponseText}
                      </p>
                    ) : null}
                    {portalSubmission?.source === 'guardian_portal' ? (
                      <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-900">
                        <p className="font-medium">{t('pages.athletes.familyActions.portalSubmissionTitle')}</p>
                        <ul className="mt-2 space-y-1 text-xs">
                          {portalSubmission.suggestedUpdates?.phone ? (
                            <li>
                              {t('pages.athletes.phone')}: {portalSubmission.suggestedUpdates.phone}
                            </li>
                          ) : null}
                          {portalSubmission.suggestedUpdates?.email ? (
                            <li>
                              {t('pages.athletes.email')}: {portalSubmission.suggestedUpdates.email}
                            </li>
                          ) : null}
                          {portalSubmission.suggestedUpdates?.notes ? (
                            <li>
                              {t('pages.athletes.notes')}: {portalSubmission.suggestedUpdates.notes}
                            </li>
                          ) : null}
                        </ul>
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {request.status === 'pending_family_action' || request.status === 'open' || request.status === 'rejected' ? (
                        <Button type="button" variant="ghost" onClick={() => void transitionFamilyAction(request, 'submitted')}>
                          {t('pages.athletes.familyActions.markSubmitted')}
                        </Button>
                      ) : null}
                      {request.status === 'submitted' ? (
                        <Button type="button" variant="ghost" onClick={() => void transitionFamilyAction(request, 'under_review')}>
                          {t('pages.athletes.familyActions.startReview')}
                        </Button>
                      ) : null}
                      {request.status === 'submitted' || request.status === 'under_review' ? (
                        <>
                          {portalEvent ? (
                            <>
                              <Button type="button" variant="ghost" onClick={() => void reviewPortalSubmission(request, 'approved')}>
                                {t('pages.athletes.familyActions.applyPortalSubmission')}
                              </Button>
                              <Button type="button" variant="ghost" onClick={() => void reviewPortalSubmission(request, 'rejected')}>
                                {t('pages.athletes.familyActions.returnToGuardian')}
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button type="button" variant="ghost" onClick={() => void transitionFamilyAction(request, 'approved')}>
                                {t('pages.athletes.familyActions.approve')}
                              </Button>
                              <Button type="button" variant="ghost" onClick={() => void transitionFamilyAction(request, 'rejected')}>
                                {t('pages.athletes.familyActions.reject')}
                              </Button>
                            </>
                          )}
                        </>
                      ) : null}
                      {request.status === 'approved' ? (
                        <Button type="button" variant="ghost" onClick={() => void transitionFamilyAction(request, 'completed')}>
                          {t('pages.athletes.familyActions.complete')}
                        </Button>
                      ) : null}
                    </div>
                        </>
                      );
                    })()}
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-amateur-muted">{t('pages.athletes.familyActions.empty')}</p>
            )}
          </div>
        </div>
      </section>

      <section id="guardians" className="mt-6 rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold">{t('pages.athletes.guardians')}</h3>
            <p className="text-sm text-amateur-muted">{t('pages.athletes.guardiansHint')}</p>
          </div>
          <Button type="button" variant="ghost" onClick={() => setShowLink((s) => !s)}>
            {t('pages.athletes.linkGuardian')}
          </Button>
        </div>
        {showLink ? (
          <div className="mt-4 flex flex-col gap-3 rounded-xl border border-amateur-border bg-amateur-canvas p-4 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
              <span>{t('pages.athletes.selectGuardian')}</span>
              <select
                value={guardianId}
                onChange={(e) => setGuardianId(e.target.value)}
                className="rounded-lg border border-amateur-border bg-amateur-surface px-2 py-2"
              >
                <option value="">—</option>
                {availableGuardians.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.firstName} {g.lastName}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pages.athletes.relationship')}</span>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value as GuardianRelationshipType)}
                className="rounded-lg border border-amateur-border bg-amateur-surface px-2 py-2"
              >
                {(['mother', 'father', 'guardian', 'other'] as GuardianRelationshipType[]).map((r) => (
                  <option key={r} value={r}>
                    {getGuardianRelationshipLabel(t, r)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={primaryContact}
                onChange={(e) => setPrimaryContact(e.target.checked)}
              />
              {t('pages.athletes.primaryContact')}
            </label>
            <Button type="button" onClick={() => void linkGuardian()}>
              {t('pages.athletes.save')}
            </Button>
            <Link to={`/app/guardians/new?athleteId=${athlete.id}`}>
              <Button type="button" variant="ghost">
                {t('pages.athletes.guardianCreateTitle')}
              </Button>
            </Link>
          </div>
        ) : null}
        <ul className="mt-4 divide-y divide-amateur-border">
          {guardians.length === 0 ? (
            <li className="py-3 text-sm text-amateur-muted">{t('app.states.empty')}</li>
          ) : (
            guardians.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-medium">
                    {getPersonName(row.guardian)}
                  </p>
                  <p className="text-sm text-amateur-muted">
                    {getGuardianRelationshipLabel(t, row.relationshipType)}
                    {row.isPrimaryContact ? ` · ${t('pages.athletes.primaryContact')}` : ''}
                  </p>
                  {row.guardian.phone || row.guardian.email ? (
                    <p className="text-xs text-amateur-muted">
                      {[row.guardian.phone, row.guardian.email].filter(Boolean).join(' · ')}
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Link
                    to={`/app/guardians/${row.guardian.id}`}
                    className="text-sm font-medium text-amateur-accent hover:underline"
                  >
                    {t('pages.guardians.open')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void unlinkGuardian(row.id)}
                    className="text-sm font-medium text-amateur-muted transition hover:text-red-700"
                  >
                    {t('pages.guardians.unlink')}
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
        <p className="mt-2 text-xs text-amateur-muted">
          <Link
            to={`/app/guardians/new?athleteId=${athlete.id}`}
            className="font-medium text-amateur-accent hover:underline"
          >
            + {t('pages.athletes.guardianCreateTitle')}
          </Link>
        </p>
      </section>

      <section id="teams" className="mt-6 rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
        <h3 className="font-display text-lg font-semibold">{t('pages.athletes.teams')}</h3>
        <p className="text-sm text-amateur-muted">{t('pages.athletes.teamsHint')}</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
            <span>{t('pages.athletes.addTeam')}</span>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
            >
              <option value="">—</option>
              {allTeams.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" onClick={() => void addTeam()} disabled={!teamId}>
            {t('pages.athletes.addTeam')}
          </Button>
        </div>
        <ul className="mt-4 divide-y divide-amateur-border">
          {activeTeams.length === 0 ? (
            <li className="py-3 text-sm text-amateur-muted">{t('app.states.empty')}</li>
          ) : (
            activeTeams.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 py-3">
                  <div>
                    <span className="font-medium">{m.team.name}</span>
                    <p className="text-xs text-amateur-muted">
                      {m.team.group?.name ?? t('pages.teams.noGroup')}
                    </p>
                  </div>
                  <Button type="button" variant="ghost" onClick={() => void endMembership(m.id)}>
                    {t('pages.athletes.endMembership')}
                  </Button>
                </li>
              ))
          )}
        </ul>
        {endedTeams.length > 0 ? (
          <div className="mt-4 rounded-xl border border-amateur-border bg-amateur-canvas px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
              {t('pages.athletes.teamHistory')}
            </p>
            <ul className="mt-3 space-y-2 text-sm text-amateur-muted">
              {endedTeams.map((membership) => (
                <li key={membership.id} className="flex items-center justify-between gap-3">
                  <span>{membership.team.name}</span>
                  <span>{formatDate(membership.endedAt, i18n.language)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="mt-6 rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold">{t('pages.athleteCharges.title')}</h3>
            <p className="text-sm text-amateur-muted">{t('pages.athleteCharges.profileHint')}</p>
          </div>
          <Link to={`/app/finance/athlete-charges?athleteId=${athlete.id}`}>
            <Button variant="ghost">{t('pages.athleteCharges.viewAll')}</Button>
          </Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <StatCard
            label={t('pages.athleteCharges.summaryOutstanding')}
            value={getMoneyAmount(outstandingTotal, charges.find((charge) => charge.chargeItem?.currency)?.chargeItem?.currency ?? 'TRY')}
            tone="danger"
            compact
          />
          <StatCard
            label={t('pages.athleteCharges.summaryCollected')}
            value={getMoneyAmount(
              charges.reduce((sum, charge) => sum + Number(charge.allocatedAmount ?? 0), 0),
              charges.find((charge) => charge.chargeItem?.currency)?.chargeItem?.currency ?? 'TRY',
            )}
            compact
          />
          <StatCard
            label={t('pages.athleteCharges.summaryOverdue')}
            value={charges.filter((charge) => charge.isOverdue).length}
            tone="danger"
            compact
          />
        </div>
        {charges.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-amateur-border bg-amateur-canvas/60 px-4 py-6 text-sm text-amateur-muted">
            {t('pages.athleteCharges.empty')}
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[540px] text-left text-sm">
              <thead>
                <tr className="border-b border-amateur-border text-amateur-muted">
                  <th className="pb-2 font-medium">{t('pages.athleteCharges.item')}</th>
                  <th className="pb-2 font-medium">{t('pages.athleteCharges.amount')}</th>
                  <th className="pb-2 font-medium">{t('pages.athleteCharges.due')}</th>
                  <th className="pb-2 font-medium">{t('pages.athleteCharges.status')}</th>
                  <th className="pb-2 font-medium">{t('app.actions.update')}</th>
                </tr>
              </thead>
              <tbody>
                {charges.map((charge) => (
                  <tr key={charge.id} className="border-b border-amateur-border/70 last:border-0">
                    <td className="py-3 font-medium">{charge.chargeItem?.name ?? charge.chargeItemId}</td>
                    <td className="py-3">{getChargeCurrencyAmount(charge)}</td>
                    <td className="py-3">{formatDate(charge.dueDate, i18n.language)}</td>
                    <td className="py-3 text-amateur-muted">
                      {getChargeStatusLabel(t, charge.derivedStatus ?? charge.status)}
                    </td>
                    <td className="py-3">
                      <select
                        value={charge.status}
                        onChange={(e) => void updateChargeStatus(charge.id, e.target.value as AthleteCharge['status'])}
                        className="rounded-lg border border-amateur-border bg-amateur-canvas px-2 py-1"
                      >
                        {(
                          ['pending', 'partially_paid', 'paid', 'cancelled'] as AthleteCharge['status'][]
                        ).map((statusOption) => (
                          <option key={statusOption} value={statusOption}>
                            {getChargeStatusLabel(t, statusOption)}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold">{t('pages.privateLessons.title')}</h3>
            <p className="text-sm text-amateur-muted">{t('pages.privateLessons.profileHint')}</p>
          </div>
          <Link to={`/app/private-lessons?athleteId=${athlete.id}`}>
            <Button variant="ghost">{t('pages.privateLessons.openBoard')}</Button>
          </Link>
        </div>
        {privateLessons.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-amateur-border bg-amateur-canvas/60 px-4 py-6 text-sm text-amateur-muted">
            {t('pages.privateLessons.empty')}
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead>
                <tr className="border-b border-amateur-border text-amateur-muted">
                  <th className="pb-2 font-medium">{t('pages.training.scheduled')}</th>
                  <th className="pb-2 font-medium">{t('pages.coaches.title')}</th>
                  <th className="pb-2 font-medium">{t('pages.privateLessons.focus')}</th>
                  <th className="pb-2 font-medium">{t('pages.privateLessons.status')}</th>
                  <th className="pb-2 font-medium">{t('pages.athleteCharges.status')}</th>
                </tr>
              </thead>
              <tbody>
                {privateLessons.map((lesson) => (
                  <tr key={lesson.id} className="border-b border-amateur-border/70 last:border-0">
                    <td className="py-3 text-amateur-muted">
                      {formatDateTime(lesson.scheduledStart, i18n.language)}
                    </td>
                    <td className="py-3 font-medium text-amateur-ink">
                      {lesson.coach ? `${lesson.coach.preferredName || lesson.coach.firstName} ${lesson.coach.lastName}` : '—'}
                    </td>
                    <td className="py-3 text-amateur-muted">{lesson.focus || '—'}</td>
                    <td className="py-3 text-amateur-muted">{getLessonStatusLabel(t, lesson.status)}</td>
                    <td className="py-3 text-amateur-muted">
                      {lesson.charge ? getChargeStatusLabel(t, lesson.charge.derivedStatus ?? lesson.charge.status) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold">{t('pages.communications.quickTitle')}</h3>
            <p className="text-sm text-amateur-muted">{t('pages.communications.quickHint')}</p>
          </div>
          <Link to={`/app/communications?athleteIds=${athlete.id}`}>
            <Button variant="ghost">{t('pages.communications.openAudienceBuilder')}</Button>
          </Link>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-amateur-border bg-amateur-canvas px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
              {t('pages.communications.primaryContacts')}
            </p>
            <ul className="mt-3 space-y-2 text-sm text-amateur-ink">
              {guardians.filter((row) => row.isPrimaryContact).length > 0 ? (
                guardians
                  .filter((row) => row.isPrimaryContact)
                  .map((row) => (
                    <li key={row.id}>
                      {getPersonName(row.guardian)}
                      <span className="text-amateur-muted">
                        {' '}
                        · {[row.guardian.phone, row.guardian.email].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </li>
                  ))
              ) : (
                <li className="text-amateur-muted">{t('pages.communications.noPrimaryContacts')}</li>
              )}
            </ul>
          </div>
          <div className="rounded-xl border border-amateur-border bg-amateur-canvas px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
              {t('pages.communications.followUpSignals')}
            </p>
            <ul className="mt-3 space-y-2 text-sm text-amateur-muted">
              <li>
                {t('pages.communications.signalOutstanding', {
                  amount: getMoneyAmount(outstandingTotal, charges.find((charge) => charge.chargeItem?.currency)?.chargeItem?.currency ?? 'TRY'),
                })}
              </li>
              <li>
                {t('pages.communications.signalLessons', {
                  count: privateLessons.filter((lesson) => lesson.status !== 'completed').length,
                })}
              </li>
              <li>
                {t('pages.communications.signalFamilyActions', {
                  pending: pendingFamilyActions,
                  review: awaitingStaffReview,
                })}
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
