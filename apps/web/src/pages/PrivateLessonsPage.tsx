import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { InlineAlert } from '../components/ui/InlineAlert';
import { ListPageFrame } from '../components/ui/ListPageFrame';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { DataExplorer } from '../components/reporting/DataExplorer';
import { apiGet, apiPatch, apiPost } from '../lib/api';
import {
  formatDateTime,
  getChargeStatusLabel,
  getMoneyAmount,
  getPersonName,
  getTrainingStatusLabel,
} from '../lib/display';
import type {
  Athlete,
  ChargeItem,
  Coach,
  PrivateLesson,
  TrainingSessionStatus,
} from '../lib/domain-types';
import { useTenant } from '../lib/tenant-hooks';

const lessonStatuses: TrainingSessionStatus[] = ['planned', 'completed', 'cancelled'];

type LessonFormState = {
  athleteId: string;
  coachId: string;
  focus: string;
  scheduledStart: string;
  scheduledEnd: string;
  location: string;
  status: TrainingSessionStatus;
  attendanceStatus: '' | 'present' | 'absent' | 'excused' | 'late';
  notes: string;
  chargeItemId: string;
  chargeAmount: string;
  chargeDueDate: string;
  chargeNotes: string;
};

function createFormState(): LessonFormState {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    athleteId: '',
    coachId: '',
    focus: '',
    scheduledStart: start.toISOString().slice(0, 16),
    scheduledEnd: end.toISOString().slice(0, 16),
    location: '',
    status: 'planned',
    attendanceStatus: '',
    notes: '',
    chargeItemId: '',
    chargeAmount: '',
    chargeDueDate: '',
    chargeNotes: '',
  };
}

