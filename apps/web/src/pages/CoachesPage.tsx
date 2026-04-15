import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { InlineAlert } from '../components/ui/InlineAlert';
import { ListPageFrame } from '../components/ui/ListPageFrame';
import { PageHeader } from '../components/ui/PageHeader';
import { apiGet, apiPatch, apiPost } from '../lib/api';
import { getCoachName } from '../lib/display';
import { useTenant } from '../lib/tenant-hooks';
import type { Coach, SportBranch } from '../lib/domain-types';

type CoachListResponse = { items: Coach[]; total: number };

function emptyForm() {
  return {
    firstName: '',
    lastName: '',
    preferredName: '',
    sportBranchId: '',
    phone: '',
    email: '',
    specialties: '',
    notes: '',
    isActive: true,
  };
}

export function CoachesPage() {
  const { t } = useTranslation();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Coach[]>([]);
  const [branches, setBranches] = useState<SportBranch[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (q.trim()) params.set('q', q.trim());
      const [coachRes, branchRes] = await Promise.all([
        apiGet<CoachListResponse>(`/api/coaches?${params.toString()}`),
        apiGet<SportBranch[]>('/api/sport-branches'),
      ]);
      setItems(coachRes.items);
      setBranches(branchRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [q, t, tenantId]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 200);
    return () => clearTimeout(id);
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm());
  }

  function startCreate() {
    resetForm();
    setShowForm(true);
    setMessage(null);
  }

  function startEdit(coach: Coach) {
    setEditingId(coach.id);
    setForm({
      firstName: coach.firstName,
      lastName: coach.lastName,
      preferredName: coach.preferredName ?? '',
      sportBranchId: coach.sportBranchId,
      phone: coach.phone ?? '',
      email: coach.email ?? '',
      specialties: coach.specialties ?? '',
      notes: coach.notes ?? '',
      isActive: coach.isActive,
    });
    setShowForm(true);
    setMessage(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.sportBranchId) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        preferredName: form.preferredName || undefined,
        sportBranchId: form.sportBranchId,
        phone: form.phone || undefined,
        email: form.email || undefined,
        specialties: form.specialties || undefined,
        notes: form.notes || undefined,
        isActive: form.isActive,
      };
      if (editingId) {
        await apiPatch(`/api/coaches/${editingId}`, payload);
        setMessage(t('pages.coaches.updated'));
      } else {
        await apiPost('/api/coaches', payload);
        setMessage(t('pages.coaches.created'));
      }
      setShowForm(false);
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  const branchMap = useMemo(() => new Map(branches.map((branch) => [branch.id, branch.name])), [branches]);
  const activeCount = items.filter((coach) => coach.isActive).length;

  return (
    <div>
      <PageHeader
        title={t('pages.coaches.title')}
        subtitle={t('pages.coaches.subtitle')}
        actions={
          <Button type="button" onClick={startCreate}>
            {t('pages.coaches.new')}
          </Button>
        }
      />
      {message ? (
        <InlineAlert tone="success" className="mb-4">
          {message}
        </InlineAlert>
      ) : null}
      {error ? (
        <InlineAlert tone="error" className="mb-4">
          {error}
        </InlineAlert>
      ) : null}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-amateur-border bg-amateur-surface p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
            {t('pages.coaches.summaryTotal')}
          </p>
          <p className="mt-2 font-display text-3xl font-semibold text-amateur-ink">{items.length}</p>
        </div>
        <div className="rounded-2xl border border-amateur-border bg-amateur-surface p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
            {t('pages.coaches.summaryActive')}
          </p>
          <p className="mt-2 font-display text-3xl font-semibold text-amateur-ink">{activeCount}</p>
        </div>
        <div className="rounded-2xl border border-amateur-border bg-amateur-surface p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
            {t('pages.coaches.summaryInactive')}
          </p>
          <p className="mt-2 font-display text-3xl font-semibold text-amateur-ink">{items.length - activeCount}</p>
        </div>
      </div>
      <ListPageFrame
        search={{
          value: q,
          onChange: setQ,
          disabled: !tenantId || tenantLoading,
          placeholder: t('pages.coaches.searchPlaceholder'),
        }}
        toolbar={
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setShowForm((current) => !current);
              if (showForm) {
                resetForm();
              }
            }}
          >
            {showForm ? t('app.actions.cancel') : t('app.actions.manage')}
          </Button>
        }
      >
        {!tenantId && !tenantLoading ? (
          <p className="text-sm text-amateur-muted">{t('app.errors.needTenant')}</p>
        ) : (
          <>
            {showForm ? (
              <form
                onSubmit={submit}
                className="mb-6 grid gap-4 rounded-2xl border border-amateur-border bg-amateur-canvas p-4 lg:grid-cols-2"
              >
                <label className="flex flex-col gap-1 text-sm">
                  <span>{t('pages.athletes.firstName')}</span>
                  <input
                    required
                    value={form.firstName}
                    onChange={(e) => setForm((current) => ({ ...current, firstName: e.target.value }))}
                    className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span>{t('pages.athletes.lastName')}</span>
                  <input
                    required
                    value={form.lastName}
                    onChange={(e) => setForm((current) => ({ ...current, lastName: e.target.value }))}
                    className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span>{t('pages.athletes.preferredName')}</span>
                  <input
                    value={form.preferredName}
                    onChange={(e) => setForm((current) => ({ ...current, preferredName: e.target.value }))}
                    className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span>{t('pages.athletes.branch')}</span>
                  <select
                    required
                    value={form.sportBranchId}
                    onChange={(e) => setForm((current) => ({ ...current, sportBranchId: e.target.value }))}
                    className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                  >
                    <option value="">{t('pages.training.chooseBranch')}</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span>{t('pages.athletes.phone')}</span>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                    className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span>{t('pages.athletes.email')}</span>
                  <input
                    value={form.email}
                    onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                    className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm lg:col-span-2">
                  <span>{t('pages.coaches.specialties')}</span>
                  <input
                    value={form.specialties}
                    onChange={(e) => setForm((current) => ({ ...current, specialties: e.target.value }))}
                    className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm lg:col-span-2">
                  <span>{t('pages.athletes.notes')}</span>
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
                    className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((current) => ({ ...current, isActive: e.target.checked }))}
                  />
                  {t('pages.chargeItems.active')}
                </label>
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}>
                    {t('app.actions.save')}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                  >
                    {t('app.actions.cancel')}
                  </Button>
                </div>
              </form>
            ) : null}
            {loading ? (
              <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>
            ) : items.length === 0 ? (
              <EmptyState title={t('pages.coaches.empty')} hint={t('pages.coaches.emptyHint')} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-amateur-border text-amateur-muted">
                      <th className="pb-2 font-medium">{t('pages.coaches.title')}</th>
                      <th className="pb-2 font-medium">{t('pages.athletes.branch')}</th>
                      <th className="pb-2 font-medium">{t('pages.coaches.specialties')}</th>
                      <th className="pb-2 font-medium">{t('pages.chargeItems.active')}</th>
                      <th className="pb-2 font-medium">{t('app.actions.manage')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((coach) => (
                      <tr key={coach.id} className="border-b border-amateur-border/70 last:border-0">
                        <td className="py-3">
                          <p className="font-medium text-amateur-ink">{getCoachName(coach)}</p>
                          <p className="text-xs text-amateur-muted">
                            {[coach.phone, coach.email].filter(Boolean).join(' · ') || '—'}
                          </p>
                        </td>
                        <td className="py-3 text-amateur-muted">{branchMap.get(coach.sportBranchId) ?? '—'}</td>
                        <td className="py-3 text-amateur-muted">{coach.specialties ?? '—'}</td>
                        <td className="py-3 text-amateur-muted">
                          {coach.isActive ? t('pages.chargeItems.activeState') : t('pages.chargeItems.inactiveState')}
                        </td>
                        <td className="py-3">
                          <Button type="button" variant="ghost" onClick={() => startEdit(coach)}>
                            {t('pages.athletes.edit')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </ListPageFrame>
    </div>
  );
}
