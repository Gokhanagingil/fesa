import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { InlineAlert } from '../components/ui/InlineAlert';
import { ListPageFrame } from '../components/ui/ListPageFrame';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { apiGet, apiPatch, apiPost } from '../lib/api';
import { downloadCsv, renderCsvFromRows } from '../lib/imports';
import {
  formatDate,
  getChargeCurrencyAmount,
  getChargeStatusLabel,
  getAthleteStatusLabel,
  getPersonName,
} from '../lib/display';
import { useTenant } from '../lib/tenant-hooks';
import type {
  Athlete,
  AthleteCharge,
  AthleteChargeStatus,
  AthleteStatus,
  AthleteFinanceSummaryResponse,
  ChargeItem,
  ClubGroup,
  Payment,
  Team,
  PeriodicChargeGenerateResponse,
  PeriodicChargePreviewResponse,
} from '../lib/domain-types';

const chargeStatuses: AthleteChargeStatus[] = ['pending', 'partially_paid', 'paid', 'cancelled'];

type PaymentFormState = {
  athleteId: string;
  amount: string;
  currency: string;
  paidAt: string;
  method: string;
  reference: string;
  notes: string;
  allocations: Record<string, string>;
};

type PeriodicGenerationPreview = {
  periodLabel: string;
  targetedAthletes: number;
  creatableAthletes: number;
  skippedAthletes: Array<{
    athleteId: string;
    athleteName: string;
    reason: 'duplicate_period' | 'inactive_charge_item';
  }>;
};

type PeriodicTargetType = 'selected' | 'group' | 'team';
type BulkChargeTargetType = 'selected' | 'group' | 'team';
type BulkChargeStatusScope = 'default' | 'all' | AthleteStatus;

/**
 * Athlete Charges Flow Flattening — Collections Clarity Pack.
 *
 * The previous implementation showed three nested <details> action stacks
 * simultaneously (bulk assign + periodic generation + record collection) plus
 * a parallel selection panel and the charge list, which created competing
 * primary actions and dense mobile rhythm. The flattened structure keeps the
 * exact same backend behavior but presents one calm operational sequence:
 *
 *   summary → attention strip → drawer with one chosen action → list → recent.
 *
 * The drawer is closed by default; opening it reveals only the action the
 * operator picked via a segmented control. Powerful flows stay discoverable
 * but never compete for attention or stack on top of each other.
 */
type ActionDrawerKey = 'bulk' | 'periodic' | 'payment';

