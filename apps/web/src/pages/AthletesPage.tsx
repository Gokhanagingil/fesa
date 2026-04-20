import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { BulkActionBar, type BulkActionDescriptor } from '../components/ui/BulkActionBar';
import { EmptyState } from '../components/ui/EmptyState';
import { InlineAlert } from '../components/ui/InlineAlert';
import { ListPageFrame } from '../components/ui/ListPageFrame';
import { PageHeader } from '../components/ui/PageHeader';
import { AthleteAvatar } from '../components/ui/AthleteAvatar';
import { DataExplorer } from '../components/reporting/DataExplorer';
import { apiGet, apiPatch } from '../lib/api';
import { getAthleteStatusLabel, getFamilyReadinessStatusLabel, getPersonName } from '../lib/display';
import { downloadCsv, renderCsvFromRows } from '../lib/imports';
import { useTenant } from '../lib/tenant-hooks';
import type { Athlete, AthleteStatus, ClubGroup, FamilyReadinessStatus, Team } from '../lib/domain-types';

type ListResponse = { items: Athlete[]; total: number };
type BulkUpdateResponse = {
  updatedCount: number;
  endedTeamMemberships: number;
  affectedAthleteIds: string[];
  status: AthleteStatus | null;
  primaryGroupId: string | null;
};

const statusOptions: AthleteStatus[] = ['trial', 'active', 'paused', 'inactive', 'archived'];
const readinessOptions: FamilyReadinessStatus[] = [
  'incomplete',
  'awaiting_guardian_action',
  'awaiting_staff_review',
  'complete',
];