export function PrivateLessonsPage() {
  const { t, i18n } = useTranslation();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [athleteId, setAthleteId] = useState(searchParams.get('athleteId') ?? '');
  const [coachId, setCoachId] = useState(searchParams.get('coachId') ?? '');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [items, setItems] = useState<PrivateLesson[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [chargeItems, setChargeItems] = useState<ChargeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<LessonFormState>(() => createFormState());

  useEffect(() => {
    setQ(searchParams.get('q') ?? '');
    setAthleteId(searchParams.get('athleteId') ?? '');
    setCoachId(searchParams.get('coachId') ?? '');
    setStatus(searchParams.get('status') ?? '');
  }, [searchParams]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (q.trim()) next.set('q', q.trim());
    if (athleteId) next.set('athleteId', athleteId);
    if (coachId) next.set('coachId', coachId);
    if (status) next.set('status', status);
    setSearchParams(next, { replace: true });
  }, [athleteId, coachId, q, setSearchParams, status]);

  useEffect(() => {
    if (!tenantId) return;
    void (async () => {
      try {
        const [athleteRes, coachRes, chargeItemRes] = await Promise.all([
          apiGet<{ items: Athlete[] }>('/api/athletes?limit=200'),
          apiGet<{ items: Coach[] }>('/api/coaches?limit=200&isActive=true'),
          apiGet<{ items: ChargeItem[] }>('/api/charge-items?limit=200&isActive=true'),
        ]);
        setAthletes(athleteRes.items);
        setCoaches(coachRes.items);
        setChargeItems(chargeItemRes.items);
      } catch {
        setAthletes([]);
        setCoaches([]);
        setChargeItems([]);
      }
    })();
  }, [tenantId]);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (q.trim()) params.set('q', q.trim());
      if (athleteId) params.set('athleteId', athleteId);
      if (coachId) params.set('coachId', coachId);
      if (status) params.set('status', status);
      const res = await apiGet<{ items: PrivateLesson[] }>(`/api/private-lessons?${params.toString()}`);
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [athleteId, coachId, q, status, t, tenantId]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 200);
    return () => clearTimeout(id);
  }, [load]);

  const stats = useMemo(
    () => ({
      planned: items.filter((item) => item.status === 'planned').length,
      completed: items.filter((item) => item.status === 'completed').length,
      openBilling: items.filter(
        (item) =>
          item.charge &&
          item.charge.derivedStatus !== 'paid' &&
          item.charge.status !== 'paid' &&
          item.charge.status !== 'cancelled',
      ).length,
    }),
    [items],
  );

  function resetForm() {
    setForm(createFormState());
  }

  async function submit() {
    if (!form.athleteId || !form.coachId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiPost('/api/private-lessons', {
        athleteId: form.athleteId,
        coachId: form.coachId,
        focus: form.focus || undefined,
        scheduledStart: new Date(form.scheduledStart).toISOString(),
        scheduledEnd: new Date(form.scheduledEnd).toISOString(),
        location: form.location || undefined,
        status: form.status,
        attendanceStatus: form.attendanceStatus || undefined,
        notes: form.notes || undefined,
        chargeItemId: form.chargeItemId || undefined,
        chargeAmount: form.chargeAmount ? Number.parseFloat(form.chargeAmount) : undefined,
        chargeDueDate: form.chargeDueDate || undefined,
        chargeNotes: form.chargeNotes || undefined,
      });
      setMessage(t('pages.privateLessons.created'));
      setShowForm(false);
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(lesson: PrivateLesson, nextStatus: TrainingSessionStatus) {
    try {
      await apiPatch(`/api/private-lessons/${lesson.id}`, { status: nextStatus });
      setMessage(t('pages.privateLessons.updated'));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    }
  }

  const view = (searchParams.get('view') as 'list' | 'advanced') ?? 'list';

  if (view === 'advanced') {
    return (
      <div>
        <PageHeader title={t('pages.privateLessons.title')} subtitle={t('pages.privateLessons.subtitle')} />
        <div className="mb-3 inline-flex overflow-hidden rounded-xl border border-amateur-border bg-amateur-surface text-xs">
          {(['list', 'advanced'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                if (option === 'list') next.delete('view');
                else next.set('view', option);
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
        <ListPageFrame>
          {!tenantId && !tenantLoading ? (
            <p className="text-sm text-amateur-muted">{t('app.errors.needTenant')}</p>
          ) : (
            <DataExplorer entity="private_lessons" embed />
          )}
        </ListPageFrame>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('pages.privateLessons.title')}
        subtitle={t('pages.privateLessons.subtitle')}
        actions={
          <Button
            type="button"
            onClick={() => {
              setShowForm((current) => !current);
              if (showForm) resetForm();
            }}
          >
            {showForm ? t('app.actions.cancel') : t('pages.privateLessons.new')}
          </Button>
        }
      />

      <div className="mb-3 inline-flex overflow-hidden rounded-xl border border-amateur-border bg-amateur-surface text-xs">
        {(['list', 'advanced'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              if (option === 'list') next.delete('view');
              else next.set('view', option);
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

      {showForm ? (
        <section className="mb-6 rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pages.athleteCharges.athlete')}</span>
              <select
                value={form.athleteId}
                onChange={(e) => setForm((current) => ({ ...current, athleteId: e.target.value }))}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              >
                <option value="">{t('pages.privateLessons.selectAthlete')}</option>
                {athletes.map((athlete) => (
                  <option key={athlete.id} value={athlete.id}>
                    {getPersonName(athlete)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pages.privateLessons.coach')}</span>
              <select
                value={form.coachId}
                onChange={(e) => setForm((current) => ({ ...current, coachId: e.target.value }))}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              >
                <option value="">{t('pages.privateLessons.selectCoach')}</option>
                {coaches.map((coach) => (
                  <option key={coach.id} value={coach.id}>
                    {getPersonName(coach)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pages.privateLessons.focus')}</span>
              <input
                value={form.focus}
                onChange={(e) => setForm((current) => ({ ...current, focus: e.target.value }))}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pages.training.location')}</span>
              <input
                value={form.location}
                onChange={(e) => setForm((current) => ({ ...current, location: e.target.value }))}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pages.training.startTime')}</span>
              <input
                type="datetime-local"
                value={form.scheduledStart}
                onChange={(e) => setForm((current) => ({ ...current, scheduledStart: e.target.value }))}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pages.training.endTime')}</span>
              <input
                type="datetime-local"
                value={form.scheduledEnd}
                onChange={(e) => setForm((current) => ({ ...current, scheduledEnd: e.target.value }))}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pages.training.status')}</span>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((current) => ({ ...current, status: e.target.value as TrainingSessionStatus }))
                }
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              >
                {lessonStatuses.map((option) => (
                  <option key={option} value={option}>
                    {getTrainingStatusLabel(t, option)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pages.privateLessons.billingItem')}</span>
              <select
                value={form.chargeItemId}
                onChange={(e) => setForm((current) => ({ ...current, chargeItemId: e.target.value }))}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              >
                <option value="">{t('pages.privateLessons.noCharge')}</option>
                {chargeItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pages.athleteCharges.amount')}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.chargeAmount}
                onChange={(e) => setForm((current) => ({ ...current, chargeAmount: e.target.value }))}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pages.athleteCharges.dueDate')}</span>
              <input
                type="date"
                value={form.chargeDueDate}
                onChange={(e) => setForm((current) => ({ ...current, chargeDueDate: e.target.value }))}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm lg:col-span-2">
              <span>{t('pages.athletes.notes')}</span>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={() => void submit()} disabled={saving || !form.athleteId || !form.coachId}>
              {t('pages.privateLessons.create')}
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
        </section>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label={t('pages.privateLessons.summaryPlanned')} value={stats.planned} compact />
        <StatCard label={t('pages.privateLessons.summaryCompleted')} value={stats.completed} compact />
        <StatCard label={t('pages.privateLessons.summaryOpenBilling')} value={stats.openBilling} tone="danger" compact />
      </div>

      <ListPageFrame
        search={{
          value: q,
          onChange: setQ,
          disabled: !tenantId || tenantLoading,
          placeholder: t('pages.privateLessons.search'),
        }}
        toolbar={
          <>
            <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-muted">
              <span>{t('pages.athleteCharges.athlete')}</span>
              <select
                value={athleteId}
                onChange={(e) => setAthleteId(e.target.value)}
                className="bg-transparent text-amateur-ink outline-none"
              >
                <option value="">{t('pages.athleteCharges.allAthletes')}</option>
                {athletes.map((athlete) => (
                  <option key={athlete.id} value={athlete.id}>
                    {getPersonName(athlete)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-muted">
              <span>{t('pages.privateLessons.coach')}</span>
              <select
                value={coachId}
                onChange={(e) => setCoachId(e.target.value)}
                className="bg-transparent text-amateur-ink outline-none"
              >
                <option value="">{t('pages.privateLessons.allCoaches')}</option>
                {coaches.map((coach) => (
                  <option key={coach.id} value={coach.id}>
                    {getPersonName(coach)}
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
                {lessonStatuses.map((option) => (
                  <option key={option} value={option}>
                    {getTrainingStatusLabel(t, option)}
                  </option>
                ))}
              </select>
            </label>
          </>
        }
      >
        {!tenantId && !tenantLoading ? (
          <p className="text-sm text-amateur-muted">{t('app.errors.needTenant')}</p>
        ) : loading ? (
          <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>
        ) : items.length === 0 ? (
          <EmptyState title={t('pages.privateLessons.empty')} hint={t('pages.privateLessons.emptyHint')} />
        ) : (
          <div className="space-y-4">
            {items.map((lesson) => (
              <section
                key={lesson.id}
                className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-semibold text-amateur-ink">
                      {lesson.athlete ? getPersonName(lesson.athlete) : lesson.athleteId}
                    </h3>
                    <p className="mt-1 text-sm text-amateur-muted">
                      {lesson.coach ? getPersonName(lesson.coach) : lesson.coachId}
                      {lesson.focus ? ` · ${lesson.focus}` : ''}
                    </p>
                    <p className="mt-1 text-sm text-amateur-muted">
                      {formatDateTime(lesson.scheduledStart, i18n.language)} —{' '}
                      {formatDateTime(lesson.scheduledEnd, i18n.language)}
                    </p>
                    {lesson.location ? <p className="text-sm text-amateur-muted">{lesson.location}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-amateur-accent-soft px-3 py-1 text-xs font-medium text-amateur-accent">
                      {getTrainingStatusLabel(t, lesson.status)}
                    </span>
                    <select
                      value={lesson.status}
                      onChange={(e) => void updateStatus(lesson, e.target.value as TrainingSessionStatus)}
                      className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-sm"
                    >
                      {lessonStatuses.map((option) => (
                        <option key={option} value={option}>
                          {getTrainingStatusLabel(t, option)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {lesson.charge ? (
                  <div className="mt-4 rounded-xl border border-amateur-border bg-amateur-surface px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
                      {t('pages.privateLessons.billing')}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-sm">
                      <div>
                        <p className="font-medium text-amateur-ink">
                          {lesson.charge.chargeItem?.name ?? lesson.charge.chargeItemId}
                        </p>
                        <p className="text-amateur-muted">
                          {getMoneyAmount(lesson.charge.remainingAmount ?? lesson.charge.amount, lesson.charge.chargeItem?.currency)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-amateur-ink">
                          {getChargeStatusLabel(t, lesson.charge.derivedStatus ?? lesson.charge.status)}
                        </p>
                        <Link
                          to={`/app/finance/athlete-charges?athleteId=${lesson.athleteId}`}
                          className="text-sm font-medium text-amateur-accent hover:underline"
                        >
                          {t('pages.finance.athleteChargesLink')} →
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>
            ))}
          </div>
        )}
      </ListPageFrame>
    </div>
  );
}
