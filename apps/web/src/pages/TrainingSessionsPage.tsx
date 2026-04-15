import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { InlineAlert } from '../components/ui/InlineAlert';
import { ListPageFrame } from '../components/ui/ListPageFrame';
import { PageHeader } from '../components/ui/PageHeader';
import { apiGet, apiPost } from '../lib/api';
import { formatDate, formatDateTime, getTrainingStatusLabel } from '../lib/display';
import { useTenant } from '../lib/tenant-hooks';
import type { ClubGroup, Coach, Team, TrainingSession, TrainingSessionStatus } from '../lib/domain-types';

type ListResponse = { items: TrainingSession[]; total: number };
type BulkResponse = TrainingSession[];
type SeriesResponse = { items: TrainingSession[]; generatedCount: number; skippedCount: number };

const sessionStatuses: TrainingSessionStatus[] = ['planned', 'completed', 'cancelled'];
const weekdayOptions = [
  { value: 1, key: 'pages.training.weekdays.monday' },
  { value: 2, key: 'pages.training.weekdays.tuesday' },
  { value: 3, key: 'pages.training.weekdays.wednesday' },
  { value: 4, key: 'pages.training.weekdays.thursday' },
  { value: 5, key: 'pages.training.weekdays.friday' },
  { value: 6, key: 'pages.training.weekdays.saturday' },
  { value: 7, key: 'pages.training.weekdays.sunday' },
] as const;

