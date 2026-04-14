import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { apiGet, apiPatch, apiPost } from '../lib/api';
import { getAthleteStatusLabel } from '../lib/display';
import { useTenant } from '../lib/tenant-hooks';
import type { Athlete, AthleteStatus, ClubGroup, SportBranch } from '../lib/domain-types';

const statuses: AthleteStatus[] = ['active', 'inactive', 'trial', 'archived'];

export function AthleteFormPage() {
  const { id } = useParams();
  const isNew = !id;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tenantId } = useTenant();

  const [branches, setBranches] = useState<SportBranch[]>([]);
  const [groups, setGroups] = useState<ClubGroup[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [sportBranchId, setSportBranchId] = useState('');
  const [primaryGroupId, setPrimaryGroupId] = useState('');
  const [status, setStatus] = useState<AthleteStatus>('active');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!tenantId) return;
    void (async () => {
      try {
        const b = await apiGet<SportBranch[]>('/api/sport-branches');
        setBranches(b);
        if (isNew && b.length > 0) setSportBranchId((prev) => prev || b[0].id);
      } catch {
        setError(t('app.errors.loadFailed'));
      }
    })();
  }, [tenantId, isNew, t]);

  useEffect(() => {
    if (!tenantId || !sportBranchId) {
      setGroups([]);
      return;
    }
    void (async () => {
      try {
        const params = new URLSearchParams({ sportBranchId });
        const g = await apiGet<{ items: ClubGroup[] }>(`/api/groups?${params.toString()}`);
        setGroups(g.items);
      } catch {
        setGroups([]);
      }
    })();
  }, [sportBranchId, tenantId]);

  useEffect(() => {
    if (!tenantId || isNew || !id) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const a = await apiGet<Athlete>(`/api/athletes/${id}`);
        setFirstName(a.firstName);
        setLastName(a.lastName);
        setPreferredName(a.preferredName ?? '');
        setBirthDate(a.birthDate ? a.birthDate.slice(0, 10) : '');
        setGender(a.gender ?? '');
        setSportBranchId(a.sportBranchId);
        setPrimaryGroupId(a.primaryGroupId ?? '');
        setStatus(a.status);
        setJerseyNumber(a.jerseyNumber ?? '');
        setNotes(a.notes ?? '');
      } catch (e) {
        setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [tenantId, id, isNew, t]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        firstName,
        lastName,
        preferredName: preferredName || undefined,
        birthDate: birthDate || undefined,
        gender: gender || undefined,
        sportBranchId,
        primaryGroupId: primaryGroupId || null,
        status,
        jerseyNumber: jerseyNumber || undefined,
        notes: notes || undefined,
      };
      if (isNew) {
        const created = await apiPost<Athlete>('/api/athletes', body);
        navigate(`/app/athletes/${created.id}`);
      } else {
        await apiPatch<Athlete>(`/api/athletes/${id}`, body);
        navigate(`/app/athletes/${id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={isNew ? t('pages.athletes.new') : t('pages.athletes.edit')}
        subtitle={t('pages.athletes.subtitle')}
      />
      <div className="mx-auto max-w-xl rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-amateur-ink">{t('pages.athletes.firstName')}</span>
                <input
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 outline-none ring-amateur-accent/20 focus:ring-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-amateur-ink">{t('pages.athletes.lastName')}</span>
                <input
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 outline-none ring-amateur-accent/20 focus:ring-2"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-amateur-ink">{t('pages.athletes.preferredName')}</span>
              <input
                value={preferredName}
                onChange={(e) => setPreferredName(e.target.value)}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 outline-none ring-amateur-accent/20 focus:ring-2"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-amateur-ink">{t('pages.athletes.birthDate')}</span>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 outline-none ring-amateur-accent/20 focus:ring-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-amateur-ink">{t('pages.athletes.gender')}</span>
                <input
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  placeholder={t('pages.athletes.optionalHint')}
                  className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 outline-none ring-amateur-accent/20 focus:ring-2"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-amateur-ink">{t('pages.athletes.branch')}</span>
              <select
                required
                value={sportBranchId}
                onChange={(e) => {
                  setSportBranchId(e.target.value);
                  setPrimaryGroupId('');
                }}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 outline-none ring-amateur-accent/20 focus:ring-2"
              >
                {branches.length === 0 ? (
                  <option value="">{t('app.errors.noBranches')}</option>
                ) : (
                  branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-amateur-ink">{t('pages.athletes.primaryGroup')}</span>
              <select
                value={primaryGroupId}
                onChange={(e) => setPrimaryGroupId(e.target.value)}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 outline-none ring-amateur-accent/20 focus:ring-2"
              >
                <option value="">—</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <span className="text-xs text-amateur-muted">{t('pages.athletes.primaryGroupHint')}</span>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-amateur-ink">{t('pages.athletes.status')}</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AthleteStatus)}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 outline-none ring-amateur-accent/20 focus:ring-2"
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {getAthleteStatusLabel(t, s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-amateur-ink">{t('pages.athletes.jersey')}</span>
              <input
                value={jerseyNumber}
                onChange={(e) => setJerseyNumber(e.target.value)}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 outline-none ring-amateur-accent/20 focus:ring-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-amateur-ink">{t('pages.athletes.notes')}</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="resize-y rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 outline-none ring-amateur-accent/20 focus:ring-2"
              />
            </label>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button type="submit" disabled={saving || branches.length === 0}>
                {t('pages.athletes.save')}
              </Button>
              <Link to={isNew ? '/app/athletes' : `/app/athletes/${id}`}>
                <Button type="button" variant="ghost">
                  {t('pages.athletes.cancel')}
                </Button>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
