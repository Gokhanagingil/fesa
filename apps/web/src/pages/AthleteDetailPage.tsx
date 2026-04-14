import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import { useTenant } from '../lib/tenant-hooks';
import {
  formatDate,
  getChargeStatusLabel,
  getGuardianRelationshipLabel,
  getPersonName,
  getAthleteStatusLabel,
} from '../lib/display';
import type {
  Athlete,
  AthleteCharge,
  AthleteGuardianLink,
  ChargeItem,
  Guardian,
  GuardianRelationshipType,
  Team,
  TeamMembership,
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(searchParams.get('message'));

  const [showLink, setShowLink] = useState(false);
  const [guardianId, setGuardianId] = useState('');
  const [relationship, setRelationship] = useState<GuardianRelationshipType>('mother');
  const [primaryContact, setPrimaryContact] = useState(false);

  const [teamId, setTeamId] = useState('');

  const load = useCallback(async () => {
    if (!id || !tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const [a, g, tm, ag, tr, ci, ac] = await Promise.all([
        apiGet<Athlete>(`/api/athletes/${id}`),
        apiGet<AthleteGuardianLink[]>(`/api/athletes/${id}/guardians`),
        apiGet<TeamMembership[]>(`/api/athletes/${id}/teams`),
        apiGet<{ items: Guardian[] }>('/api/guardians?limit=200'),
        apiGet<{ items: Team[] }>('/api/teams?limit=200'),
        apiGet<{ items: ChargeItem[] }>('/api/charge-items?limit=200&isActive=true'),
        apiGet<{ items: AthleteCharge[] }>(`/api/athlete-charges?athleteId=${id}&limit=20`),
      ]);
      setAthlete(a);
      setGuardians(g);
      setTeams(tm);
      setAllGuardians(ag.items);
      setChargeItems(ci.items);
      setCharges(ac.items);
      const sameBranch = tr.items.filter((x) => x.sportBranchId === a.sportBranchId);
      setAllTeams(sameBranch);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [id, tenantId, t]);

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

  const activeTeams = teams.filter((m) => !m.endedAt);
  const availableGuardians = useMemo(
    () => allGuardians.filter((g) => !guardians.some((row) => row.guardian.id === g.id)),
    [allGuardians, guardians],
  );

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
      {error ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="mb-4 text-sm text-amateur-accent">{message}</p> : null}

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
            </div>
            <span className="rounded-full bg-amateur-accent-soft px-3 py-1 text-xs font-medium text-amateur-accent">
              {athlete.primaryGroup?.name ?? t('pages.athletes.noGroup')}
            </span>
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
              to="/app/finance/athlete-charges"
              className="text-center text-sm font-medium text-amateur-accent hover:underline"
            >
              {t('pages.finance.athleteChargesLink')} →
            </Link>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
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

      <section className="mt-6 rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
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
                    <td className="py-3">
                      {charge.chargeItem?.currency ?? ''} {charge.amount}
                    </td>
                    <td className="py-3">{formatDate(charge.dueDate, i18n.language)}</td>
                    <td className="py-3 text-amateur-muted">
                      {getChargeStatusLabel(t, charge.status)}
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
    </div>
  );
}
