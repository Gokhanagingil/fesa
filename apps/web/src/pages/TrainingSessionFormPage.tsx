import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { apiGet, apiPost } from '../lib/api';
import { useTenant } from '../lib/tenant-hooks';
import type { ClubGroup, SportBranch, Team, TrainingSession } from '../lib/domain-types';

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!sportBranchId) {
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
  }, [sportBranchId]);

  useEffect(() => {
    if (!sportBranchId) {
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
  }, [sportBranchId, groupId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title,
        sportBranchId,
        groupId,
        teamId: teamId || null,
        scheduledStart: new Date(scheduledStart).toISOString(),
        scheduledEnd: new Date(scheduledEnd).toISOString(),
        location: location || undefined,
        notes: notes || undefined,
      };
      const created = await apiPost<TrainingSession>('/api/training-sessions', payload);
      navigate(`/app/training/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title={t('pages.training.new')} subtitle={t('pages.training.subtitle')} />
      <div className="mx-auto max-w-xl rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('pages.training.detailTitle')}</span>
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
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('pages.teams.title')} ({t('app.actions.filter')})</span>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
            >
              <option value="">—</option>
              {teams.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t('pages.training.scheduled')} (start)</span>
              <input
                required
                type="datetime-local"
                value={scheduledStart}
                onChange={(e) => setScheduledStart(e.target.value)}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t('pages.training.scheduled')} (end)</span>
              <input
                required
                type="datetime-local"
                value={scheduledEnd}
                onChange={(e) => setScheduledEnd(e.target.value)}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              />
            </label>
          </div>
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
            <Button type="submit" disabled={saving || branches.length === 0}>
              {t('pages.athletes.save')}
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
