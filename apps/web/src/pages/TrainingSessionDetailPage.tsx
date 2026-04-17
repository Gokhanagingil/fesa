import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { apiGet, apiPost } from '../lib/api';
import {
  formatDateTime,
  getAttendanceStatusLabel,
  getCoachName,
  getPersonName,
  getTrainingStatusLabel,
} from '../lib/display';
import type {
  Athlete,
  AttendanceRow,
  AttendanceStatus,
  ClubGroup,
  Coach,
  Team,
  TrainingSession,
} from '../lib/domain-types';
import { useTenant } from '../lib/tenant-hooks';

const attendanceOptions: AttendanceStatus[] = ['present', 'absent', 'excused', 'late'];
type DraftAttendanceStatus = AttendanceStatus | 'unset';

export function TrainingSessionDetailPage() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { tenantId } = useTenant();
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [roster, setRoster] = useState<Athlete[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [groups, setGroups] = useState<ClubGroup[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [draft, setDraft] = useState<Record<string, DraftAttendanceStatus>>({});
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId || !id) return;
    setLoading(true);
    setError(null);
    try {
      const s = await apiGet<TrainingSession>(`/api/training-sessions/${id}`);
      const athleteParams = new URLSearchParams({
        primaryGroupId: s.groupId,
        limit: '500',
      });
      if (s.teamId) athleteParams.set('teamId', s.teamId);
      const [att, athletes] = await Promise.all([
        apiGet<AttendanceRow[]>(`/api/training-sessions/${id}/attendance`),
        apiGet<{ items: Athlete[] }>(`/api/athletes?${athleteParams.toString()}`),
      ]);
      const [groupRes, teamRes, coachRes] = await Promise.all([
        apiGet<{ items: ClubGroup[] }>('/api/groups?limit=200'),
        apiGet<{ items: Team[] }>('/api/teams?limit=200'),
        apiGet<{ items: Coach[] }>('/api/coaches?limit=200'),
      ]);
      setSession(s);
      setAttendance(att);
      setRoster(athletes.items);
      setGroups(groupRes.items);
      setTeams(teamRes.items);
      setCoaches(coachRes.items);
      const next: Record<string, DraftAttendanceStatus> = {};
      for (const row of att) {
        next[row.athlete.id] = row.status;
      }
      for (const a of athletes.items) {
        if (!next[a.id]) next[a.id] = 'unset';
      }
      setDraft(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [id, t, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const map = new Map(attendance.map((r) => [r.athlete.id, r]));
    const list: { athlete: Athlete; attendanceId?: string }[] = [];
    for (const a of roster) {
      list.push({ athlete: a, attendanceId: map.get(a.id)?.id });
    }
    for (const r of attendance) {
      if (!roster.some((a) => a.id === r.athlete.id)) {
        list.push({ athlete: r.athlete, attendanceId: r.id });
      }
    }
    if (!query.trim()) return list;
    const term = query.trim().toLowerCase();
    return list.filter(({ athlete }) =>
      `${athlete.firstName} ${athlete.lastName}`.toLowerCase().includes(term) ||
      `${athlete.lastName} ${athlete.firstName}`.toLowerCase().includes(term),
    );
  }, [attendance, query, roster]);

  const summary = useMemo(
    () =>
      attendanceOptions.reduce<Record<AttendanceStatus, number>>(
        (acc, status) => ({
          ...acc,
          [status]: Object.values(draft).filter((value) => value === status).length,
        }),
        { present: 0, absent: 0, excused: 0, late: 0 },
      ),
    [draft],
  );
  const unsetCount = useMemo(
    () => Object.values(draft).filter((value) => value === 'unset').length,
    [draft],
  );

  const groupName = session ? groups.find((group) => group.id === session.groupId)?.name : undefined;
  const teamName = session?.teamId ? teams.find((team) => team.id === session.teamId)?.name : undefined;
  const coachName = session?.coachId ? getCoachName(coaches.find((coach) => coach.id === session.coachId)) : null;

  function applyBulkStatus(status: DraftAttendanceStatus) {
    setDraft((current) => {
      const next = { ...current };
      for (const { athlete } of rows) {
        next[athlete.id] = status;
      }
      return next;
    });
  }

  async function save() {
    if (!id) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const body = {
        rows: Object.entries(draft)
          .filter(([, status]) => status !== 'unset')
          .map(([athleteId, status]) => ({ athleteId, status: status as AttendanceStatus })),
      };
      await apiPost(`/api/training-sessions/${id}/attendance/bulk`, body);
      setMessage(t('pages.training.savedAttendance'));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  if (loading || !session) {
    return (
      <div>
        <PageHeader title={t('pages.training.detailTitle')} subtitle="" />
        <p className="text-sm text-amateur-muted">{error ?? t('app.states.loading')}</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={session.title} subtitle={t('pages.training.attendance')} />
      <div className="mb-6 rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
        <p className="text-sm text-amateur-muted">
          {formatDateTime(session.scheduledStart, i18n.language)} —{' '}
          {formatDateTime(session.scheduledEnd, i18n.language)}
        </p>
        <p className="mt-2 text-sm text-amateur-muted">
          {t('pages.athletes.primaryGroup')}: {groupName ?? t('pages.training.unknownGroup')}
          {teamName ? ` · ${t('pages.teams.title')}: ${teamName}` : ''}
          {coachName ? ` · ${t('pages.coaches.title')}: ${coachName}` : ''}
        </p>
        {session.location ? (
          <p className="mt-1 text-sm">
            {t('pages.training.location')}: {session.location}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-amateur-muted">{getTrainingStatusLabel(t, session.status)}</p>
      </div>

      <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
        <p className="text-sm text-amateur-muted">{t('pages.training.attendanceHint')}</p>
        <div className="mt-3 rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-3 text-sm text-amateur-muted">
          <p className="font-medium text-amateur-ink">{t('pages.training.attendanceFlowTitle')}</p>
          <p className="mt-1">{t('pages.training.attendanceFlowBody')}</p>
        </div>
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
        {message ? <p className="mt-2 text-sm text-amateur-accent">{message}</p> : null}
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-muted">
            <span>{t('app.actions.search')}</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('pages.training.searchRoster')}
              className="min-w-[12rem] bg-transparent text-amateur-ink outline-none placeholder:text-amateur-muted"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={() => applyBulkStatus('unset')}>
              {t('pages.training.clearMarkedStatuses')}
            </Button>
            {attendanceOptions.map((status) => (
              <Button key={status} type="button" variant="ghost" onClick={() => applyBulkStatus(status)}>
                {t('pages.training.markAll', { status: getAttendanceStatusLabel(t, status) })}
              </Button>
            ))}
          </div>
        </div>
        {unsetCount > 0 ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {t('pages.training.unmarkedAttendanceHint', { count: unsetCount })}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {t('pages.training.attendanceReadyHint')}
          </div>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border border-amateur-border bg-amateur-canvas px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
              {t('pages.training.unmarkedAttendance')}
            </p>
            <p className="mt-1 font-display text-2xl font-semibold text-amateur-ink">{unsetCount}</p>
          </div>
          {attendanceOptions.map((status) => (
            <div key={status} className="rounded-xl border border-amateur-border bg-amateur-canvas px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
                {getAttendanceStatusLabel(t, status)}
              </p>
              <p className="mt-1 font-display text-2xl font-semibold text-amateur-ink">{summary[status]}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-amateur-border text-amateur-muted">
                <th className="pb-2 font-medium">{t('pages.athletes.name')}</th>
                <th className="pb-2 font-medium">{t('pages.training.attendance')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ athlete: a, attendanceId }) => {
                const isUnset = (draft[a.id] ?? 'unset') === 'unset';
                return (
                <tr key={a.id} className="border-b border-amateur-border/60 last:border-0">
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-2">
                      <span>{getPersonName(a)}</span>
                      {attendanceId ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          {t('pages.training.recordedBadge')}
                        </span>
                      ) : null}
                      {isUnset ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                          {t('pages.training.unmarkedBadge')}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-2">
                    <select
                      value={draft[a.id] ?? 'unset'}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [a.id]: e.target.value as DraftAttendanceStatus }))
                      }
                      className="rounded-lg border border-amateur-border bg-amateur-canvas px-2 py-1 text-sm"
                    >
                      <option value="unset">{t('pages.training.attendanceUnset')}</option>
                      {attendanceOptions.map((o) => (
                        <option key={o} value={o}>
                          {getAttendanceStatusLabel(t, o)}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {t('pages.training.saveAttendance')}
          </Button>
          <Link to="/app/training">
            <Button type="button" variant="ghost">
              {t('pages.athletes.cancel')}
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
