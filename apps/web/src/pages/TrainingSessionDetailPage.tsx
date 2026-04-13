import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { apiGet, apiPost } from '../lib/api';
import type {
  Athlete,
  AttendanceRow,
  AttendanceStatus,
  TrainingSession,
} from '../lib/domain-types';

const attendanceOptions: AttendanceStatus[] = ['present', 'absent', 'excused', 'late'];

export function TrainingSessionDetailPage() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [roster, setRoster] = useState<Athlete[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const s = await apiGet<TrainingSession>(`/api/training-sessions/${id}`);
      const [att, athletes] = await Promise.all([
        apiGet<AttendanceRow[]>(`/api/training-sessions/${id}/attendance`),
        apiGet<{ items: Athlete[] }>(
          `/api/athletes?primaryGroupId=${s.groupId}&limit=500`,
        ),
      ]);
      setSession(s);
      setAttendance(att);
      setRoster(athletes.items);
      const next: Record<string, AttendanceStatus> = {};
      for (const row of att) {
        next[row.athlete.id] = row.status;
      }
      for (const a of athletes.items) {
        if (!next[a.id]) next[a.id] = 'present';
      }
      setDraft(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

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
    return list;
  }, [roster, attendance]);

  async function save() {
    if (!id) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const body = {
        rows: Object.entries(draft).map(([athleteId, status]) => ({ athleteId, status })),
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
          {new Date(session.scheduledStart).toLocaleString()} — {new Date(session.scheduledEnd).toLocaleString()}
        </p>
        {session.location ? (
          <p className="mt-1 text-sm">
            {t('pages.training.location')}: {session.location}
          </p>
        ) : null}
        <p className="mt-2 text-xs capitalize text-amateur-muted">{session.status}</p>
      </div>

      <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
        <p className="text-sm text-amateur-muted">{t('pages.training.attendanceHint')}</p>
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
        {message ? <p className="mt-2 text-sm text-amateur-accent">{message}</p> : null}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-amateur-border text-amateur-muted">
                <th className="pb-2 font-medium">{t('pages.athletes.lastName')}</th>
                <th className="pb-2 font-medium">{t('pages.athletes.firstName')}</th>
                <th className="pb-2 font-medium">{t('pages.training.attendance')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ athlete: a }) => (
                <tr key={a.id} className="border-b border-amateur-border/60 last:border-0">
                  <td className="py-2 pr-2">{a.lastName}</td>
                  <td className="py-2 pr-2">{a.firstName}</td>
                  <td className="py-2">
                    <select
                      value={draft[a.id] ?? 'present'}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [a.id]: e.target.value as AttendanceStatus }))
                      }
                      className="rounded-lg border border-amateur-border bg-amateur-canvas px-2 py-1 text-sm capitalize"
                    >
                      {attendanceOptions.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
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