export function AthletesPage() {
  const { t } = useTranslation();
  const { tenantId, loading: tenantLoading } = useTenant();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [groupId, setGroupId] = useState(searchParams.get('groupId') ?? '');
  const [teamId, setTeamId] = useState(searchParams.get('teamId') ?? '');
  const [familyReadinessStatus, setFamilyReadinessStatus] = useState(searchParams.get('familyReadinessStatus') ?? '');
  const [needsFamilyFollowUp, setNeedsFamilyFollowUp] = useState(searchParams.get('needsFamilyFollowUp') === 'true');
  const [items, setItems] = useState<Athlete[]>([]);
  const [total, setTotal] = useState(0);
  const [groups, setGroups] = useState<ClubGroup[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<AthleteStatus | ''>('');
  const [bulkGroupId, setBulkGroupId] = useState('');

  useEffect(() => {
    setQ(searchParams.get('q') ?? '');
    setStatus(searchParams.get('status') ?? '');
    setGroupId(searchParams.get('groupId') ?? '');
    setTeamId(searchParams.get('teamId') ?? '');
    setFamilyReadinessStatus(searchParams.get('familyReadinessStatus') ?? '');
    setNeedsFamilyFollowUp(searchParams.get('needsFamilyFollowUp') === 'true');
  }, [searchParams]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (q.trim()) next.set('q', q.trim());
    if (status) next.set('status', status);
    if (groupId) next.set('groupId', groupId);
    if (teamId) next.set('teamId', teamId);
    if (familyReadinessStatus) next.set('familyReadinessStatus', familyReadinessStatus);
    if (needsFamilyFollowUp) next.set('needsFamilyFollowUp', 'true');
    setSearchParams(next, { replace: true });
  }, [familyReadinessStatus, groupId, needsFamilyFollowUp, q, setSearchParams, status, teamId]);

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
      if (familyReadinessStatus) params.set('familyReadinessStatus', familyReadinessStatus);
      if (needsFamilyFollowUp) params.set('needsFamilyFollowUp', 'true');
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
  }, [familyReadinessStatus, groupId, needsFamilyFollowUp, q, status, t, teamId, tenantId]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 250);
    return () => clearTimeout(id);
  }, [load]);

  useEffect(() => {
    setSelectedAthleteIds((current) => current.filter((id) => items.some((athlete) => athlete.id === id)));
  }, [items]);

  const groupMap = useMemo(() => new Map(groups.map((group) => [group.id, group.name])), [groups]);
  const visibleTeams = useMemo(
    () => (groupId ? teams.filter((team) => team.groupId === groupId) : teams),
    [groupId, teams],
  );
  const activeTeam = teamId ? teams.find((team) => team.id === teamId) : null;
  const selectedAthletes = useMemo(
    () => items.filter((athlete) => selectedAthleteIds.includes(athlete.id)),
    [items, selectedAthleteIds],
  );
  const bulkActionPreview = useMemo(() => {
    const nextGroupName = groups.find((group) => group.id === bulkGroupId)?.name ?? '—';
    if (bulkStatus && bulkGroupId) {
      return t('pages.athletes.bulkActionStatusAndGroup', {
        status: getAthleteStatusLabel(t, bulkStatus),
        group: nextGroupName,
      });
    }
    if (bulkStatus) {
      return t('pages.athletes.bulkActionStatus', {
        status: getAthleteStatusLabel(t, bulkStatus),
      });
    }
    if (bulkGroupId) {
      return t('pages.athletes.bulkActionGroup', {
        group: nextGroupName,
      });
    }
    return t('pages.athletes.bulkActionPreviewIdle');
  }, [bulkGroupId, bulkStatus, groups, t]);

  function toggleSelection(athleteId: string) {
    setSelectedAthleteIds((current) =>
      current.includes(athleteId) ? current.filter((id) => id !== athleteId) : [...current, athleteId],
    );
  }

  function toggleVisibleSelection() {
    if (items.length === 0) {
      return;
    }
    const visibleIds = items.map((athlete) => athlete.id);
    const allVisibleSelected = visibleIds.every((id) => selectedAthleteIds.includes(id));
    if (allVisibleSelected) {
      setSelectedAthleteIds((current) => current.filter((id) => !visibleIds.includes(id)));
      return;
    }
    setSelectedAthleteIds((current) => Array.from(new Set([...current, ...visibleIds])));
  }

  async function applyBulkActions() {
    if (selectedAthleteIds.length === 0 || (!bulkStatus && !bulkGroupId)) {
      return;
    }

    setBulkSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiPatch<BulkUpdateResponse>('/api/athletes/bulk', {
        athleteIds: selectedAthleteIds,
        status: bulkStatus || undefined,
        primaryGroupId: bulkGroupId || undefined,
      });
      const endedTeamsMessage =
        result.endedTeamMemberships > 0
          ? ` ${t('pages.athletes.bulkEndedTeams', { count: result.endedTeamMemberships })}`
          : '';
      setMessage(
        `${t('pages.athletes.bulkSuccess', {
          count: result.updatedCount,
          action: bulkActionPreview,
        })}${endedTeamsMessage}`,
      );
      setSelectedAthleteIds([]);
      setBulkStatus('');
      setBulkGroupId('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    } finally {
      setBulkSaving(false);
    }
  }

  const view = (searchParams.get('view') as 'list' | 'advanced') ?? 'list';

  const exportSelection = useCallback(
    (target: 'visible' | 'selected') => {
      const targetItems = target === 'selected' ? selectedAthletes : items;
      if (targetItems.length === 0) {
        setError(t('app.exportCsv.emptyHint'));
        return;
      }
      const headers = [
        t('pages.athletes.name'),
        t('pages.athletes.primaryGroup'),
        t('pages.athletes.status'),
        t('pages.athletes.jersey'),
      ];
      const rows = targetItems.map((athlete) => ({
        [headers[0]]: getPersonName(athlete),
        [headers[1]]: groupMap.get(athlete.primaryGroupId ?? '') ?? '',
        [headers[2]]: getAthleteStatusLabel(t, athlete.status),
        [headers[3]]: athlete.jerseyNumber ?? '',
      }));
      const csv = renderCsvFromRows(headers, rows);
      const filename = `amateur-athletes-${target}-${new Date().toISOString().slice(0, 10)}.csv`;
      downloadCsv(filename, csv);
      setMessage(t('app.exportCsv.successHint', { count: targetItems.length }));
    },
    [groupMap, items, selectedAthletes, t],
  );

  const handlePrepareMessage = useCallback(() => {
    if (selectedAthleteIds.length === 0) return;
    const params = new URLSearchParams();
    selectedAthleteIds.forEach((id) => params.append('athleteIds', id));
    params.set('source', 'athletes_selection');
    params.set('sourceKey', `athletes-bulk-${selectedAthleteIds.length}`);
    params.set('primaryContactsOnly', 'true');
    navigate(`/app/communications?${params.toString()}`);
  }, [navigate, selectedAthleteIds]);

  const bulkActions: BulkActionDescriptor[] = useMemo(() => {
    const runApply = () => {
      void applyBulkActions();
    };
    return [
      {
        id: 'apply',
        label: t('pages.athletes.bulkApply'),
        disabled: !bulkStatus && !bulkGroupId,
        onClick: runApply,
      },
      {
        id: 'prepare-message',
        ghost: true,
        label: t('pages.athletes.bulkPrepareMessage'),
        onClick: handlePrepareMessage,
      },
      {
        id: 'export-selection',
        ghost: true,
        label: t('app.bulk.exportSelection'),
        onClick: () => exportSelection('selected'),
      },
    ];
    // applyBulkActions is recreated on every render via closure; we only need
    // to refresh button bindings when the bulk form / selection signals change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkGroupId, bulkStatus, exportSelection, handlePrepareMessage, t]);

  return (
    <div>
      <PageHeader title={t('pages.athletes.title')} subtitle={t('pages.athletes.subtitle')} />
      <div className="mb-3 inline-flex overflow-hidden rounded-xl border border-amateur-border bg-amateur-surface text-xs">
        {(['list', 'advanced'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              if (option === 'list') {
                next.delete('view');
              } else {
                next.set('view', option);
              }
              setSearchParams(next, { replace: true });
            }}
            className={`px-4 py-2 font-semibold uppercase tracking-wide ${
              view === option ? 'bg-amateur-accent text-white' : 'text-amateur-muted hover:text-amateur-ink'
            }`}
          >
            {t(`pages.reports.viewToggle.${option}`)}
          </button>
        ))}
      </div>
      {view === 'advanced' ? (
        <ListPageFrame>
          {!tenantId && !tenantLoading ? (
            <p className="text-sm text-amateur-muted">{t('app.errors.needTenant')}</p>
          ) : (
            <DataExplorer entity="athletes" embed />
          )}
        </ListPageFrame>
      ) : (
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
            <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-muted">
              <span>{t('pages.athletes.familyActions.readinessFilter')}</span>
              <select
                value={familyReadinessStatus}
                onChange={(e) => setFamilyReadinessStatus(e.target.value)}
                className="bg-transparent text-amateur-ink outline-none"
              >
                <option value="">{t('pages.athletes.familyActions.readinessFilterAll')}</option>
                {readinessOptions.map((option) => (
                  <option key={option} value={option}>
                    {getFamilyReadinessStatusLabel(t, option)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-muted">
              <input
                type="checkbox"
                checked={needsFamilyFollowUp}
                onChange={(e) => setNeedsFamilyFollowUp(e.target.checked)}
              />
              <span>{t('pages.athletes.familyActions.followUpFilter')}</span>
            </label>
            <Button type="button" variant="ghost" onClick={() => exportSelection('visible')}>
              {t('app.exportCsv.label')}
            </Button>
            <Link to="/app/athletes/new">
              <Button>{t('pages.athletes.new')}</Button>
            </Link>
          </>
        }
      >
        {message ? (
          <InlineAlert tone="success" className="mb-4">
            {message}
          </InlineAlert>
        ) : null}
        {!tenantId && !tenantLoading ? (
          <p className="text-sm text-amateur-muted">{t('app.errors.needTenant')}</p>
        ) : error ? (
          <InlineAlert tone="error" className="mb-4">
            {error}
          </InlineAlert>
        ) : loading ? (
          <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>
        ) : items.length === 0 ? (
          <EmptyState title={t('pages.athletes.empty')} hint={t('pages.athletes.emptyHint')} />
        ) : (
          <div className="space-y-4">
            <BulkActionBar
              title={t('pages.athletes.bulkTitle')}
              subtitle={t('pages.athletes.bulkHint')}
              selectedCount={selectedAthletes.length}
              visibleTotal={items.length}
              allVisibleSelected={
                items.length > 0 && items.every((athlete) => selectedAthleteIds.includes(athlete.id))
              }
              onToggleVisible={toggleVisibleSelection}
              onClearSelection={() => setSelectedAthleteIds([])}
              busy={bulkSaving}
              actions={bulkActions}
            />
            {selectedAthletes.length > 0 ? (
              <section className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <label className="flex flex-col gap-1 text-sm">
                      <span>{t('pages.athletes.bulkStatus')}</span>
                      <select
                        value={bulkStatus}
                        onChange={(e) => setBulkStatus((e.target.value as AthleteStatus) || '')}
                        className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-amateur-ink"
                      >
                        <option value="">{t('pages.athletes.bulkKeepStatus')}</option>
                        {statusOptions.map((option) => (
                          <option key={option} value={option}>
                            {getAthleteStatusLabel(t, option)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span>{t('pages.athletes.bulkGroupMove')}</span>
                      <select
                        value={bulkGroupId}
                        onChange={(e) => setBulkGroupId(e.target.value)}
                        className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-amateur-ink"
                      >
                        <option value="">{t('pages.athletes.bulkKeepGroup')}</option>
                        {groups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="rounded-xl border border-amateur-border bg-amateur-surface px-4 py-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
                      {t('pages.athletes.bulkPreviewTitle')}
                    </p>
                    <p className="mt-2 text-sm text-amateur-muted">{bulkActionPreview}</p>
                    <p className="mt-2 text-xs text-amateur-muted">{t('pages.athletes.bulkSafetyNote')}</p>
                  </div>
                </div>
              </section>
            ) : null}
            <div className="overflow-x-auto">
            {activeTeam ? (
              <p className="mb-3 text-xs text-amateur-muted">
                {t('pages.athletes.teamFilterHint', { team: activeTeam.name })}
              </p>
            ) : null}
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-amateur-border text-amateur-muted">
                  <th className="pb-2 pr-4 font-medium">
                    <span className="sr-only">{t('app.actions.bulk')}</span>
                  </th>
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
                      <input
                        type="checkbox"
                        checked={selectedAthleteIds.includes(a.id)}
                        onChange={() => toggleSelection(a.id)}
                        aria-label={t('pages.athletes.bulkSelectAthlete', { athlete: getPersonName(a) })}
                      />
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <AthleteAvatar athlete={a} size="sm" />
                        <div>
                          <p className="font-medium text-amateur-ink">{getPersonName(a)}</p>
                          <p className="text-xs text-amateur-muted">
                            {[
                              a.jerseyNumber ? `${t('pages.athletes.jersey')} ${a.jerseyNumber}` : null,
                              a.sportBranch?.name ?? null,
                            ]
                              .filter(Boolean)
                              .join(' · ') || '—'}
                          </p>
                        </div>
                      </div>
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
          </div>
        )}
      </ListPageFrame>
      )}
    </div>
  );
}
