import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ListPageFrame } from '../components/ui/ListPageFrame';
import { PageHeader } from '../components/ui/PageHeader';
import { apiGet } from '../lib/api';
import { formatDateTime, getTrainingStatusLabel } from '../lib/display';
import { useTenant } from '../lib/tenant-hooks';
import type { ClubGroup, Team, TrainingSession, TrainingSessionStatus } from '../lib/domain-types';

type ListResponse = { items: TrainingSession[]; total: number };
const sessionStatuses: TrainingSessionStatus[] = ['planned', 'completed', 'cancelled'];

export function TrainingSessionsPage() {
  const { t, i18n } = useTranslation();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const [groupId, setGroupId] = useState(searchParams.get('groupId') ?? '');
  const [teamId, setTeamId] = useState(searchParams.get('teamId') ?? '');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [items, setItems] = useState<TrainingSession[]>([]);
  const [groups, setGroups] = useState<ClubGroup[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setGroupId(searchParams.get('groupId') ?? '');
    setTeamId(searchParams.get('teamId') ?? '');
    setStatus(searchParams.get('status') ?? '');
  }, [searchParams]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (groupId) next.set('groupId', groupId);
    if (teamId) next.set('teamId', teamId);
    if (status) next.set('status', status);
    setSearchParams(next, { replace: true });
  }, [groupId, setSearchParams, status, teamId]);

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
      const params = new URLSearchParams({ limit: '100' });
      if (groupId) params.set('groupId', groupId);
      if (teamId) params.set('teamId', teamId);
      if (status) params.set('status', status);
      const res = await apiGet<ListResponse>(`/api/training-sessions?${params.toString()}`);
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [groupId, status, t, teamId, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const groupMap = useMemo(() => new Map(groups.map((group) => [group.id, group.name])), [groups]);
  const teamMap = useMemo(() => new Map(teams.map((team) => [team.id, team.name])), [teams]);
  const visibleTeams = useMemo(
    () => (groupId ? teams.filter((team) => team.groupId === groupId) : teams),
    [groupId, teams],
  );

  return (
    <div>
      <PageHeader title={t('pages.training.title')} subtitle={t('pages.training.subtitle')} />
      <ListPageFrame
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
                <option value="">{t('pages.training.allGroups')}</option>
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
                <option value="">{t('pages.training.allTeams')}</option>
                {visibleTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-muted">
              <span>{t('pages.training.status')}</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="bg-transparent text-amateur-ink outline-none"
              >
                <option value="">{t('pages.training.allStatuses')}</option>
                {sessionStatuses.map((option) => (
                  <option key={option} value={option}>
                    {getTrainingStatusLabel(t, option)}
                  </option>
                ))}
              </select>
            </label>
            <Link to="/app/training/new">
              <Button>{t('pages.training.new')}</Button>
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
          <EmptyState title={t('pages.training.empty')} hint={t('pages.training.emptyHint')} />
        ) : (
          <ul className="divide-y divide-amateur-border">
            {items.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-medium text-amateur-ink">{s.title}</p>
                  <p className="text-sm text-amateur-muted">
                    {formatDateTime(s.scheduledStart, i18n.language)} — {formatDateTime(s.scheduledEnd, i18n.language)}
                  </p>
                  <p className="mt-1 text-xs text-amateur-muted">
                    {groupMap.get(s.groupId) ?? t('pages.training.unknownGroup')}
                    {s.teamId ? ` · ${teamMap.get(s.teamId) ?? t('pages.training.unknownTeam')}` : ''}
                  </p>
                  {s.location ? (
                    <p className="text-xs text-amateur-muted">
                      {t('pages.training.location')}: {s.location}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amateur-accent-soft px-3 py-1 text-xs font-medium text-amateur-accent">
                    {getTrainingStatusLabel(t, s.status)}
                  </span>
                  <Link
                    to={`/app/training/${s.id}`}
                    className="text-sm font-semibold text-amateur-accent hover:underline"
                  >
                    {t('pages.training.attendance')} →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </ListPageFrame>
    </div>
  );
}
