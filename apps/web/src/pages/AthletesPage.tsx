import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ListPageFrame } from '../components/ui/ListPageFrame';
import { PageHeader } from '../components/ui/PageHeader';
import { apiGet } from '../lib/api';
import { getAthleteStatusLabel, getPersonName } from '../lib/display';
import { useTenant } from '../lib/tenant-hooks';
import type { Athlete, AthleteStatus, ClubGroup, Team } from '../lib/domain-types';

type ListResponse = { items: Athlete[]; total: number };
const statusOptions: AthleteStatus[] = ['active', 'inactive', 'trial', 'archived'];

export function AthletesPage() {
  const { t } = useTranslation();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [groupId, setGroupId] = useState(searchParams.get('groupId') ?? '');
  const [teamId, setTeamId] = useState(searchParams.get('teamId') ?? '');
  const [items, setItems] = useState<Athlete[]>([]);
  const [total, setTotal] = useState(0);
  const [groups, setGroups] = useState<ClubGroup[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setQ(searchParams.get('q') ?? '');
    setStatus(searchParams.get('status') ?? '');
    setGroupId(searchParams.get('groupId') ?? '');
    setTeamId(searchParams.get('teamId') ?? '');
  }, [searchParams]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (q.trim()) next.set('q', q.trim());
    if (status) next.set('status', status);
    if (groupId) next.set('groupId', groupId);
    if (teamId) next.set('teamId', teamId);
    setSearchParams(next, { replace: true });
  }, [groupId, q, setSearchParams, status, teamId]);

  useEffect(() => {
    if (!tenantId) return;
    void (async () => {
      try {
        const [groupRes, teamRes] = await Promise.all([
          apiGet<{ items: ClubGroup[] }>('/api/groups?limit=200'),
          apiGet<{ items: Team[] }>('/api/teams?limit=200'),
        ]);
        setGroups(groupRes.items);
        setTeams(teamRes.items);
      } catch {
        setGroups([]);
        setTeams([]);
      }
    })();
  }, [tenantId]);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (status) params.set('status', status);
      if (groupId) params.set('primaryGroupId', groupId);
      if (teamId) params.set('teamId', teamId);
      params.set('limit', '100');
      const path = `/api/athletes?${params.toString()}`;
      const res = await apiGet<ListResponse>(path);
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [groupId, q, status, t, teamId, tenantId]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 250);
    return () => clearTimeout(id);
  }, [load]);

  const groupMap = useMemo(() => new Map(groups.map((group) => [group.id, group.name])), [groups]);
  const visibleTeams = useMemo(
    () => (groupId ? teams.filter((team) => team.groupId === groupId) : teams),
    [groupId, teams],
  );
  const activeTeam = teamId ? teams.find((team) => team.id === teamId) : null;

  return (
    <div>
      <PageHeader title={t('pages.athletes.title')} subtitle={t('pages.athletes.subtitle')} />
      <ListPageFrame
        search={{ value: q, onChange: setQ, disabled: !tenantId || tenantLoading }}
        toolbar={
          <>
            <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-muted">
              <span>{t('pages.athletes.primaryGroup')}</span>
              <select
                value={groupId}
                onChange={(e) => {
                  setGroupId(e.target.value);
                  setTeamId('');
                }}
                className="bg-transparent text-amateur-ink outline-none"
              >
                <option value="">{t('pages.athletes.allGroups')}</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-muted">
              <span>{t('pages.teams.title')}</span>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="bg-transparent text-amateur-ink outline-none"
              >
                <option value="">{t('pages.athletes.allTeams')}</option>
                {visibleTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-muted">
              <span>{t('pages.athletes.status')}</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="bg-transparent text-amateur-ink outline-none"
              >
                <option value="">{t('pages.athletes.allStatuses')}</option>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {getAthleteStatusLabel(t, option)}
                  </option>
                ))}
              </select>
            </label>
            <Link to="/app/athletes/new">
              <Button>{t('pages.athletes.new')}</Button>
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
          <EmptyState title={t('pages.athletes.empty')} hint={t('pages.athletes.emptyHint')} />
        ) : (
          <div className="overflow-x-auto">
            {activeTeam ? (
              <p className="mb-3 text-xs text-amateur-muted">
                {t('pages.athletes.teamFilterHint', { team: activeTeam.name })}
              </p>
            ) : null}
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-amateur-border text-amateur-muted">
                  <th className="pb-2 pr-4 font-medium">{t('pages.athletes.name')}</th>
                  <th className="pb-2 pr-4 font-medium">{t('pages.athletes.primaryGroup')}</th>
                  <th className="pb-2 pr-4 font-medium">{t('pages.athletes.status')}</th>
                  <th className="pb-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id} className="border-b border-amateur-border/70 last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-amateur-ink">{getPersonName(a)}</p>
                      <p className="text-xs text-amateur-muted">
                        {a.jerseyNumber ? `${t('pages.athletes.jersey')} ${a.jerseyNumber}` : '—'}
                      </p>
                    </td>
                    <td className="py-3 pr-4 text-amateur-muted">{groupMap.get(a.primaryGroupId ?? '') ?? '—'}</td>
                    <td className="py-3 pr-4 text-amateur-muted">{getAthleteStatusLabel(t, a.status)}</td>
                    <td className="py-3 text-right">
                      <Link
                        to={`/app/athletes/${a.id}`}
                        className="font-medium text-amateur-accent hover:underline"
                      >
                        {t('pages.athletes.detailTitle')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-amateur-muted">{t('app.count.rows', { count: total })}</p>
          </div>
        )}
      </ListPageFrame>
    </div>
  );
}