function createPaymentFormState(): PaymentFormState {
  return {
    athleteId: '',
    amount: '',
    currency: 'TRY',
    paidAt: new Date().toISOString().slice(0, 16),
    method: '',
    reference: '',
    notes: '',
    allocations: {},
  };
}

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
  const [teams, setTeams] = useState<Team[]>([]);
  const [chargeItems, setChargeItems] = useState<ChargeItem[]>([]);
  const [summary, setSummary] = useState<AthleteFinanceSummaryResponse | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Single action drawer — null means the calm default state with no expanded form.
  const [openAction, setOpenAction] = useState<ActionDrawerKey | null>(null);
  const [bulkChargeItemId, setBulkChargeItemId] = useState('');
  const [bulkAmount, setBulkAmount] = useState('');
  const [bulkDueDate, setBulkDueDate] = useState('');
  const [bulkTargetType, setBulkTargetType] = useState<BulkChargeTargetType>('selected');
  const [bulkGroupId, setBulkGroupId] = useState('');
  const [bulkTeamId, setBulkTeamId] = useState('');
  const [bulkStatusScope, setBulkStatusScope] = useState<BulkChargeStatusScope>('default');
  const [periodicTargetType, setPeriodicTargetType] = useState<PeriodicTargetType>('selected');
  const [periodicGroupId, setPeriodicGroupId] = useState('');
  const [periodicTeamId, setPeriodicTeamId] = useState('');
  const [periodicChargeItemId, setPeriodicChargeItemId] = useState('');
  const [periodicAmount, setPeriodicAmount] = useState('');
  const [periodicDueDate, setPeriodicDueDate] = useState('');
  const [periodicKey, setPeriodicKey] = useState('');
  const [periodicLabel, setPeriodicLabel] = useState('');
  const [periodicNotes, setPeriodicNotes] = useState('');
  const [periodicPreview, setPeriodicPreview] = useState<PeriodicGenerationPreview | null>(null);
  const [periodicLoading, setPeriodicLoading] = useState(false);
  const [periodicSaving, setPeriodicSaving] = useState(false);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(() => createPaymentFormState());

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
        const [athleteRes, chargeItemRes, groupRes, teamRes] = await Promise.all([
          apiGet<{ items: Athlete[] }>('/api/athletes?limit=200'),
          apiGet<{ items: ChargeItem[] }>('/api/charge-items?limit=200&isActive=true'),
          apiGet<{ items: ClubGroup[] }>('/api/groups?limit=200'),
          apiGet<{ items: Team[] }>('/api/teams?limit=200'),
        ]);
        setAthletes(athleteRes.items);
        setChargeItems(chargeItemRes.items);
        setGroups(groupRes.items);
        setTeams(teamRes.items);
      } catch {
        setAthletes([]);
        setChargeItems([]);
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
      const params = new URLSearchParams({ limit: '200' });
      if (q.trim()) params.set('q', q.trim());
      if (athleteId) params.set('athleteId', athleteId);
      if (status) params.set('status', status);

      const summaryParams = athleteId ? `?athleteId=${encodeURIComponent(athleteId)}` : '';
      const paymentParams = athleteId ? `?athleteId=${encodeURIComponent(athleteId)}&limit=20` : '?limit=20';

      const [chargesRes, summaryRes, paymentRes] = await Promise.all([
        apiGet<{ items: AthleteCharge[] }>(`/api/athlete-charges?${params.toString()}`),
        apiGet<AthleteFinanceSummaryResponse>(`/api/finance/athlete-summaries${summaryParams}`),
        apiGet<{ items: Payment[] }>(`/api/payments${paymentParams}`),
      ]);
      setItems(chargesRes.items);
      setSummary(summaryRes);
      setPayments(paymentRes.items);
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

  useEffect(() => {
    setPaymentForm((current) => ({
      ...current,
      athleteId: athleteId || current.athleteId,
    }));
  }, [athleteId]);

  const groupMap = useMemo(() => new Map(groups.map((group) => [group.id, group.name])), [groups]);
  const selectedAthletes = useMemo(
    () => athletes.filter((athlete) => selectedAthleteIds.includes(athlete.id)),
    [athletes, selectedAthleteIds],
  );
  const visiblePeriodicTeams = useMemo(
    () => (periodicGroupId ? teams.filter((team) => team.groupId === periodicGroupId) : teams),
    [periodicGroupId, teams],
  );
  const visibleBulkTeams = useMemo(
    () => (bulkGroupId ? teams.filter((team) => team.groupId === bulkGroupId) : teams),
    [bulkGroupId, teams],
  );

  const chargeOptionsForPayment = useMemo(() => {
    const relevant = athleteId ? items.filter((charge) => charge.athleteId === athleteId) : items;
    return relevant.filter((charge) => charge.status !== 'cancelled' && Number(charge.remainingAmount ?? charge.amount) > 0);
  }, [athleteId, items]);

  const paymentTotal = useMemo(
    () =>
      Object.values(paymentForm.allocations).reduce((sum, value) => sum + (value ? Number.parseFloat(value) || 0 : 0), 0),
    [paymentForm.allocations],
  );
  const selectedAthletePreview = selectedAthletes.slice(0, 6);
  const hasSelection = selectedAthleteIds.length > 0;

  const athleteNameMap = useMemo(
    () => new Map(athletes.map((athlete) => [athlete.id, getPersonName(athlete)])),
    [athletes],
  );

  // Collections clarity strip — small, honest list of athletes who currently
  // need attention. We reuse the existing finance summary so there is no
  // parallel collections data path. The strip stays calm by default: it shows
  // only the top 4 entries and links into the existing communications
  // follow-up surface, preserving source/context honesty.
  const attentionAthletes = useMemo(() => {
    if (!summary) return [];
    return summary.athletes
      .filter((entry) => entry.totalOutstanding > 0)
      .slice(0, 4);
  }, [summary]);
  const attentionCount = useMemo(
    () => (summary ? summary.athletes.filter((entry) => entry.totalOutstanding > 0).length : 0),
    [summary],
  );

  const exportCharges = useCallback(() => {
    if (items.length === 0) {
      setError(t('app.exportCsv.emptyHint'));
      return;
    }
    const headers = [
      t('pages.athleteCharges.athlete'),
      t('pages.athleteCharges.chargeItem'),
      t('pages.athleteCharges.amount'),
      t('pages.athleteCharges.due'),
      t('pages.athleteCharges.status'),
      t('pages.athleteCharges.outstanding'),
    ];
    const rows = items.map((charge) => {
      const remaining = charge.remainingAmount ?? charge.amount;
      const currency = charge.chargeItem?.currency ?? 'TRY';
      return {
        [headers[0]]:
          athleteNameMap.get(charge.athleteId) ??
          (charge.athlete ? getPersonName(charge.athlete) : charge.athleteId),
        [headers[1]]: charge.chargeItem?.name ?? '',
        [headers[2]]: `${charge.amount} ${currency}`,
        [headers[3]]: charge.dueDate ? formatDate(charge.dueDate, i18n.language) : '',
        [headers[4]]: getChargeStatusLabel(t, charge.derivedStatus ?? charge.status),
        [headers[5]]: `${remaining} ${currency}`,
      };
    });
    const csv = renderCsvFromRows(headers, rows);
    downloadCsv(`amateur-charges-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    setMessage(t('app.exportCsv.successHint', { count: items.length }));
  }, [athleteNameMap, i18n.language, items, t]);

  function toggleSelection(athlete: Athlete) {
    setSelectedAthleteIds((current) =>
      current.includes(athlete.id) ? current.filter((id) => id !== athlete.id) : [...current, athlete.id],
    );
  }

  function resetPaymentForm() {
    setPaymentForm(createPaymentFormState());
  }

  function chooseAction(next: ActionDrawerKey) {
    setOpenAction((current) => (current === next ? null : next));
  }

  function normalizePeriodicPreview(response: PeriodicChargePreviewResponse): PeriodicGenerationPreview {
    const skippedAthleteMap = new Map(response.targets.map((athlete) => [athlete.id, getPersonName(athlete)]));
    return {
      periodLabel: response.billingPeriodLabel,
      targetedAthletes: response.targetCount,
      creatableAthletes: response.createCount,
      skippedAthletes: response.skippedAthleteIds.map((athleteId) => ({
        athleteId,
        athleteName: skippedAthleteMap.get(athleteId) ?? athleteId,
        reason: 'duplicate_period',
      })),
    };
  }

  function buildBulkStatusFilter(): AthleteStatus[] | undefined {
    if (bulkTargetType === 'selected') {
      return undefined;
    }
    if (bulkStatusScope === 'default') {
      return ['active', 'trial'];
    }
    if (bulkStatusScope === 'all') {
      return undefined;
    }
    return [bulkStatusScope];
  }

  function buildBulkPayload() {
    return {
      athleteIds: bulkTargetType === 'selected' ? selectedAthleteIds : undefined,
      groupId: bulkTargetType === 'group' ? bulkGroupId : undefined,
      teamId: bulkTargetType === 'team' ? bulkTeamId : undefined,
      athleteStatuses: buildBulkStatusFilter(),
      chargeItemId: bulkChargeItemId,
      amount: bulkAmount ? Number.parseFloat(bulkAmount) : undefined,
      dueDate: bulkDueDate || undefined,
    };
  }

  function buildPeriodicPayload() {
    const payload: {
      chargeItemId: string;
      billingPeriodKey: string;
      billingPeriodLabel: string;
      amount?: number;
      dueDate?: string;
      notes?: string;
      athleteIds?: string[];
      groupId?: string;
      teamId?: string;
    } = {
      chargeItemId: periodicChargeItemId,
      billingPeriodKey: periodicKey.trim(),
      billingPeriodLabel: periodicLabel.trim(),
    };

    if (periodicAmount) {
      payload.amount = Number.parseFloat(periodicAmount);
    }
    if (periodicDueDate) {
      payload.dueDate = periodicDueDate;
    }
    if (periodicNotes.trim()) {
      payload.notes = periodicNotes.trim();
    }
    if (periodicTargetType === 'selected') {
      payload.athleteIds = selectedAthleteIds;
    } else if (periodicTargetType === 'group') {
      payload.groupId = periodicGroupId;
    } else if (periodicTargetType === 'team') {
      payload.teamId = periodicTeamId;
    }

    return payload;
  }

  async function previewPeriodicCharges() {
    if (!periodicChargeItemId || !periodicKey.trim() || !periodicLabel.trim()) return;
    if (periodicTargetType === 'selected' && selectedAthleteIds.length === 0) return;
    if (periodicTargetType === 'group' && !periodicGroupId) return;
    if (periodicTargetType === 'team' && !periodicTeamId) return;

    setPeriodicLoading(true);
    setError(null);
    try {
      const preview = await apiPost<PeriodicChargePreviewResponse>(
        '/api/athlete-charges/periodic-preview',
        buildPeriodicPayload(),
      );
      setPeriodicPreview(normalizePeriodicPreview(preview));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
      setPeriodicPreview(null);
    } finally {
      setPeriodicLoading(false);
    }
  }

  async function generatePeriodicCharges() {
    if (!periodicChargeItemId || !periodicKey.trim() || !periodicLabel.trim()) return;

    setPeriodicSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await apiPost<PeriodicChargeGenerateResponse>(
        '/api/athlete-charges/periodic-generate',
        buildPeriodicPayload(),
      );
      setPeriodicPreview(normalizePeriodicPreview(response));
      setMessage(
        t('pages.athleteCharges.generatedPeriodic', {
          count: response.createdIds.length,
          period: response.billingPeriodLabel,
        }),
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    } finally {
      setPeriodicSaving(false);
    }
  }

  async function assignBulkCharges() {
    if (!bulkChargeItemId) return;
    if (bulkTargetType === 'selected' && selectedAthleteIds.length === 0) return;
    if (bulkTargetType === 'group' && !bulkGroupId) return;
    if (bulkTargetType === 'team' && !bulkTeamId) return;

    setBulkSaving(true);
    setError(null);
    setMessage(null);
    try {
      const created = await apiPost<AthleteCharge[]>('/api/athlete-charges/bulk', buildBulkPayload());
      const assignedCount = created.length;
      setSelectedAthleteIds([]);
      setBulkChargeItemId('');
      setBulkAmount('');
      setBulkDueDate('');
      setBulkGroupId('');
      setBulkTeamId('');
      setBulkStatusScope('default');
      setBulkTargetType('selected');
      setMessage(t('pages.athleteCharges.bulkSuccess', { count: assignedCount }));
      setOpenAction(null);
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

  async function submitPayment() {
    const allocations = Object.entries(paymentForm.allocations)
      .map(([athleteChargeId, amount]) => ({
        athleteChargeId,
        amount: Number.parseFloat(amount),
      }))
      .filter((row) => Number.isFinite(row.amount) && row.amount > 0);

    if (!paymentForm.athleteId || allocations.length === 0) return;

    setPaymentSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiPost('/api/payments', {
        athleteId: paymentForm.athleteId,
        amount: Number(paymentTotal.toFixed(2)),
        currency: paymentForm.currency,
        paidAt: new Date(paymentForm.paidAt).toISOString(),
        method: paymentForm.method || undefined,
        reference: paymentForm.reference || undefined,
        notes: paymentForm.notes || undefined,
        allocations,
      });
      setMessage(t('pages.athleteCharges.paymentRecorded'));
      resetPaymentForm();
      setOpenAction(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    } finally {
      setPaymentSaving(false);
    }
  }

  const summaryCurrency = summary?.charges[0]?.chargeItem?.currency ?? 'TRY';
  const drawerActions: Array<{ key: ActionDrawerKey; labelKey: string; hintKey: string }> = [
    { key: 'payment', labelKey: 'pages.athleteCharges.actions.recordPayment', hintKey: 'pages.athleteCharges.actions.recordPaymentHint' },
    { key: 'bulk', labelKey: 'pages.athleteCharges.actions.bulkAssign', hintKey: 'pages.athleteCharges.actions.bulkAssignHint' },
    { key: 'periodic', labelKey: 'pages.athleteCharges.actions.periodic', hintKey: 'pages.athleteCharges.actions.periodicHint' },
  ];

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
            <Button type="button" variant="ghost" onClick={exportCharges}>
              {t('app.exportCsv.label')}
            </Button>
          </>
        }
      >
        {!tenantId && !tenantLoading ? (
          <p className="text-sm text-amateur-muted">{t('app.errors.needTenant')}</p>
        ) : (
          <>
            {summary ? (
              <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label={t('pages.athleteCharges.summary.totalCharged')}
                  value={`${summary.totals.totalCharged} ${summaryCurrency}`}
                  compact
                />
                <StatCard
                  label={t('pages.athleteCharges.summary.totalCollected')}
                  value={`${summary.totals.totalCollected} ${summaryCurrency}`}
                  compact
                />
                <StatCard
                  label={t('pages.athleteCharges.summary.totalOutstanding')}
                  value={`${summary.totals.totalOutstanding} ${summaryCurrency}`}
                  compact
                />
                <StatCard
                  label={t('pages.athleteCharges.summary.totalOverdue')}
                  value={`${summary.totals.totalOverdue} ${summaryCurrency}`}
                  helper={t('pages.athleteCharges.summary.totalOverdueHint')}
                  tone="danger"
                  compact
                />
              </div>
            ) : null}

            {/* Collections clarity strip — calm operational view of who needs attention. */}
            <section
              aria-labelledby="charges-attention-title"
              className="mb-6 rounded-2xl border border-amateur-border bg-amateur-surface p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id="charges-attention-title" className="font-display text-base font-semibold text-amateur-ink">
                    {t('pages.athleteCharges.attention.title')}
                  </h2>
                  <p className="mt-1 text-sm text-amateur-muted">
                    {attentionCount > 0
                      ? t('pages.athleteCharges.attention.summary', { count: attentionCount })
                      : t('pages.athleteCharges.attention.empty')}
                  </p>
                </div>
                {attentionCount > 0 ? (
                  <Link
                    to="/app/communications?financialState=overdue&primaryContactsOnly=true&channel=whatsapp&template=overdue_payment_reminder&source=finance_overdue&sourceKey=athlete-charges"
                    className="text-sm font-semibold text-amateur-accent hover:underline"
                  >
                    {t('pages.athleteCharges.attention.openFollowUp')} →
                  </Link>
                ) : null}
              </div>
              {attentionAthletes.length > 0 ? (
                <ul className="mt-4 grid gap-2 md:grid-cols-2">
                  {attentionAthletes.map((entry) => (
                    <li
                      key={entry.athlete.id}
                      className="flex flex-col gap-2 rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-amateur-ink">
                          {entry.athlete.preferredName || `${entry.athlete.firstName} ${entry.athlete.lastName}`}
                        </p>
                        <p className="text-xs text-amateur-muted">
                          {t('pages.finance.outstandingAmount', { amount: entry.totalOutstanding.toFixed(2) })}
                          {entry.overdueCount > 0
                            ? ` · ${t('pages.finance.overdueCount', { count: entry.overdueCount })}`
                            : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
                        <button
                          type="button"
                          onClick={() => setAthleteId(entry.athlete.id)}
                          className="text-amateur-accent hover:underline"
                        >
                          {t('pages.athleteCharges.attention.viewCharges')}
                        </button>
                        <Link
                          to={`/app/communications?athleteIds=${entry.athlete.id}&primaryContactsOnly=true&channel=whatsapp&template=overdue_payment_reminder&source=finance_overdue&sourceKey=athlete-charges-${entry.athlete.id}`}
                          className="text-emerald-700 hover:underline"
                        >
                          {t('pages.finance.priorityCollectionsPrepare')}
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>

            {/* Single action drawer. The segmented control keeps actions visible without
                opening every form simultaneously. */}
            <section
              aria-labelledby="charges-actions-title"
              className="mb-6 rounded-2xl border border-amateur-border bg-amateur-surface p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id="charges-actions-title" className="font-display text-base font-semibold text-amateur-ink">
                    {t('pages.athleteCharges.actions.title')}
                  </h2>
                  <p className="mt-1 text-sm text-amateur-muted">{t('pages.athleteCharges.actions.hint')}</p>
                </div>
                <Link to="/app/athletes" className="text-sm font-semibold text-amateur-accent hover:underline">
                  {t('pages.athletes.title')} →
                </Link>
              </div>

              <div
                role="tablist"
                aria-label={t('pages.athleteCharges.actions.title')}
                className="mt-4 grid gap-2 sm:grid-cols-3"
              >
                {drawerActions.map(({ key, labelKey, hintKey }) => {
                  const isOpen = openAction === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={isOpen}
                      aria-controls={`charge-action-panel-${key}`}
                      id={`charge-action-tab-${key}`}
                      onClick={() => chooseAction(key)}
                      className={`group rounded-xl border px-3 py-3 text-left text-sm transition-colors ${
                        isOpen
                          ? 'border-amateur-accent bg-amateur-accent/5 text-amateur-ink shadow-sm'
                          : 'border-amateur-border bg-amateur-canvas text-amateur-ink hover:border-amateur-accent/40'
                      }`}
                    >
                      <span className="block text-sm font-semibold">{t(labelKey)}</span>
                      <span className="mt-1 block text-xs text-amateur-muted">{t(hintKey)}</span>
                    </button>
                  );
                })}
              </div>

              {openAction === 'payment' ? (
                <div
                  id="charge-action-panel-payment"
                  role="tabpanel"
                  aria-labelledby="charge-action-tab-payment"
                  className="mt-4 space-y-3 rounded-xl border border-amateur-border bg-amateur-canvas p-4"
                >
                  <p className="text-sm text-amateur-muted">{t('pages.athleteCharges.paymentHint')}</p>
                  <label className="flex flex-col gap-1 text-sm">
                    <span>{t('pages.athleteCharges.athlete')}</span>
                    <select
                      value={paymentForm.athleteId}
                      onChange={(e) => setPaymentForm((current) => ({ ...current, athleteId: e.target.value }))}
                      className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                    >
                      <option value="">{t('pages.athleteCharges.chooseAthlete')}</option>
                      {athletes.map((athlete) => (
                        <option key={athlete.id} value={athlete.id}>
                          {getPersonName(athlete)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm">
                      <span>{t('pages.athleteCharges.currency')}</span>
                      <input
                        value={paymentForm.currency}
                        onChange={(e) =>
                          setPaymentForm((current) => ({ ...current, currency: e.target.value.toUpperCase() }))
                        }
                        className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span>{t('pages.athleteCharges.paymentDate')}</span>
                      <input
                        type="datetime-local"
                        value={paymentForm.paidAt}
                        onChange={(e) => setPaymentForm((current) => ({ ...current, paidAt: e.target.value }))}
                        className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                      />
                    </label>
                  </div>
                  <fieldset className="space-y-2 rounded-xl border border-amateur-border bg-amateur-surface p-3">
                    <legend className="px-1 text-sm font-medium">
                      {t('pages.athleteCharges.allocateCharges')}
                    </legend>
                    {chargeOptionsForPayment.length === 0 ? (
                      <p className="text-sm text-amateur-muted">{t('pages.athleteCharges.noOpenCharges')}</p>
                    ) : (
                      chargeOptionsForPayment.map((charge) => (
                        <div key={charge.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-center">
                          <div>
                            <p className="font-medium text-amateur-ink">
                              {charge.chargeItem?.name ?? charge.chargeItemId}
                            </p>
                            <p className="text-xs text-amateur-muted">
                              {t('pages.athleteCharges.remaining')}:{' '}
                              {charge.chargeItem?.currency ?? paymentForm.currency} {charge.remainingAmount}
                              {charge.isOverdue ? ` · ${t('pages.athleteCharges.overdue')}` : ''}
                            </p>
                          </div>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={charge.remainingAmount}
                            value={paymentForm.allocations[charge.id] ?? ''}
                            onChange={(e) =>
                              setPaymentForm((current) => ({
                                ...current,
                                allocations: {
                                  ...current.allocations,
                                  [charge.id]: e.target.value,
                                },
                              }))
                            }
                            className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
                          />
                        </div>
                      ))
                    )}
                  </fieldset>
                  <details className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2">
                    <summary className="cursor-pointer text-sm font-medium text-amateur-ink">
                      {t('pages.athleteCharges.actions.advancedDetails')}
                    </summary>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1 text-sm">
                        <span>{t('pages.athleteCharges.paymentMethod')}</span>
                        <input
                          value={paymentForm.method}
                          onChange={(e) => setPaymentForm((current) => ({ ...current, method: e.target.value }))}
                          placeholder={t('pages.athleteCharges.paymentMethodPlaceholder')}
                          className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        <span>{t('pages.athleteCharges.reference')}</span>
                        <input
                          value={paymentForm.reference}
                          onChange={(e) => setPaymentForm((current) => ({ ...current, reference: e.target.value }))}
                          placeholder={t('pages.athleteCharges.referencePlaceholder')}
                          className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                        <span>{t('pages.athleteCharges.notes')}</span>
                        <textarea
                          value={paymentForm.notes}
                          onChange={(e) => setPaymentForm((current) => ({ ...current, notes: e.target.value }))}
                          rows={2}
                          className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
                        />
                      </label>
                    </div>
                  </details>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-amateur-border px-3 py-2 text-sm text-amateur-muted">
                    <span>
                      {t('pages.athleteCharges.paymentTotal')}: {paymentForm.currency} {paymentTotal.toFixed(2)}
                    </span>
                    <Button
                      type="button"
                      onClick={() => void submitPayment()}
                      disabled={!paymentForm.athleteId || paymentTotal <= 0 || paymentSaving}
                    >
                      {t('pages.athleteCharges.recordPayment')}
                    </Button>
                  </div>
                </div>
              ) : null}

              {openAction === 'bulk' ? (
                <div
                  id="charge-action-panel-bulk"
                  role="tabpanel"
                  aria-labelledby="charge-action-tab-bulk"
                  className="mt-4 space-y-3 rounded-xl border border-amateur-border bg-amateur-canvas p-4"
                >
                  <p className="text-sm text-amateur-muted">{t('pages.athleteCharges.bulkHint')}</p>
                  <label className="flex flex-col gap-1 text-sm">
                    <span>{t('pages.athleteCharges.bulkTargetType')}</span>
                    <select
                      value={bulkTargetType}
                      onChange={(e) => {
                        const next = e.target.value as BulkChargeTargetType;
                        setBulkTargetType(next);
                        if (next !== 'group') setBulkGroupId('');
                        if (next !== 'team') setBulkTeamId('');
                      }}
                      className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                    >
                      <option value="selected">{t('pages.athleteCharges.bulkTargetSelected')}</option>
                      <option value="group">{t('pages.athleteCharges.bulkTargetGroup')}</option>
                      <option value="team">{t('pages.athleteCharges.bulkTargetTeam')}</option>
                    </select>
                  </label>
                  {bulkTargetType === 'selected' ? (
                    <div className="rounded-xl border border-amateur-border bg-amateur-surface p-3">
                      <p className="text-sm text-amateur-muted">
                        {hasSelection
                          ? t('pages.athleteCharges.selectedCount', { count: selectedAthletes.length })
                          : t('pages.athleteCharges.selectAthletesHint')}
                      </p>
                      {hasSelection ? (
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {selectedAthletePreview.map((athlete) => (
                            <li
                              key={athlete.id}
                              className="rounded-full border border-amateur-border bg-amateur-canvas px-3 py-1 text-xs text-amateur-ink"
                            >
                              {getPersonName(athlete)}
                              {athlete.primaryGroupId
                                ? ` · ${groupMap.get(athlete.primaryGroupId) ?? '—'}`
                                : ''}
                            </li>
                          ))}
                          {selectedAthletes.length > selectedAthletePreview.length ? (
                            <li className="rounded-full border border-dashed border-amateur-border px-3 py-1 text-xs text-amateur-muted">
                              +{selectedAthletes.length - selectedAthletePreview.length}
                            </li>
                          ) : null}
                        </ul>
                      ) : null}
                      <details className="mt-3 rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2">
                        <summary className="cursor-pointer text-sm font-medium text-amateur-ink">
                          {t('pages.athleteCharges.selectAthletes')}
                        </summary>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          {athletes.map((athlete) => (
                            <label
                              key={athlete.id}
                              className="flex items-start gap-3 rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-sm"
                            >
                              <input
                                type="checkbox"
                                checked={selectedAthleteIds.includes(athlete.id)}
                                onChange={() => toggleSelection(athlete)}
                              />
                              <span>
                                <span className="block font-medium text-amateur-ink">
                                  {getPersonName(athlete)}
                                </span>
                                <span className="block text-xs text-amateur-muted">
                                  {athlete.primaryGroupId
                                    ? groupMap.get(athlete.primaryGroupId) ?? '—'
                                    : t('pages.athletes.noGroup')}
                                </span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </details>
                    </div>
                  ) : null}
                  {bulkTargetType === 'group' ? (
                    <label className="flex flex-col gap-1 text-sm">
                      <span>{t('pages.athletes.primaryGroup')}</span>
                      <select
                        value={bulkGroupId}
                        onChange={(e) => {
                          setBulkGroupId(e.target.value);
                          setBulkTeamId('');
                        }}
                        className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                      >
                        <option value="">{t('pages.athletes.allGroups')}</option>
                        {groups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {bulkTargetType === 'team' ? (
                    <label className="flex flex-col gap-1 text-sm">
                      <span>{t('pages.teams.title')}</span>
                      <select
                        value={bulkTeamId}
                        onChange={(e) => setBulkTeamId(e.target.value)}
                        className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                      >
                        <option value="">{t('pages.athletes.allTeams')}</option>
                        {visibleBulkTeams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {bulkTargetType !== 'selected' ? (
                    <label className="flex flex-col gap-1 text-sm">
                      <span>{t('pages.athleteCharges.bulkStatusScope')}</span>
                      <select
                        value={bulkStatusScope}
                        onChange={(e) => setBulkStatusScope(e.target.value as BulkChargeStatusScope)}
                        className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                      >
                        <option value="default">{t('pages.athleteCharges.bulkStatusScopeDefault')}</option>
                        <option value="all">{t('pages.athleteCharges.bulkStatusScopeAll')}</option>
                        {(['trial', 'active', 'paused', 'inactive', 'archived'] as AthleteStatus[]).map((athleteStatus) => (
                          <option key={athleteStatus} value={athleteStatus}>
                            {t('pages.athleteCharges.bulkStatusScopeSingle', {
                              status: getAthleteStatusLabel(t, athleteStatus),
                            })}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label className="flex flex-col gap-1 text-sm">
                    <span>{t('pages.athleteCharges.item')}</span>
                    <select
                      value={bulkChargeItemId}
                      onChange={(e) => setBulkChargeItemId(e.target.value)}
                      className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                    >
                      <option value="">{t('pages.athleteCharges.chooseItem')}</option>
                      {chargeItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.currency} {item.defaultAmount})
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm">
                      <span>{t('pages.athleteCharges.amount')}</span>
                      <input
                        value={bulkAmount}
                        onChange={(e) => setBulkAmount(e.target.value)}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder={t('pages.athleteCharges.useDefaultAmount')}
                        className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span>{t('pages.athleteCharges.due')}</span>
                      <input
                        type="date"
                        value={bulkDueDate}
                        onChange={(e) => setBulkDueDate(e.target.value)}
                        className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                      />
                    </label>
                  </div>
                  <div className="rounded-xl border border-dashed border-amateur-border px-3 py-2 text-sm text-amateur-muted">
                    {bulkTargetType === 'selected'
                      ? t('pages.athleteCharges.selectedCount', { count: selectedAthletes.length })
                      : bulkTargetType === 'group'
                        ? t('pages.athleteCharges.bulkTargetSummaryGroup', {
                            group: groups.find((group) => group.id === bulkGroupId)?.name ?? '—',
                          })
                        : t('pages.athleteCharges.bulkTargetSummaryTeam', {
                            team: teams.find((team) => team.id === bulkTeamId)?.name ?? '—',
                          })}
                  </div>
                  <p className="text-xs text-amateur-muted">{t('pages.athleteCharges.bulkScopeHint')}</p>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={() => void assignBulkCharges()}
                      disabled={
                        !bulkChargeItemId ||
                        bulkSaving ||
                        (bulkTargetType === 'selected' && selectedAthleteIds.length === 0) ||
                        (bulkTargetType === 'group' && !bulkGroupId) ||
                        (bulkTargetType === 'team' && !bulkTeamId)
                      }
                    >
                      {t('pages.athleteCharges.assignBulk')}
                    </Button>
                  </div>
                </div>
              ) : null}

              {openAction === 'periodic' ? (
                <div
                  id="charge-action-panel-periodic"
                  role="tabpanel"
                  aria-labelledby="charge-action-tab-periodic"
                  className="mt-4 space-y-3 rounded-xl border border-amateur-border bg-amateur-canvas p-4"
                >
                  <p className="text-sm text-amateur-muted">{t('pages.athleteCharges.periodicHint')}</p>
                  <label className="flex flex-col gap-1 text-sm">
                    <span>{t('pages.athleteCharges.targetType')}</span>
                    <select
                      value={periodicTargetType}
                      onChange={(e) => {
                        const next = e.target.value as PeriodicTargetType;
                        setPeriodicTargetType(next);
                        if (next !== 'group') setPeriodicGroupId('');
                        if (next !== 'team') setPeriodicTeamId('');
                        setPeriodicPreview(null);
                      }}
                      className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                    >
                      <option value="selected">{t('pages.athleteCharges.targetSelected')}</option>
                      <option value="group">{t('pages.athleteCharges.targetGroup')}</option>
                      <option value="team">{t('pages.athleteCharges.targetTeam')}</option>
                    </select>
                  </label>

                  {periodicTargetType === 'group' ? (
                    <label className="flex flex-col gap-1 text-sm">
                      <span>{t('pages.athletes.primaryGroup')}</span>
                      <select
                        value={periodicGroupId}
                        onChange={(e) => {
                          setPeriodicGroupId(e.target.value);
                          setPeriodicPreview(null);
                        }}
                        className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                      >
                        <option value="">{t('pages.athletes.allGroups')}</option>
                        {groups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  {periodicTargetType === 'team' ? (
                    <label className="flex flex-col gap-1 text-sm">
                      <span>{t('pages.teams.title')}</span>
                      <select
                        value={periodicTeamId}
                        onChange={(e) => {
                          setPeriodicTeamId(e.target.value);
                          setPeriodicPreview(null);
                        }}
                        className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                      >
                        <option value="">{t('pages.athletes.allTeams')}</option>
                        {visiblePeriodicTeams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  <label className="flex flex-col gap-1 text-sm">
                    <span>{t('pages.athleteCharges.item')}</span>
                    <select
                      value={periodicChargeItemId}
                      onChange={(e) => {
                        setPeriodicChargeItemId(e.target.value);
                        setPeriodicPreview(null);
                      }}
                      className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                    >
                      <option value="">{t('pages.athleteCharges.chooseItem')}</option>
                      {chargeItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.currency} {item.defaultAmount})
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm">
                      <span>{t('pages.athleteCharges.periodKey')}</span>
                      <input
                        value={periodicKey}
                        onChange={(e) => {
                          setPeriodicKey(e.target.value);
                          setPeriodicPreview(null);
                        }}
                        placeholder={t('pages.athleteCharges.periodKeyPlaceholder')}
                        className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span>{t('pages.athleteCharges.periodLabel')}</span>
                      <input
                        value={periodicLabel}
                        onChange={(e) => {
                          setPeriodicLabel(e.target.value);
                          setPeriodicPreview(null);
                        }}
                        placeholder={t('pages.athleteCharges.periodLabelPlaceholder')}
                        className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                      />
                    </label>
                  </div>

                  <details className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2">
                    <summary className="cursor-pointer text-sm font-medium text-amateur-ink">
                      {t('pages.athleteCharges.actions.advancedDetails')}
                    </summary>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1 text-sm">
                        <span>{t('pages.athleteCharges.amount')}</span>
                        <input
                          value={periodicAmount}
                          onChange={(e) => {
                            setPeriodicAmount(e.target.value);
                            setPeriodicPreview(null);
                          }}
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
                          value={periodicDueDate}
                          onChange={(e) => {
                            setPeriodicDueDate(e.target.value);
                            setPeriodicPreview(null);
                          }}
                          className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                        <span>{t('pages.athleteCharges.notes')}</span>
                        <textarea
                          value={periodicNotes}
                          onChange={(e) => {
                            setPeriodicNotes(e.target.value);
                            setPeriodicPreview(null);
                          }}
                          rows={2}
                          className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
                        />
                      </label>
                    </div>
                  </details>

                  <div className="rounded-xl border border-dashed border-amateur-border px-3 py-2 text-sm text-amateur-muted">
                    {periodicTargetType === 'selected'
                      ? t('pages.athleteCharges.periodicTargetSummarySelected', { count: selectedAthleteIds.length })
                      : periodicTargetType === 'group'
                        ? t('pages.athleteCharges.periodicTargetSummaryGroup', {
                            group: groups.find((group) => group.id === periodicGroupId)?.name ?? '—',
                          })
                        : t('pages.athleteCharges.periodicTargetSummaryTeam', {
                            team: teams.find((team) => team.id === periodicTeamId)?.name ?? '—',
                          })}
                  </div>

                  {periodicPreview ? (
                    <div className="rounded-xl border border-amateur-border bg-amateur-surface px-4 py-3 text-sm">
                      <p className="font-medium text-amateur-ink">
                        {t('pages.athleteCharges.periodicPreviewSummary', {
                          creatable: periodicPreview.creatableAthletes,
                          targeted: periodicPreview.targetedAthletes,
                          period: periodicPreview.periodLabel,
                        })}
                      </p>
                      {periodicPreview.skippedAthletes.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-amateur-muted">
                          {periodicPreview.skippedAthletes.slice(0, 4).map((row) => (
                            <li key={row.athleteId}>
                              {row.athleteName} — {t('pages.athleteCharges.periodicDuplicateWarning')}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-amateur-muted">{t('pages.athleteCharges.periodicNoDuplicates')}</p>
                      )}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void previewPeriodicCharges()}
                      disabled={
                        periodicLoading ||
                        !periodicChargeItemId ||
                        !periodicKey.trim() ||
                        !periodicLabel.trim() ||
                        (periodicTargetType === 'selected' && selectedAthleteIds.length === 0) ||
                        (periodicTargetType === 'group' && !periodicGroupId) ||
                        (periodicTargetType === 'team' && !periodicTeamId)
                      }
                    >
                      {t('pages.athleteCharges.previewPeriodic')}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void generatePeriodicCharges()}
                      disabled={
                        periodicSaving ||
                        !periodicChargeItemId ||
                        !periodicKey.trim() ||
                        !periodicLabel.trim() ||
                        (periodicTargetType === 'selected' && selectedAthleteIds.length === 0) ||
                        (periodicTargetType === 'group' && !periodicGroupId) ||
                        (periodicTargetType === 'team' && !periodicTeamId)
                      }
                    >
                      {t('pages.athleteCharges.generatePeriodic')}
                    </Button>
                  </div>
                </div>
              ) : null}
            </section>
          </>
        )}

        {message ? <InlineAlert tone="success" className="mb-4">{message}</InlineAlert> : null}
        {error ? <InlineAlert tone="error" className="mb-4">{error}</InlineAlert> : null}

        {!tenantId && !tenantLoading ? (
          <p className="text-sm text-amateur-muted">{t('app.errors.needTenant')}</p>
        ) : loading ? (
          <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>
        ) : items.length === 0 ? (
          <EmptyState title={t('pages.athleteCharges.empty')} hint={t('pages.athleteCharges.emptyHint')} />
        ) : (
          <div className="space-y-6">
            <section aria-labelledby="charges-list-title">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="charges-list-title" className="font-display text-base font-semibold text-amateur-ink">
                  {t('pages.athleteCharges.listTitle')}
                </h2>
                <p className="text-xs text-amateur-muted">{t('pages.athleteCharges.listCount', { count: items.length })}</p>
              </div>
              <div className="mt-3 space-y-3 md:hidden">
                {items.map((charge) => (
                  <article key={charge.id} className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-amateur-ink">
                          {charge.chargeItem?.name ?? charge.chargeItemId}
                        </p>
                        <p className="mt-1 text-sm text-amateur-muted">{getChargeCurrencyAmount(charge)}</p>
                      </div>
                      <span className="whitespace-nowrap text-xs font-medium text-amateur-muted">
                        {formatDate(charge.dueDate, i18n.language)}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-amateur-muted">
                      <p>
                        {t('pages.athleteCharges.remaining')}: {(charge.chargeItem?.currency ?? '')} {charge.remainingAmount}
                      </p>
                      <p className="flex flex-wrap items-center gap-2">
                        <span>{getChargeStatusLabel(t, charge.derivedStatus ?? charge.status)}</span>
                        {charge.isOverdue ? (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            {t('pages.athleteCharges.overdue')}
                          </span>
                        ) : null}
                      </p>
                      <Link
                        to={`/app/athletes/${charge.athleteId}`}
                        className="inline-flex font-medium text-amateur-accent hover:underline"
                      >
                        {charge.athlete ? getPersonName(charge.athlete) : t('pages.athleteCharges.openAthlete')}
                      </Link>
                    </div>
                    <select
                      value={charge.status}
                      onChange={(e) => void updateChargeStatus(charge.id, e.target.value as AthleteChargeStatus)}
                      className="mt-3 w-full rounded-lg border border-amateur-border bg-amateur-surface px-3 py-2 text-sm"
                      aria-label={t('pages.athleteCharges.status')}
                    >
                      {chargeStatuses.map((chargeStatus) => (
                        <option key={chargeStatus} value={chargeStatus}>
                          {getChargeStatusLabel(t, chargeStatus)}
                        </option>
                      ))}
                    </select>
                  </article>
                ))}
              </div>
              <div className="mt-3 hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-amateur-border text-amateur-muted">
                      <th className="pb-2 font-medium">{t('pages.athleteCharges.item')}</th>
                      <th className="pb-2 font-medium">{t('pages.athleteCharges.amount')}</th>
                      <th className="pb-2 font-medium">{t('pages.athleteCharges.remaining')}</th>
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
                        <td className="py-3">
                          {(c.chargeItem?.currency ?? '')} {c.remainingAmount}
                        </td>
                        <td className="py-3">
                          {formatDate(c.dueDate, i18n.language)}
                          {c.isOverdue ? (
                            <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                              {t('pages.athleteCharges.overdue')}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-3 text-amateur-muted">
                          {getChargeStatusLabel(t, c.derivedStatus ?? c.status)}
                        </td>
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
                            aria-label={t('pages.athleteCharges.status')}
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
            </section>

            <section className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-amateur-ink">
                    {t('pages.athleteCharges.recentPayments')}
                  </h2>
                  <p className="mt-1 text-sm text-amateur-muted">{t('pages.athleteCharges.recentPaymentsHint')}</p>
                </div>
              </div>
              {payments.length === 0 ? (
                <div className="mt-4 rounded-xl border border-dashed border-amateur-border bg-amateur-surface px-4 py-6 text-sm text-amateur-muted">
                  {t('pages.athleteCharges.noPayments')}
                </div>
              ) : (
                <div className="mt-4">
                  <div className="space-y-3 md:hidden">
                    {payments.map((payment) => (
                      <article key={payment.id} className="rounded-xl border border-amateur-border bg-amateur-surface px-4 py-4">
                        <p className="font-medium text-amateur-ink">
                          {payment.athlete ? getPersonName(payment.athlete) : '—'}
                        </p>
                        <p className="mt-1 text-sm text-amateur-muted">
                          {payment.currency} {payment.amount}
                        </p>
                        <p className="mt-2 text-xs text-amateur-muted">
                          {formatDate(payment.paidAt, i18n.language)} · {payment.method || '—'}
                        </p>
                        {payment.reference ? (
                          <p className="mt-1 text-xs text-amateur-muted">{payment.reference}</p>
                        ) : null}
                      </article>
                    ))}
                  </div>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-amateur-border text-amateur-muted">
                          <th className="pb-2 font-medium">{t('pages.athleteCharges.athlete')}</th>
                          <th className="pb-2 font-medium">{t('pages.athleteCharges.amount')}</th>
                          <th className="pb-2 font-medium">{t('pages.athleteCharges.paymentDate')}</th>
                          <th className="pb-2 font-medium">{t('pages.athleteCharges.paymentMethod')}</th>
                          <th className="pb-2 font-medium">{t('pages.athleteCharges.reference')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((payment) => (
                          <tr key={payment.id} className="border-b border-amateur-border/70 last:border-0">
                            <td className="py-3">{payment.athlete ? getPersonName(payment.athlete) : '—'}</td>
                            <td className="py-3">
                              {payment.currency} {payment.amount}
                            </td>
                            <td className="py-3">{formatDate(payment.paidAt, i18n.language)}</td>
                            <td className="py-3">{payment.method || '—'}</td>
                            <td className="py-3">{payment.reference || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </ListPageFrame>
    </div>
  );
}
