import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { InlineAlert } from '../components/ui/InlineAlert';
import { PageHeader } from '../components/ui/PageHeader';
import { apiGet, apiPost } from '../lib/api';
import { useTenant } from '../lib/tenant-hooks';
import type {
  ClubGroup,
  SportBranch,
  Team,
  TrainingSession,
  TrainingSessionStatus,
} from '../lib/domain-types';

const sessionStatuses: TrainingSessionStatus[] = ['planned', 'completed', 'cancelled'];
const weekdayOptions = [
  { value: 1, key: 'monday' },
  { value: 2, key: 'tuesday' },
  { value: 3, key: 'wednesday' },
  { value: 4, key: 'thursday' },
  { value: 5, key: 'friday' },
  { value: 6, key: 'saturday' },
  { value: 7, key: 'sunday' },
] as const;

export function TrainingSessionFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tenantId } = useTenant();

  const [branches, setBranches] = useState<SportBranch[]>([]);
  const [groups, setGroups] = useState<ClubGroup[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [sportBranchId, setSportBranchId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [title, setTitle] = useState('');
  const [scheduledStart, setScheduledStart] = useState('');
  const [scheduledEnd, setScheduledEnd] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<TrainingSessionStatus>('planned');
  const [mode, setMode] = useState<'single' | 'series'>('single');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [sessionStartTime, setSessionStartTime] = useState('');
  const [sessionEndTime, setSessionEndTime] = useState('');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    void (async () => {
      try {
        const b = await apiGet<SportBranch[]>('/api/sport-branches');
        setBranches(b);
        if (b.length > 0) setSportBranchId((prev) => prev || b[0].id);
      } catch {
        setError(t('app.errors.loadFailed'));
      }
    })();
  }, [tenantId, t]);

  useEffect(() => {
    if (!tenantId || !sportBranchId) {
      setGroups([]);
      return;
    }
    void (async () => {
      try {
        const g = await apiGet<{ items: ClubGroup[] }>(
          `/api/groups?sportBranchId=${sportBranchId}&limit=200`,
        );
        setGroups(g.items);
        setGroupId((prev) => prev || (g.items[0]?.id ?? ''));
      } catch {
        setGroups([]);
      }
    })();
  }, [sportBranchId, tenantId]);

  useEffect(() => {
    if (!tenantId || !sportBranchId) {
      setTeams([]);
      return;
    }
    void (async () => {
      try {
        const params = new URLSearchParams({ sportBranchId, limit: '200' });
        if (groupId) params.set('groupId', groupId);
        const tr = await apiGet<{ items: Team[] }>(`/api/teams?${params.toString()}`);
        setTeams(tr.items);
      } catch {
        setTeams([]);
      }
    })();
  }, [groupId, sportBranchId, tenantId]);

  useEffect(() => {
    if (scheduledStart && !sessionStartTime) {
      setSessionStartTime(scheduledStart.slice(11, 16));
    }
    if (scheduledEnd && !sessionEndTime) {
      setSessionEndTime(scheduledEnd.slice(11, 16));
    }
    if (scheduledStart && !startsOn) {
      setStartsOn(scheduledStart.slice(0, 10));
    }
    if (scheduledEnd && !endsOn) {
      setEndsOn(scheduledEnd.slice(0, 10));
    }
    if (scheduledStart && weekdays.length === 0) {
      const day = new Date(scheduledStart).getDay();
      setWeekdays([day === 0 ? 7 : day]);
    }
  }, [endsOn, scheduledEnd, scheduledStart, sessionEndTime, sessionStartTime, startsOn, weekdays.length]);

  const visibleTeams = useMemo(
    () => (groupId ? teams.filter((team) => team.groupId === groupId) : teams),
    [groupId, teams],
  );

  function toggleWeekday(day: number) {
    setWeekdays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort((a, b) => a - b),
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        title,
        sportBranchId,
        groupId,
        teamId: teamId || null,
        location: location || undefined,
        notes: notes || undefined,
        status,
      };
      if (mode === 'single') {
        const created = await apiPost<TrainingSession>('/api/training-sessions', {
          ...payload,
          scheduledStart: new Date(scheduledStart).toISOString(),
          scheduledEnd: new Date(scheduledEnd).toISOString(),
        });
        navigate(`/app/training/${created.id}`);
        return;
      }

      const created = await apiPost<{ generatedCount: number; skippedCount: number }>('/api/training-sessions/series', {
        ...payload,
        startsOn,
        endsOn,
        weekdays,
        sessionStartTime,
        sessionEndTime,
      });
      setMessage(
        t('pages.training.seriesSuccess', {
          generated: created.generatedCount,
          skipped: created.skippedCount,
        }),
      );
      navigate('/app/training');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t('pages.training.new')}
        subtitle={mode === 'single' ? t('pages.training.subtitle') : t('pages.training.seriesModeHint')}
      />
      <div className="mx-auto max-w-xl rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={mode === 'single' ? 'primary' : 'ghost'} onClick={() => setMode('single')}>
              {t('pages.training.singleMode')}
            </Button>
            <Button type="button" variant={mode === 'series' ? 'primary' : 'ghost'} onClick={() => setMode('series')}>
              {t('pages.training.seriesMode')}
            </Button>
          </div>
          {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
          {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('pages.training.sessionTitle')}</span>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 outline-none focus:ring-2 focus:ring-amateur-accent/30"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('pages.athletes.branch')}</span>
            <select
              required
              value={sportBranchId}
              onChange={(e) => {
                setSportBranchId(e.target.value);
                setGroupId('');
                setTeamId('');
              }}
              className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
            >
              <option value="">{t('pages.training.chooseBranch')}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('pages.athletes.primaryGroup')}</span>
            <select
              required
              value={groupId}
              onChange={(e) => {
                setGroupId(e.target.value);
                setTeamId('');
              }}
              className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
            >
              <option value="">{t('pages.training.chooseGroup')}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <span className="text-xs text-amateur-muted">{t('pages.training.groupHint')}</span>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('pages.training.teamOptional')}</span>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
            >
              <option value="">—</option>
              {visibleTeams.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            <span className="text-xs text-amateur-muted">{t('pages.training.teamHint')}</span>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('pages.training.status')}</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TrainingSessionStatus)}
              className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
            >
              {sessionStatuses.map((option) => (
                <option key={option} value={option}>
                  {t(`app.enums.trainingStatus.${option}`)}
                </option>
              ))}
            </select>
          </label>
          {mode === 'single' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{t('pages.training.startTime')}</span>
                <input
                  required
                  type="datetime-local"
                  value={scheduledStart}
                  onChange={(e) => setScheduledStart(e.target.value)}
                  className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{t('pages.training.endTime')}</span>
                <input
                  required
                  type="datetime-local"
                  value={scheduledEnd}
                  onChange={(e) => setScheduledEnd(e.target.value)}
                  className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
                />
              </label>
            </div>
          ) : (
            <div className="space-y-4 rounded-2xl border border-amateur-border bg-amateur-canvas/70 p-4">
              <p className="text-sm text-amateur-muted">{t('pages.training.seriesPanelHint')}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">{t('pages.training.startsOn')}</span>
                  <input
                    required
                    type="date"
                    value={startsOn}
                    onChange={(e) => setStartsOn(e.target.value)}
                    className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">{t('pages.training.endsOn')}</span>
                  <input
                    required
                    type="date"
                    value={endsOn}
                    onChange={(e) => setEndsOn(e.target.value)}
                    className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                  />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">{t('pages.training.startTime')}</span>
                  <input
                    required
                    type="time"
                    value={sessionStartTime}
                    onChange={(e) => setSessionStartTime(e.target.value)}
                    className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">{t('pages.training.endTime')}</span>
                  <input
                    required
                    type="time"
                    value={sessionEndTime}
                    onChange={(e) => setSessionEndTime(e.target.value)}
                    className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                  />
                </label>
              </div>
              <div>
                <p className="text-sm font-medium text-amateur-ink">{t('pages.training.repeatOn')}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {weekdayOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`rounded-xl border px-3 py-2 text-sm ${
                        weekdays.includes(option.value)
                          ? 'border-amateur-accent bg-amateur-accent-soft text-amateur-accent'
                          : 'border-amateur-border bg-amateur-surface text-amateur-muted'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={weekdays.includes(option.value)}
                        onChange={() => toggleWeekday(option.value)}
                        className="sr-only"
                      />
                      {t(`pages.training.weekdays.${option.key}`)}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('pages.training.location')}</span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('pages.athletes.notes')}</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="resize-y rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
            />
          </label>
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={
                saving ||
                branches.length === 0 ||
                !groupId ||
                !sportBranchId ||
                (mode === 'single' && (!scheduledStart || !scheduledEnd)) ||
                (mode === 'series' && (!startsOn || !endsOn || !sessionStartTime || !sessionEndTime || weekdays.length === 0))
              }
            >
              {mode === 'single' ? t('pages.training.createSingle') : t('pages.training.generateSeries')}
            </Button>
            <Link to="/app/training">
              <Button type="button" variant="ghost">
                {t('pages.athletes.cancel')}
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