function toDateInput(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfWeek(base: Date): Date {
  const next = new Date(base);
  const weekday = next.getDay() === 0 ? 7 : next.getDay();
  next.setDate(next.getDate() - (weekday - 1));
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(base: Date, amount: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + amount);
  return next;
}

function rangeLabel(startIso: string, endIso: string, language: string): string {
  return `${formatDateTime(startIso, language)} - ${formatDateTime(endIso, language)}`;
}

export function TrainingSessionsPage() {
  const { t, i18n } = useTranslation();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialWeekStart = useMemo(() => startOfWeek(new Date()), []);
  const initialWeekEnd = useMemo(() => addDays(initialWeekStart, 6), [initialWeekStart]);

  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [groupId, setGroupId] = useState(searchParams.get('groupId') ?? '');
  const [teamId, setTeamId] = useState(searchParams.get('teamId') ?? '');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [from, setFrom] = useState(searchParams.get('from') ?? toDateInput(initialWeekStart));
  const [to, setTo] = useState(searchParams.get('to') ?? toDateInput(initialWeekEnd));
  const [items, setItems] = useState<TrainingSession[]>([]);
  const [groups, setGroups] = useState<ClubGroup[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState<'cancel' | 'shift'>('cancel');
  const [bulkShiftDays, setBulkShiftDays] = useState('1');
  const [bulkNote, setBulkNote] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  const [seriesOpen, setSeriesOpen] = useState(false);
  const [seriesTitle, setSeriesTitle] = useState('');
  const [seriesBranchId, setSeriesBranchId] = useState('');
  const [seriesGroupId, setSeriesGroupId] = useState('');
  const [seriesTeamId, setSeriesTeamId] = useState('');
  const [seriesStartsOn, setSeriesStartsOn] = useState(toDateInput(initialWeekStart));
  const [seriesEndsOn, setSeriesEndsOn] = useState(toDateInput(addDays(initialWeekStart, 27)));
  const [seriesStartTime, setSeriesStartTime] = useState('18:00');
  const [seriesEndTime, setSeriesEndTime] = useState('19:30');
  const [seriesLocation, setSeriesLocation] = useState('');
  const [seriesWeekdays, setSeriesWeekdays] = useState<number[]>([2, 4]);
  const [seriesSaving, setSeriesSaving] = useState(false);

  useEffect(() => {
    setQ(searchParams.get('q') ?? '');
    setGroupId(searchParams.get('groupId') ?? '');
    setTeamId(searchParams.get('teamId') ?? '');
    setStatus(searchParams.get('status') ?? '');
    setFrom(searchParams.get('from') ?? toDateInput(initialWeekStart));
    setTo(searchParams.get('to') ?? toDateInput(initialWeekEnd));
  }, [initialWeekEnd, initialWeekStart, searchParams]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (q.trim()) next.set('q', q.trim());
    if (groupId) next.set('groupId', groupId);
    if (teamId) next.set('teamId', teamId);
    if (status) next.set('status', status);
    if (from) next.set('from', from);
    if (to) next.set('to', to);
    setSearchParams(next, { replace: true });
  }, [from, groupId, q, setSearchParams, status, teamId, to]);

  useEffect(() => {
    if (!tenantId) return;
    void (async () => {
      try {
        const [groupRes, teamRes, coachRes] = await Promise.all([
          apiGet<{ items: ClubGroup[] }>('/api/groups?limit=200'),
          apiGet<{ items: Team[] }>('/api/teams?limit=200'),
          apiGet<{ items: Coach[] }>('/api/coaches?limit=200&isActive=true'),
        ]);
        setGroups(groupRes.items);
        setTeams(teamRes.items);
        setCoaches(coachRes.items);
      } catch {
        setGroups([]);
        setTeams([]);
        setCoaches([]);
      }
    })();
  }, [tenantId]);

  useEffect(() => {
    if (!seriesGroupId && groupId) {
      setSeriesGroupId(groupId);
    }
  }, [groupId, seriesGroupId]);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (q.trim()) params.set('q', q.trim());
      if (groupId) params.set('groupId', groupId);
      if (teamId) params.set('teamId', teamId);
      if (status) params.set('status', status);
      if (from) params.set('from', new Date(`${from}T00:00:00`).toISOString());
      if (to) params.set('to', new Date(`${to}T23:59:59`).toISOString());
      const res = await apiGet<ListResponse>(`/api/training-sessions?${params.toString()}`);
      setItems(res.items);
      setSelectedIds((current) => current.filter((id) => res.items.some((item) => item.id === id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [from, groupId, q, status, t, teamId, tenantId, to]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 200);
    return () => clearTimeout(id);
  }, [load]);

  const groupMap = useMemo(() => new Map(groups.map((group) => [group.id, group.name])), [groups]);
  const teamMap = useMemo(() => new Map(teams.map((team) => [team.id, team.name])), [teams]);
  const coachMap = useMemo(() => new Map(coaches.map((coach) => [coach.id, coach.preferredName || `${coach.firstName} ${coach.lastName}`])), [coaches]);
  const visibleTeams = useMemo(
    () => (groupId ? teams.filter((team) => team.groupId === groupId) : teams),
    [groupId, teams],
  );
  const seriesVisibleTeams = useMemo(
    () => (seriesGroupId ? teams.filter((team) => team.groupId === seriesGroupId) : teams),
    [seriesGroupId, teams],
  );

  useEffect(() => {
    if (seriesGroupId) {
      const group = groups.find((item) => item.id === seriesGroupId);
      setSeriesBranchId(group?.sportBranchId ?? '');
    }
  }, [groups, seriesGroupId]);

  const calendarDays = useMemo(() => {
    const start = from ? new Date(`${from}T00:00:00`) : initialWeekStart;
    return Array.from({ length: 7 }, (_, index) => {
      const current = addDays(start, index);
      const key = current.toISOString().slice(0, 10);
      const dayItems = items.filter((item) => item.scheduledStart.slice(0, 10) === key);
      return { key, date: current, items: dayItems };
    });
  }, [from, initialWeekStart, items]);

  function toggleSelected(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function selectVisible() {
    setSelectedIds(items.map((item) => item.id));
  }

  function clearSelected() {
    setSelectedIds([]);
  }

  async function runBulkAction() {
    if (selectedIds.length === 0) return;
    setBulkSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload =
        bulkMode === 'cancel'
          ? {
              sessionIds: selectedIds,
              action: 'cancel',
              noteAppend: bulkNote || undefined,
            }
          : {
              sessionIds: selectedIds,
              action: 'shift',
              shiftDays: Number.parseInt(bulkShiftDays || '0', 10),
              noteAppend: bulkNote || undefined,
            };
      const updated = await apiPost<BulkResponse>('/api/training-sessions/bulk', payload);
      setMessage(
        bulkMode === 'cancel'
          ? t('pages.training.bulkCancelled', { count: updated.length })
          : t('pages.training.bulkShifted', { count: updated.length }),
      );
      setBulkNote('');
      setSelectedIds([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    } finally {
      setBulkSaving(false);
    }
  }

  function toggleWeekday(day: number) {
    setSeriesWeekdays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort((a, b) => a - b),
    );
  }

  async function createSeries() {
    if (!seriesTitle || !seriesBranchId || !seriesGroupId || seriesWeekdays.length === 0) return;
    setSeriesSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await apiPost<SeriesResponse>('/api/training-sessions/series', {
        title: seriesTitle,
        sportBranchId: seriesBranchId,
        groupId: seriesGroupId,
        teamId: seriesTeamId || undefined,
        startsOn: seriesStartsOn,
        endsOn: seriesEndsOn,
        weekdays: seriesWeekdays,
        sessionStartTime: seriesStartTime,
        sessionEndTime: seriesEndTime,
        location: seriesLocation || undefined,
      });
      setMessage(
        t('pages.training.seriesCreated', {
          count: res.generatedCount,
          skipped: res.skippedCount,
        }),
      );
      setSeriesOpen(false);
      setSeriesTitle('');
      setSeriesTeamId('');
      setSeriesLocation('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    } finally {
      setSeriesSaving(false);
    }
  }

  const summary = useMemo(
    () => ({
      planned: items.filter((item) => item.status === 'planned').length,
      completed: items.filter((item) => item.status === 'completed').length,
      cancelled: items.filter((item) => item.status === 'cancelled').length,
    }),
    [items],
  );

  return (
    <div>
      <PageHeader
        title={t('pages.training.title')}
        subtitle={t('pages.training.subtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={() => setSeriesOpen((current) => !current)}>
              {t('pages.training.recurringAction')}
            </Button>
            <Link to="/app/training/new">
              <Button>{t('pages.training.new')}</Button>
            </Link>
          </div>
        }
      />

      {message ? <InlineAlert tone="success" className="mb-4">{message}</InlineAlert> : null}
      {error ? <InlineAlert tone="error" className="mb-4">{error}</InlineAlert> : null}

      {seriesOpen ? (
        <section className="mb-6 rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-amateur-ink">
                {t('pages.training.recurringTitle')}
              </h2>
              <p className="text-sm text-amateur-muted">{t('pages.training.recurringHint')}</p>
            </div>
            <Button type="button" variant="ghost" onClick={() => setSeriesOpen(false)}>
              {t('app.actions.cancel')}
            </Button>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pages.training.sessionTitle')}</span>
              <input
                value={seriesTitle}
                onChange={(e) => setSeriesTitle(e.target.value)}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pages.athletes.primaryGroup')}</span>
              <select
                value={seriesGroupId}
                onChange={(e) => {
                  setSeriesGroupId(e.target.value);
                  setSeriesTeamId('');
                }}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              >
                <option value="">{t('pages.training.allGroups')}</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pages.training.teamOptional')}</span>
              <select
                value={seriesTeamId}
                onChange={(e) => setSeriesTeamId(e.target.value)}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              >
                <option value="">{t('pages.training.fullGroupOption')}</option>
                {seriesVisibleTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pages.training.location')}</span>
              <input
                value={seriesLocation}
                onChange={(e) => setSeriesLocation(e.target.value)}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pages.training.recurringStartsOn')}</span>
              <input
                type="date"
                value={seriesStartsOn}
                onChange={(e) => setSeriesStartsOn(e.target.value)}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pages.training.recurringEndsOn')}</span>
              <input
                type="date"
                value={seriesEndsOn}
                onChange={(e) => setSeriesEndsOn(e.target.value)}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pages.training.startTime')}</span>
              <input
                type="time"
                value={seriesStartTime}
                onChange={(e) => setSeriesStartTime(e.target.value)}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pages.training.endTime')}</span>
              <input
                type="time"
                value={seriesEndTime}
                onChange={(e) => setSeriesEndTime(e.target.value)}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              />
            </label>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-amateur-ink">{t('pages.training.recurringWeekdays')}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {weekdayOptions.map((weekday) => {
                const selected = seriesWeekdays.includes(weekday.value);
                return (
                  <button
                    key={weekday.value}
                    type="button"
                    onClick={() => toggleWeekday(weekday.value)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      selected
                        ? 'border-amateur-accent bg-amateur-accent-soft text-amateur-accent'
                        : 'border-amateur-border bg-amateur-canvas text-amateur-muted'
                    }`}
                  >
                    {t(weekday.key)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => void createSeries()}
              disabled={!seriesTitle || !seriesBranchId || !seriesGroupId || seriesWeekdays.length === 0 || seriesSaving}
            >
              {t('pages.training.generateSeries')}
            </Button>
          </div>
        </section>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-amateur-border bg-amateur-surface p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
            {t('pages.training.summaryPlanned')}
          </p>
          <p className="mt-2 font-display text-3xl font-semibold text-amateur-ink">{summary.planned}</p>
        </div>
        <div className="rounded-2xl border border-amateur-border bg-amateur-surface p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
            {t('pages.training.summaryCompleted')}
          </p>
          <p className="mt-2 font-display text-3xl font-semibold text-amateur-ink">{summary.completed}</p>
        </div>
        <div className="rounded-2xl border border-amateur-border bg-amateur-surface p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
            {t('pages.training.summaryCancelled')}
          </p>
          <p className="mt-2 font-display text-3xl font-semibold text-amateur-ink">{summary.cancelled}</p>
        </div>
      </div>

      <ListPageFrame
        search={{
          value: q,
          onChange: setQ,
          disabled: !tenantId || tenantLoading,
          placeholder: t('pages.training.searchSessions'),
        }}
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
            <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-muted">
              <span>{t('pages.training.from')}</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="bg-transparent text-amateur-ink outline-none"
              />
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-muted">
              <span>{t('pages.training.to')}</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="bg-transparent text-amateur-ink outline-none"
              />
            </label>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setQ('');
                setGroupId('');
                setTeamId('');
                setStatus('');
                setFrom(toDateInput(initialWeekStart));
                setTo(toDateInput(initialWeekEnd));
              }}
            >
              {t('app.actions.clear')}
            </Button>
          </>
        }
      >
        {!tenantId && !tenantLoading ? (
          <p className="text-sm text-amateur-muted">{t('app.errors.needTenant')}</p>
        ) : loading ? (
          <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>
        ) : items.length === 0 ? (
          <EmptyState title={t('pages.training.empty')} hint={t('pages.training.emptyHint')} />
        ) : (
          <div className="space-y-6">
            <section className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-amateur-ink">
                    {t('pages.training.bulkTitle')}
                  </h2>
                  <p className="mt-1 text-sm text-amateur-muted">{t('pages.training.bulkHint')}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" onClick={selectVisible}>
                    {t('pages.training.selectVisible')}
                  </Button>
                  <Button type="button" variant="ghost" onClick={clearSelected}>
                    {t('pages.training.clearSelection')}
                  </Button>
                </div>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
                <label className="flex flex-col gap-1 text-sm">
                  <span>{t('pages.training.bulkAction')}</span>
                  <select
                    value={bulkMode}
                    onChange={(e) => setBulkMode(e.target.value as 'cancel' | 'shift')}
                    className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                  >
                    <option value="cancel">{t('pages.training.bulkCancel')}</option>
                    <option value="shift">{t('pages.training.bulkShift')}</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span>{t('pages.training.bulkShiftDays')}</span>
                  <input
                    type="number"
                    value={bulkShiftDays}
                    onChange={(e) => setBulkShiftDays(e.target.value)}
                    disabled={bulkMode !== 'shift'}
                    className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 disabled:opacity-60"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm lg:col-span-2">
                  <span>{t('pages.training.bulkNote')}</span>
                  <input
                    value={bulkNote}
                    onChange={(e) => setBulkNote(e.target.value)}
                    placeholder={t('pages.training.bulkNotePlaceholder')}
                    className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                  />
                </label>
                <div className="flex items-end">
                  <Button
                    type="button"
                    onClick={() => void runBulkAction()}
                    disabled={selectedIds.length === 0 || bulkSaving}
                  >
                    {t('pages.training.runBulkAction', { count: selectedIds.length })}
                  </Button>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-amateur-ink">
                    {t('pages.training.calendarTitle')}
                  </h2>
                  <p className="mt-1 text-sm text-amateur-muted">{t('pages.training.calendarHint')}</p>
                </div>
                <p className="text-sm text-amateur-muted">
                  {formatDate(from, i18n.language)} - {formatDate(to, i18n.language)}
                </p>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-7">
                {calendarDays.map((day) => (
                  <div key={day.key} className="rounded-2xl border border-amateur-border bg-amateur-surface p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
                      {day.date.toLocaleDateString(i18n.language, { weekday: 'short' })}
                    </p>
                    <p className="mt-1 font-display text-lg font-semibold text-amateur-ink">
                      {day.date.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' })}
                    </p>
                    <div className="mt-3 space-y-2">
                      {day.items.length === 0 ? (
                        <p className="text-xs text-amateur-muted">{t('pages.training.noSessionsDay')}</p>
                      ) : (
                        day.items.map((item) => {
                          const selected = selectedIds.includes(item.id);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => toggleSelected(item.id)}
                              className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                                selected
                                  ? 'border-amateur-accent bg-amateur-accent-soft'
                                  : 'border-amateur-border bg-amateur-canvas'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-amateur-ink">{item.title}</p>
                                  <p className="text-xs text-amateur-muted">
                                    {rangeLabel(item.scheduledStart, item.scheduledEnd, i18n.language)}
                                  </p>
                                  <p className="mt-1 text-xs text-amateur-muted">
                                    {groupMap.get(item.groupId) ?? t('pages.training.unknownGroup')}
                                    {item.teamId
                                      ? ` · ${teamMap.get(item.teamId) ?? t('pages.training.unknownTeam')}`
                                      : ` · ${t('pages.training.fullGroupOption')}`}
                                  </p>
                                  {item.coachId ? (
                                    <p className="mt-1 text-xs text-amateur-muted">
                                      {t('pages.training.coach')}: {coachMap.get(item.coachId) ?? t('pages.coaches.unknownCoach')}
                                    </p>
                                  ) : null}
                                </div>
                                <span className="rounded-full bg-amateur-surface px-2 py-1 text-[11px] font-medium text-amateur-accent">
                                  {getTrainingStatusLabel(t, item.status)}
                                </span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-amateur-border text-amateur-muted">
                    <th className="pb-2 font-medium">{t('app.actions.bulk')}</th>
                    <th className="pb-2 font-medium">{t('pages.training.sessionTitle')}</th>
                    <th className="pb-2 font-medium">{t('pages.training.scheduled')}</th>
                    <th className="pb-2 font-medium">{t('pages.athletes.primaryGroup')}</th>
                    <th className="pb-2 font-medium">{t('pages.training.status')}</th>
                    <th className="pb-2 font-medium">{t('pages.training.attendance')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((session) => (
                    <tr key={session.id} className="border-b border-amateur-border/60 last:border-0">
                      <td className="py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(session.id)}
                          onChange={() => toggleSelected(session.id)}
                        />
                      </td>
                      <td className="py-3">
                        <p className="font-medium text-amateur-ink">{session.title}</p>
                        {session.location ? <p className="text-xs text-amateur-muted">{session.location}</p> : null}
                        {session.coachId ? (
                          <p className="text-xs text-amateur-muted">
                            {t('pages.training.coach')}: {coachMap.get(session.coachId) ?? t('pages.coaches.unknownCoach')}
                          </p>
                        ) : null}
                      </td>
                      <td className="py-3 text-amateur-muted">
                        {rangeLabel(session.scheduledStart, session.scheduledEnd, i18n.language)}
                      </td>
                      <td className="py-3 text-amateur-muted">
                        {groupMap.get(session.groupId) ?? t('pages.training.unknownGroup')}
                        {session.teamId ? ` · ${teamMap.get(session.teamId) ?? t('pages.training.unknownTeam')}` : ''}
                      </td>
                      <td className="py-3">
                        <span className="rounded-full bg-amateur-accent-soft px-3 py-1 text-xs font-medium text-amateur-accent">
                          {getTrainingStatusLabel(t, session.status)}
                        </span>
                      </td>
                      <td className="py-3">
                        <Link
                          to={`/app/training/${session.id}`}
                          className="font-medium text-amateur-accent hover:underline"
                        >
                          {t('pages.training.openAttendance')}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </ListPageFrame>
    </div>
  );
}
