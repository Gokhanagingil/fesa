import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { apiGet, apiPost } from '../lib/api';
import type {
  Athlete,
  AthleteGuardianLink,
  ChargeItem,
  Guardian,
  Team,
  TeamMembership,
} from '../lib/domain-types';

export function AthleteDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [guardians, setGuardians] = useState<AthleteGuardianLink[]>([]);
  const [teams, setTeams] = useState<TeamMembership[]>([]);
  const [allGuardians, setAllGuardians] = useState<Guardian[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [chargeItems, setChargeItems] = useState<ChargeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showLink, setShowLink] = useState(false);
  const [guardianId, setGuardianId] = useState('');
  const [relationship, setRelationship] = useState('mother');
  const [primaryContact, setPrimaryContact] = useState(false);

  const [teamId, setTeamId] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [a, g, tm, ag, tr, ci] = await Promise.all([
        apiGet<Athlete>(`/api/athletes/${id}`),
        apiGet<AthleteGuardianLink[]>(`/api/athletes/${id}/guardians`),
        apiGet<TeamMembership[]>(`/api/athletes/${id}/teams`),
        apiGet<{ items: Guardian[] }>('/api/guardians?limit=200'),
        apiGet<{ items: Team[] }>('/api/teams?limit=200'),
        apiGet<{ items: ChargeItem[] }>('/api/charge-items?limit=200&isActive=true'),
      ]);
      setAthlete(a);
      setGuardians(g);
      setTeams(tm);
      setAllGuardians(ag.items);
      setChargeItems(ci.items);
      const sameBranch = tr.items.filter((x) => x.sportBranchId === a.sportBranchId);
      setAllTeams(sameBranch);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

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
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    }
  }

  async function endMembership(membershipId: string) {
    if (!id) return;
    try {
      await apiPost(`/api/athletes/${id}/teams/${membershipId}/end`, {});
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
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    }
  }

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

  const displayName =
    athlete.preferredName?.trim() || `${athlete.firstName} ${athlete.lastName}`;

  return (
    <div>
      <PageHeader title={displayName} subtitle={t('pages.athletes.detailTitle')} />
      {error ? <p className="mb-4 text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-amateur-ink">
                {athlete.firstName} {athlete.lastName}
              </h2>
              <p className="text-sm capitalize text-amateur-muted">{athlete.status}</p>
            </div>
            <Link to={`/app/athletes/${athlete.id}/edit`}>
              <Button variant="ghost">{t('pages.athletes.edit')}</Button>
            </Link>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-amateur-muted">{t('pages.athletes.birthDate')}</dt>
              <dd>{athlete.birthDate ? athlete.birthDate.slice(0, 10) : '—'}</dd>
            </div>
            <div>
              <dt className="text-amateur-muted">{t('pages.athletes.jersey')}</dt>
              <dd>{athlete.jerseyNumber ?? '—'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-amateur-muted">{t('pages.athletes.notes')}</dt>
              <dd className="whitespace-pre-wrap">{athlete.notes ?? '—'}</dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
          <h3 className="font-display font-semibold text-amateur-ink">{t('pages.athleteCharges.new')}</h3>
          <p className="mt-1 text-xs text-amateur-muted">{t('pages.finance.hubBody')}</p>
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
              <span>{t('pages.athletes.guardianCreateTitle')}</span>
              <select
                value={guardianId}
                onChange={(e) => setGuardianId(e.target.value)}
                className="rounded-lg border border-amateur-border bg-amateur-surface px-2 py-2"
              >
                <option value="">—</option>
                {allGuardians.map((g) => (
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
                onChange={(e) => setRelationship(e.target.value)}
                className="rounded-lg border border-amateur-border bg-amateur-surface px-2 py-2"
              >
                {['mother', 'father', 'guardian', 'other'].map((r) => (
                  <option key={r} value={r}>
                    {r}
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
                    {row.guardian.firstName} {row.guardian.lastName}
                  </p>
                  <p className="text-sm text-amateur-muted">
                    {row.relationshipType}
                    {row.isPrimaryContact ? ` · ${t('pages.athletes.primaryContact')}` : ''}
                  </p>
                  {row.guardian.phone || row.guardian.email ? (
                    <p className="text-xs text-amateur-muted">
                      {[row.guardian.phone, row.guardian.email].filter(Boolean).join(' · ')}
                    </p>
                  ) : null}
                </div>
              </li>
            ))
          )}
        </ul>
        <p className="mt-2 text-xs text-amateur-muted">
          <Link to="/app/guardians/new" className="font-medium text-amateur-accent hover:underline">
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
          {teams.filter((m) => !m.endedAt).length === 0 ? (
            <li className="py-3 text-sm text-amateur-muted">{t('app.states.empty')}</li>
          ) : (
            teams
              .filter((m) => !m.endedAt)
              .map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 py-3">
                  <span className="font-medium">{m.team.name}</span>
                  <Button type="button" variant="ghost" onClick={() => void endMembership(m.id)}>
                    {t('pages.athletes.endMembership')}
                  </Button>
                </li>
              ))
          )}
        </ul>
      </section>
    </div>
  );
}
