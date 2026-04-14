import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ListPageFrame } from '../components/ui/ListPageFrame';
import { PageHeader } from '../components/ui/PageHeader';
import { apiGet, apiPatch, apiPost } from '../lib/api';
import {
  formatDate,
  getChargeCurrencyAmount,
  getChargeStatusLabel,
  getPersonName,
} from '../lib/display';
import { useTenant } from '../lib/tenant-hooks';
import type { Athlete, AthleteCharge, AthleteChargeStatus, ChargeItem, ClubGroup } from '../lib/domain-types';

const chargeStatuses: AthleteChargeStatus[] = ['pending', 'partially_paid', 'paid', 'cancelled'];

export function AthleteChargesPage() {
  const { t, i18n } = useTranslation();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [athleteId, setAthleteId] = useState(searchParams.get('athleteId') ?? '');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [items, setItems] = useState<AthleteCharge[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [groups, setGroups] = useState<ClubGroup[]>([]);
  const [chargeItems, setChargeItems] = useState<ChargeItem[]>([]);
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [bulkChargeItemId, setBulkChargeItemId] = useState('');
  const [bulkAmount, setBulkAmount] = useState('');
  const [bulkDueDate, setBulkDueDate] = useState('');

  useEffect(() => {
    setQ(searchParams.get('q') ?? '');
    setAthleteId(searchParams.get('athleteId') ?? '');
    setStatus(searchParams.get('status') ?? '');
  }, [searchParams]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (q.trim()) next.set('q', q.trim());
    if (athleteId) next.set('athleteId', athleteId);
    if (status) next.set('status', status);
    setSearchParams(next, { replace: true });
  }, [athleteId, q, setSearchParams, status]);

  useEffect(() => {
    if (!tenantId) return;
    void (async () => {
      try {
        const [athleteRes, chargeItemRes, groupRes] = await Promise.all([
          apiGet<{ items: Athlete[] }>('/api/athletes?limit=200'),
          apiGet<{ items: ChargeItem[] }>('/api/charge-items?limit=200&isActive=true'),
          apiGet<{ items: ClubGroup[] }>('/api/groups?limit=200'),
        ]);
        setAthletes(athleteRes.items);
        setChargeItems(chargeItemRes.items);
        setGroups(groupRes.items);
      } catch {
        setAthletes([]);
        setChargeItems([]);
        setGroups([]);
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
      if (status) params.set('status', status);
      const res = await apiGet<{ items: AthleteCharge[] }>(`/api/athlete-charges?${params.toString()}`);
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [athleteId, q, status, tenantId, t]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 250);
    return () => clearTimeout(id);
  }, [load]);

  const groupMap = useMemo(() => new Map(groups.map((group) => [group.id, group.name])), [groups]);
  const selectedAthletes = useMemo(
    () => athletes.filter((athlete) => selectedAthleteIds.includes(athlete.id)),
    [athletes, selectedAthleteIds],
  );

  function toggleSelection(athlete: Athlete) {
    setSelectedAthleteIds((current) =>
      current.includes(athlete.id) ? current.filter((id) => id !== athlete.id) : [...current, athlete.id],
    );
  }

  async function assignBulkCharges() {
    if (!bulkChargeItemId || selectedAthleteIds.length === 0) return;
    setBulkSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiPost('/api/athlete-charges/bulk', {
        athleteIds: selectedAthleteIds,
        chargeItemId: bulkChargeItemId,
        amount: bulkAmount ? parseFloat(bulkAmount) : undefined,
        dueDate: bulkDueDate || undefined,
      });
      setSelectedAthleteIds([]);
      setBulkChargeItemId('');
      setBulkAmount('');
      setBulkDueDate('');
      setMessage(t('pages.athleteCharges.bulkSuccess', { count: selectedAthleteIds.length }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    } finally {
      setBulkSaving(false);
    }
  }

  async function updateChargeStatus(id: string, nextStatus: AthleteChargeStatus) {
    try {
      await apiPatch(`/api/athlete-charges/${id}`, { status: nextStatus });
      setMessage(t('pages.athleteCharges.updated'));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    }
  }

  return (
    <div>
      <PageHeader title={t('pages.athleteCharges.title')} subtitle={t('pages.athleteCharges.subtitle')} />
      <ListPageFrame
        search={{ value: q, onChange: setQ, disabled: !tenantId || tenantLoading }}
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
              <span>{t('pages.athleteCharges.status')}</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="bg-transparent text-amateur-ink outline-none"
              >
                <option value="">{t('pages.athleteCharges.allStatuses')}</option>
                {chargeStatuses.map((chargeStatus) => (
                  <option key={chargeStatus} value={chargeStatus}>
                    {getChargeStatusLabel(t, chargeStatus)}
                  </option>
                ))}
              </select>
            </label>
          </>
        }
      >
        {!tenantId && !tenantLoading ? (
          <p className="text-sm text-amateur-muted">{t('app.errors.needTenant')}</p>
        ) : (
          <section className="mb-6 rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-amateur-ink">
                  {t('pages.athleteCharges.bulkTitle')}
                </h2>
                <p className="mt-1 text-sm text-amateur-muted">{t('pages.athleteCharges.bulkHint')}</p>
              </div>
              <Link to="/app/athletes">
                <Button variant="ghost">{t('pages.athletes.title')}</Button>
              </Link>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div className="rounded-xl border border-amateur-border bg-amateur-surface p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
                  {t('pages.athleteCharges.selectAthletes')}
                </p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {athletes.map((athlete) => (
                    <label
                      key={athlete.id}
                      className="flex items-start gap-3 rounded-xl border border-amateur-border px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAthleteIds.includes(athlete.id)}
                        onChange={() => toggleSelection(athlete)}
                      />
                      <span>
                        <span className="block font-medium text-amateur-ink">{getPersonName(athlete)}</span>
                        <span className="block text-xs text-amateur-muted">
                          {athlete.primaryGroupId ? groupMap.get(athlete.primaryGroupId) ?? '—' : t('pages.athletes.noGroup')}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-amateur-border bg-amateur-surface p-4">
                <div className="space-y-3">
                  <label className="flex flex-col gap-1 text-sm">
                    <span>{t('pages.athleteCharges.item')}</span>
                    <select
                      value={bulkChargeItemId}
                      onChange={(e) => setBulkChargeItemId(e.target.value)}
                      className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
                    >
                      <option value="">{t('pages.athleteCharges.chooseItem')}</option>
                      {chargeItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.currency} {item.defaultAmount})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span>{t('pages.athleteCharges.amount')}</span>
                    <input
                      value={bulkAmount}
                      onChange={(e) => setBulkAmount(e.target.value)}
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={t('pages.athleteCharges.useDefaultAmount')}
                      className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span>{t('pages.athleteCharges.due')}</span>
                    <input
                      type="date"
                      value={bulkDueDate}
                      onChange={(e) => setBulkDueDate(e.target.value)}
                      className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
                    />
                  </label>
                  <div className="rounded-xl border border-dashed border-amateur-border px-3 py-2 text-sm text-amateur-muted">
                    {t('pages.athleteCharges.selectedCount', { count: selectedAthletes.length })}
                  </div>
                  <Button
                    type="button"
                    onClick={() => void assignBulkCharges()}
                    disabled={!bulkChargeItemId || selectedAthleteIds.length === 0 || bulkSaving}
                  >
                    {t('pages.athleteCharges.assignBulk')}
                  </Button>
                </div>
              </div>
            </div>
          </section>
        )}

        {message ? <p className="mb-4 text-sm text-amateur-accent">{message}</p> : null}
        {!tenantId && !tenantLoading ? (
          <p className="text-sm text-amateur-muted">{t('app.errors.needTenant')}</p>
        ) : error ? (
          <p className="text-sm text-red-700">{error}</p>
        ) : loading ? (
          <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>
        ) : items.length === 0 ? (
          <EmptyState title={t('pages.athleteCharges.empty')} hint={t('pages.finance.hubBody')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-amateur-border text-amateur-muted">
                  <th className="pb-2 font-medium">{t('pages.athleteCharges.item')}</th>
                  <th className="pb-2 font-medium">{t('pages.athleteCharges.amount')}</th>
                  <th className="pb-2 font-medium">{t('pages.athleteCharges.due')}</th>
                  <th className="pb-2 font-medium">{t('pages.athleteCharges.status')}</th>
                  <th className="pb-2 font-medium">{t('pages.athleteCharges.athlete')}</th>
                  <th className="pb-2 font-medium">{t('app.actions.update')}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className="border-b border-amateur-border/70 last:border-0">
                    <td className="py-3 font-medium">{c.chargeItem?.name ?? c.chargeItemId}</td>
                    <td className="py-3">{getChargeCurrencyAmount(c)}</td>
                    <td className="py-3">{formatDate(c.dueDate, i18n.language)}</td>
                    <td className="py-3 text-amateur-muted">{getChargeStatusLabel(t, c.status)}</td>
                    <td className="py-3">
                      <Link
                        to={`/app/athletes/${c.athleteId}`}
                        className="font-medium text-amateur-accent hover:underline"
                      >
                        {c.athlete ? getPersonName(c.athlete) : t('pages.athleteCharges.openAthlete')}
                      </Link>
                    </td>
                    <td className="py-3">
                      <select
                        value={c.status}
                        onChange={(e) => void updateChargeStatus(c.id, e.target.value as AthleteChargeStatus)}
                        className="rounded-lg border border-amateur-border bg-amateur-canvas px-2 py-1"
                      >
                        {chargeStatuses.map((chargeStatus) => (
                          <option key={chargeStatus} value={chargeStatus}>
                            {getChargeStatusLabel(t, chargeStatus)}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ListPageFrame>
    </div>
  );
}
