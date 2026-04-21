import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiGet, apiPost, apiPut } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { Button } from '../components/ui/Button';
import { InlineAlert } from '../components/ui/InlineAlert';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import type {
  AssignSubscriptionPayload,
  LicenseFeatureCatalogResponse,
  LicensePlanSummary,
  LicenseUsageBandSummary,
  PlanEditingPayload,
  PlanEditingMatrixRow,
  SnapshotPassResult,
  TenantSubscriptionHistoryEntry,
  TenantSubscriptionStatus,
  TenantSubscriptionSummary,
  TenantUsageSnapshotSummary,
} from '../lib/licensing-types';
import { TENANT_SUBSCRIPTION_STATUS_VALUES } from '../lib/licensing-types';

type TabKey =
  | 'plans'
  | 'subscriptions'
  | 'usage'
  | 'history'
  | 'editEntitlements';

function statusTone(status: TenantSubscriptionStatus | null): 'success' | 'info' | 'warning' | 'danger' | 'default' {
  switch (status) {
    case 'active':
      return 'success';
    case 'trial':
      return 'info';
    case 'suspended':
      return 'warning';
    case 'expired':
    case 'cancelled':
      return 'danger';
    default:
      return 'default';
  }
}

function isoToInputDate(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function inputDateToISO(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toISOString().slice(0, 10);
}

export function BillingLicensingPage() {
  const { t } = useTranslation();
  const { staffUser, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('subscriptions');

  const [plans, setPlans] = useState<LicensePlanSummary[]>([]);
  const [bands, setBands] = useState<LicenseUsageBandSummary[]>([]);
  const [subscriptions, setSubscriptions] = useState<TenantSubscriptionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<TenantUsageSnapshotSummary[]>([]);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [savingSnapshot, setSavingSnapshot] = useState(false);

  const [editingTenantId, setEditingTenantId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<AssignSubscriptionPayload>({
    planCode: '',
    status: 'trial',
  });
  const [savingForm, setSavingForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isPlatformAdmin = staffUser?.platformRole === 'global_admin';

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [planList, bandList, subscriptionList] = await Promise.all([
        apiGet<LicensePlanSummary[]>('/api/admin/licensing/plans'),
        apiGet<LicenseUsageBandSummary[]>('/api/admin/licensing/bands'),
        apiGet<TenantSubscriptionSummary[]>('/api/admin/licensing/subscriptions'),
      ]);
      setPlans(planList);
      setBands(bandList);
      setSubscriptions(subscriptionList);
      if (!selectedTenantId && subscriptionList[0]) {
        setSelectedTenantId(subscriptionList[0].tenantId);
      }
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : t('app.errors.loadFailed'),
      );
    } finally {
      setLoading(false);
    }
  }, [selectedTenantId, t]);

  useEffect(() => {
    if (isPlatformAdmin) {
      void refreshAll();
    }
  }, [isPlatformAdmin, refreshAll]);

  const selectedSubscription = useMemo(
    () => subscriptions.find((row) => row.tenantId === selectedTenantId) ?? null,
    [selectedTenantId, subscriptions],
  );

  const loadSnapshots = useCallback(
    async (tenantId: string) => {
      setSnapshotLoading(true);
      setSnapshotError(null);
      try {
        const list = await apiGet<TenantUsageSnapshotSummary[]>(
          `/api/admin/licensing/usage/${tenantId}/snapshots?limit=12`,
        );
        setSnapshots(list);
      } catch (error) {
        setSnapshotError(
          error instanceof Error ? error.message : t('app.errors.loadFailed'),
        );
      } finally {
        setSnapshotLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (activeTab === 'usage' && selectedTenantId) {
      void loadSnapshots(selectedTenantId);
    }
  }, [activeTab, loadSnapshots, selectedTenantId]);

  const recordSnapshot = useCallback(async () => {
    if (!selectedTenantId) return;
    setSavingSnapshot(true);
    setSnapshotError(null);
    try {
      await apiPost(`/api/admin/licensing/usage/${selectedTenantId}/snapshots`, {});
      await loadSnapshots(selectedTenantId);
      await refreshAll();
    } catch (error) {
      setSnapshotError(
        error instanceof Error ? error.message : t('app.errors.saveFailed'),
      );
    } finally {
      setSavingSnapshot(false);
    }
  }, [loadSnapshots, refreshAll, selectedTenantId, t]);

  function openEditor(subscription: TenantSubscriptionSummary) {
    setEditingTenantId(subscription.tenantId);
    setSelectedTenantId(subscription.tenantId);
    setEditForm({
      planCode: subscription.plan.code || plans[0]?.code || '',
      status: subscription.status ?? 'trial',
      startDate: subscription.startDate,
      renewalDate: subscription.renewalDate,
      trialEndsAt: subscription.trialEndsAt,
      onboardingServiceIncluded: subscription.onboardingServiceIncluded,
      internalNotes: subscription.internalNotes ?? '',
      statusReason: subscription.statusReason ?? '',
    });
    setFormError(null);
  }

  function closeEditor() {
    setEditingTenantId(null);
    setFormError(null);
  }

  async function submitEditor() {
    if (!editingTenantId) return;
    if (!editForm.planCode) {
      setFormError(t('pages.billing.form.planRequired'));
      return;
    }
    setSavingForm(true);
    setFormError(null);
    try {
      await apiPut(`/api/admin/licensing/subscriptions/${editingTenantId}`, {
        planCode: editForm.planCode,
        status: editForm.status,
        startDate: inputDateToISO(editForm.startDate ?? null),
        renewalDate: inputDateToISO(editForm.renewalDate ?? null),
        trialEndsAt: inputDateToISO(editForm.trialEndsAt ?? null),
        onboardingServiceIncluded: Boolean(editForm.onboardingServiceIncluded),
        internalNotes: editForm.internalNotes?.trim() || null,
        statusReason: editForm.statusReason?.trim() || null,
      });
      await refreshAll();
      closeEditor();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : t('app.errors.saveFailed'),
      );
    } finally {
      setSavingForm(false);
    }
  }

  const totals = useMemo(() => {
    const total = subscriptions.length;
    const active = subscriptions.filter((row) => row.status === 'active').length;
    const trial = subscriptions.filter((row) => row.status === 'trial').length;
    const suspended = subscriptions.filter((row) => row.status === 'suspended').length;
    return { total, active, trial, suspended };
  }, [subscriptions]);

  if (authLoading) {
    return (
      <div className="px-4 py-10 text-sm text-amateur-muted">
        {t('app.states.loading')}
      </div>
    );
  }

  if (!isPlatformAdmin) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return (
    <div>
      <PageHeader
        title={t('pages.billing.title')}
        subtitle={t('pages.billing.subtitle')}
        actions={
          <Button type="button" variant="ghost" onClick={() => void refreshAll()}>
            {t('app.actions.refresh')}
          </Button>
        }
      />

      {loadError ? (
        <InlineAlert tone="error" className="mb-4">
          {loadError}
        </InlineAlert>
      ) : null}

      <section className="mb-6 grid gap-4 md:grid-cols-4">
        <StatCard label={t('pages.billing.summary.total')} value={totals.total} />
        <StatCard label={t('pages.billing.summary.active')} value={totals.active} />
        <StatCard label={t('pages.billing.summary.trial')} value={totals.trial} />
        <StatCard
          label={t('pages.billing.summary.suspended')}
          value={totals.suspended}
          tone={totals.suspended > 0 ? 'danger' : 'default'}
        />
      </section>

      <div
        role="tablist"
        aria-label={t('pages.billing.tabs.label')}
        className="mb-6 inline-flex flex-wrap gap-2 rounded-2xl border border-amateur-border bg-amateur-surface p-1.5 text-sm"
      >
        {(['subscriptions', 'plans', 'editEntitlements', 'usage', 'history'] as const).map(
          (key) => {
            const isActive = activeTab === key;
            const label =
              key === 'editEntitlements' || key === 'history'
                ? t(`pages.billing.tabs2.${key}`)
                : t(`pages.billing.tabs.${key}`);
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(key)}
                className={
                  isActive
                    ? 'rounded-xl bg-amateur-accent-soft px-4 py-2 font-semibold text-amateur-accent'
                    : 'rounded-xl px-4 py-2 text-amateur-muted hover:text-amateur-ink'
                }
              >
                {label}
              </button>
            );
          },
        )}
      </div>

      {loading ? (
        <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>
      ) : null}

      {activeTab === 'subscriptions' ? (
        <SubscriptionsPanel
          subscriptions={subscriptions}
          plans={plans}
          editingTenantId={editingTenantId}
          editForm={editForm}
          setEditForm={setEditForm}
          savingForm={savingForm}
          formError={formError}
          openEditor={openEditor}
          closeEditor={closeEditor}
          submitEditor={submitEditor}
          selectTenant={(id) => setSelectedTenantId(id)}
        />
      ) : null}

      {activeTab === 'plans' ? (
        <PlansPanel plans={plans} bands={bands} />
      ) : null}

      {activeTab === 'usage' ? (
        <UsagePanel
          subscriptions={subscriptions}
          selectedTenantId={selectedTenantId}
          setSelectedTenantId={setSelectedTenantId}
          selectedSubscription={selectedSubscription}
          snapshots={snapshots}
          snapshotLoading={snapshotLoading}
          snapshotError={snapshotError}
          savingSnapshot={savingSnapshot}
          recordSnapshot={recordSnapshot}
          bands={bands}
        />
      ) : null}

      {activeTab === 'history' ? (
        <HistoryPanel
          subscriptions={subscriptions}
          selectedTenantId={selectedTenantId}
          setSelectedTenantId={setSelectedTenantId}
        />
      ) : null}

      {activeTab === 'editEntitlements' ? (
        <EntitlementEditorPanel plans={plans} />
      ) : null}
    </div>
  );
}

type SubscriptionsPanelProps = {
  subscriptions: TenantSubscriptionSummary[];
  plans: LicensePlanSummary[];
  editingTenantId: string | null;
  editForm: AssignSubscriptionPayload;
  setEditForm: (next: AssignSubscriptionPayload) => void;
  savingForm: boolean;
  formError: string | null;
  openEditor: (subscription: TenantSubscriptionSummary) => void;
  closeEditor: () => void;
  submitEditor: () => Promise<void>;
  selectTenant: (id: string) => void;
};

function SubscriptionsPanel({
  subscriptions,
  plans,
  editingTenantId,
  editForm,
  setEditForm,
  savingForm,
  formError,
  openEditor,
  closeEditor,
  submitEditor,
  selectTenant,
}: SubscriptionsPanelProps) {
  const { t } = useTranslation();

  if (subscriptions.length === 0) {
    return (
      <InlineAlert tone="info">{t('pages.billing.subscriptions.empty')}</InlineAlert>
    );
  }

  return (
    <div className="space-y-4">
      {subscriptions.map((subscription) => {
        const isEditing = editingTenantId === subscription.tenantId;
        return (
          <article
            key={subscription.tenantId}
            className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm"
            onClick={() => selectTenant(subscription.tenantId)}
          >
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-amateur-ink">
                  {subscription.tenantName}
                </h2>
                <p className="mt-1 text-xs text-amateur-muted">
                  {subscription.tenantSlug}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone="default">
                  {subscription.plan.name || t('pages.billing.subscriptions.noPlan')}
                </StatusBadge>
                <StatusBadge tone={statusTone(subscription.status)}>
                  {t(`pages.billing.statuses.${subscription.status}`)}
                </StatusBadge>
                {subscription.onboardingServiceIncluded ? (
                  <StatusBadge tone="info">
                    {t('pages.billing.subscriptions.onboardingChip')}
                  </StatusBadge>
                ) : null}
              </div>
            </header>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <Snippet
                label={t('pages.billing.subscriptions.startDate')}
                value={formatDate(subscription.startDate)}
              />
              <Snippet
                label={t('pages.billing.subscriptions.renewalDate')}
                value={formatDate(subscription.renewalDate)}
              />
              <Snippet
                label={t('pages.billing.subscriptions.trialEndsAt')}
                value={formatDate(subscription.trialEndsAt)}
              />
              <Snippet
                label={t('pages.billing.subscriptions.activeAthletes')}
                value={String(subscription.usage.activeAthleteCount)}
                hint={subscription.usage.band.label ?? t('pages.billing.usage.noBand')}
              />
            </div>

            {subscription.internalNotes ? (
              <p className="mt-3 rounded-xl bg-amateur-canvas px-3 py-2 text-xs text-amateur-muted">
                <span className="font-semibold text-amateur-ink">
                  {t('pages.billing.subscriptions.internalNotes')}:
                </span>{' '}
                {subscription.internalNotes}
              </p>
            ) : null}
            {subscription.statusReason ? (
              <p className="mt-2 text-xs text-amateur-muted">
                <span className="font-semibold text-amateur-ink">
                  {t('pages.billing.subscriptions.statusReason')}:
                </span>{' '}
                {subscription.statusReason}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-amateur-muted">
              <p>
                {t('pages.billing.subscriptions.lastChangedBy', {
                  name:
                    subscription.lastChangedByDisplayName ??
                    subscription.assignedByDisplayName ??
                    t('pages.billing.subscriptions.unknownActor'),
                })}
              </p>
              <Button type="button" variant="ghost" onClick={() => openEditor(subscription)}>
                {t('pages.billing.subscriptions.edit')}
              </Button>
            </div>

            {isEditing ? (
              <div className="mt-4 rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
                <h3 className="font-display text-sm font-semibold text-amateur-ink">
                  {t('pages.billing.form.title')}
                </h3>
                <p className="mt-1 text-xs text-amateur-muted">
                  {t('pages.billing.form.subtitle')}
                </p>
                {formError ? (
                  <InlineAlert tone="error" className="mt-3">
                    {formError}
                  </InlineAlert>
                ) : null}
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <FieldLabel label={t('pages.billing.form.plan')}>
                    <select
                      className="w-full rounded-lg border border-amateur-border bg-amateur-surface px-3 py-2 text-sm"
                      value={editForm.planCode}
                      onChange={(e) =>
                        setEditForm({ ...editForm, planCode: e.target.value })
                      }
                    >
                      <option value="">{t('pages.billing.form.planPlaceholder')}</option>
                      {plans.map((plan) => (
                        <option key={plan.code} value={plan.code}>
                          {plan.name}
                        </option>
                      ))}
                    </select>
                  </FieldLabel>
                  <FieldLabel label={t('pages.billing.form.status')}>
                    <select
                      className="w-full rounded-lg border border-amateur-border bg-amateur-surface px-3 py-2 text-sm"
                      value={editForm.status}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          status: e.target.value as TenantSubscriptionStatus,
                        })
                      }
                    >
                      {TENANT_SUBSCRIPTION_STATUS_VALUES.map((status) => (
                        <option key={status} value={status}>
                          {t(`pages.billing.statuses.${status}`)}
                        </option>
                      ))}
                    </select>
                  </FieldLabel>
                  <FieldLabel label={t('pages.billing.form.startDate')}>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-amateur-border bg-amateur-surface px-3 py-2 text-sm"
                      value={isoToInputDate(editForm.startDate)}
                      onChange={(e) =>
                        setEditForm({ ...editForm, startDate: e.target.value || null })
                      }
                    />
                  </FieldLabel>
                  <FieldLabel label={t('pages.billing.form.renewalDate')}>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-amateur-border bg-amateur-surface px-3 py-2 text-sm"
                      value={isoToInputDate(editForm.renewalDate)}
                      onChange={(e) =>
                        setEditForm({ ...editForm, renewalDate: e.target.value || null })
                      }
                    />
                  </FieldLabel>
                  <FieldLabel label={t('pages.billing.form.trialEndsAt')}>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-amateur-border bg-amateur-surface px-3 py-2 text-sm"
                      value={isoToInputDate(editForm.trialEndsAt)}
                      onChange={(e) =>
                        setEditForm({ ...editForm, trialEndsAt: e.target.value || null })
                      }
                    />
                  </FieldLabel>
                  <FieldLabel label={t('pages.billing.form.onboardingService')}>
                    <label className="inline-flex items-center gap-2 text-sm text-amateur-ink">
                      <input
                        type="checkbox"
                        checked={Boolean(editForm.onboardingServiceIncluded)}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            onboardingServiceIncluded: e.target.checked,
                          })
                        }
                      />
                      {t('pages.billing.form.onboardingServiceHint')}
                    </label>
                  </FieldLabel>
                </div>
                <FieldLabel label={t('pages.billing.form.internalNotes')} className="mt-3">
                  <textarea
                    className="w-full rounded-lg border border-amateur-border bg-amateur-surface px-3 py-2 text-sm"
                    rows={2}
                    maxLength={240}
                    value={editForm.internalNotes ?? ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, internalNotes: e.target.value })
                    }
                  />
                </FieldLabel>
                <FieldLabel label={t('pages.billing.form.statusReason')} className="mt-3">
                  <input
                    className="w-full rounded-lg border border-amateur-border bg-amateur-surface px-3 py-2 text-sm"
                    maxLength={240}
                    value={editForm.statusReason ?? ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, statusReason: e.target.value })
                    }
                  />
                </FieldLabel>

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={closeEditor} disabled={savingForm}>
                    {t('app.actions.cancel')}
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => void submitEditor()}
                    disabled={savingForm}
                  >
                    {savingForm
                      ? t('app.states.saving')
                      : t('pages.billing.form.save')}
                  </Button>
                </div>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

type PlansPanelProps = {
  plans: LicensePlanSummary[];
  bands: LicenseUsageBandSummary[];
};

function PlansPanel({ plans, bands }: PlansPanelProps) {
  const { t } = useTranslation();
  if (plans.length === 0) {
    return <InlineAlert tone="info">{t('pages.billing.plans.empty')}</InlineAlert>;
  }
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => (
          <article
            key={plan.id}
            className="flex flex-col rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm"
          >
            <header className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-amateur-ink">
                  {plan.name}
                </h2>
                <p className="mt-1 text-xs text-amateur-muted">{plan.code}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge tone={plan.isActive ? 'success' : 'default'}>
                  {plan.isActive
                    ? t('pages.billing.plans.activeChip')
                    : t('pages.billing.plans.inactiveChip')}
                </StatusBadge>
                {plan.isDefaultTrial ? (
                  <StatusBadge tone="info">
                    {t('pages.billing.plans.defaultTrialChip')}
                  </StatusBadge>
                ) : null}
              </div>
            </header>
            {plan.description ? (
              <p className="mt-3 text-sm text-amateur-muted">{plan.description}</p>
            ) : null}
            <div className="mt-4 grid gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-amateur-muted">
                {t('pages.billing.plans.entitlementsTitle')}
              </p>
              {plan.entitlements.length === 0 ? (
                <p className="text-xs text-amateur-muted">
                  {t('pages.billing.plans.noEntitlements')}
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {plan.entitlements.map((entitlement) => (
                    <li
                      key={entitlement.featureKey}
                      className="flex items-start justify-between gap-2 text-xs"
                    >
                      <span className="text-amateur-ink">
                        {entitlement.featureKey}
                        {entitlement.limitValue !== null
                          ? ` · ${t('pages.billing.plans.limitLabel', { value: entitlement.limitValue })}`
                          : ''}
                      </span>
                      <StatusBadge tone={entitlement.enabled ? 'success' : 'default'}>
                        {entitlement.enabled
                          ? t('pages.billing.plans.entitlementOn')
                          : t('pages.billing.plans.entitlementOff')}
                      </StatusBadge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        ))}
      </div>

      <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
        <h2 className="font-display text-base font-semibold text-amateur-ink">
          {t('pages.billing.plans.bandsTitle')}
        </h2>
        <p className="mt-1 text-sm text-amateur-muted">
          {t('pages.billing.plans.bandsHint')}
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {bands.map((band) => (
            <li
              key={band.id}
              className="flex items-center justify-between rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-amateur-ink"
            >
              <span>{band.label}</span>
              <span className="text-xs text-amateur-muted">{band.code}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

type UsagePanelProps = {
  subscriptions: TenantSubscriptionSummary[];
  selectedTenantId: string | null;
  setSelectedTenantId: (id: string) => void;
  selectedSubscription: TenantSubscriptionSummary | null;
  snapshots: TenantUsageSnapshotSummary[];
  snapshotLoading: boolean;
  snapshotError: string | null;
  savingSnapshot: boolean;
  recordSnapshot: () => Promise<void>;
  bands: LicenseUsageBandSummary[];
};

function UsagePanel({
  subscriptions,
  selectedTenantId,
  setSelectedTenantId,
  selectedSubscription,
  snapshots,
  snapshotLoading,
  snapshotError,
  savingSnapshot,
  recordSnapshot,
  bands,
}: UsagePanelProps) {
  const { t } = useTranslation();
  const [runningPass, setRunningPass] = useState(false);
  const [passNotice, setPassNotice] = useState<string | null>(null);
  const [passError, setPassError] = useState<string | null>(null);

  async function runScheduledPass() {
    setRunningPass(true);
    setPassNotice(null);
    setPassError(null);
    try {
      const result = await apiPost<SnapshotPassResult>(
        '/api/admin/licensing/usage/snapshots/run',
        {},
      );
      setPassNotice(
        t('pages.billing.usage.scheduledRanResult', {
          tenants: result.tenantsScanned,
          written: result.snapshotsWritten,
        }),
      );
    } catch (error) {
      setPassError(
        error instanceof Error ? error.message : t('app.errors.saveFailed'),
      );
    } finally {
      setRunningPass(false);
    }
  }

  const lastSnapshot = snapshots[0] ?? null;
  const liveCount = selectedSubscription?.usage.activeAthleteCount ?? null;
  const showingLive =
    !lastSnapshot ||
    (liveCount !== null && lastSnapshot.activeAthleteCount === liveCount);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-amateur-ink">
              {t('pages.billing.usage.title')}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-amateur-muted">
              {t('pages.billing.usage.hint')}
            </p>
            <p className="mt-1 max-w-2xl text-xs text-amateur-muted">
              {t('pages.billing.usage.scheduledHint')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => void runScheduledPass()}
              disabled={runningPass}
            >
              {runningPass
                ? t('app.states.saving')
                : t('pages.billing.usage.runScheduledNow')}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => void recordSnapshot()}
              disabled={!selectedTenantId || savingSnapshot}
            >
              {savingSnapshot
                ? t('app.states.saving')
                : t('pages.billing.usage.recordSnapshot')}
            </Button>
          </div>
        </div>

        {passNotice ? (
          <InlineAlert tone="info" className="mt-3">
            {passNotice}
          </InlineAlert>
        ) : null}
        {passError ? (
          <InlineAlert tone="error" className="mt-3">
            {passError}
          </InlineAlert>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_2fr]">
          <FieldLabel label={t('pages.billing.usage.tenantPicker')}>
            <select
              className="w-full rounded-lg border border-amateur-border bg-amateur-surface px-3 py-2 text-sm"
              value={selectedTenantId ?? ''}
              onChange={(e) => setSelectedTenantId(e.target.value)}
            >
              {subscriptions.map((subscription) => (
                <option key={subscription.tenantId} value={subscription.tenantId}>
                  {subscription.tenantName}
                </option>
              ))}
            </select>
          </FieldLabel>

          {selectedSubscription ? (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <StatCard
                  label={t('pages.billing.usage.activeAthletes')}
                  value={selectedSubscription.usage.activeAthleteCount}
                  compact
                />
                <StatCard
                  label={t('pages.billing.usage.evaluatedBand')}
                  value={
                    selectedSubscription.usage.band.label ??
                    t('pages.billing.usage.noBand')
                  }
                  compact
                />
                <StatCard
                  label={t('pages.billing.usage.measuredAt')}
                  value={formatDate(selectedSubscription.usage.measuredAt)}
                  compact
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <StatusBadge tone={showingLive ? 'success' : 'info'}>
                  {showingLive
                    ? t('pages.billing.usage.liveLabel')
                    : t('pages.billing.usage.snapshotLabel')}
                </StatusBadge>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {snapshotError ? (
        <InlineAlert tone="error">{snapshotError}</InlineAlert>
      ) : null}

      <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
        <h3 className="font-display text-sm font-semibold text-amateur-ink">
          {t('pages.billing.usage.snapshotsTitle')}
        </h3>
        <p className="mt-1 text-xs text-amateur-muted">
          {t('pages.billing.usage.snapshotsHint')}
        </p>
        {snapshotLoading ? (
          <p className="mt-3 text-sm text-amateur-muted">{t('app.states.loading')}</p>
        ) : snapshots.length === 0 ? (
          <InlineAlert tone="info" className="mt-3">
            {t('pages.billing.usage.snapshotsEmpty')}
          </InlineAlert>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {snapshots.map((snapshot) => (
              <li
                key={snapshot.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              >
                <div>
                  <p className="font-medium text-amateur-ink">
                    {formatDate(snapshot.measuredAt)} ·{' '}
                    {t('pages.billing.usage.activeAthletesShort', {
                      count: snapshot.activeAthleteCount,
                    })}
                  </p>
                  <p className="text-xs text-amateur-muted">
                    {snapshot.bandLabel ?? snapshot.bandCode ?? t('pages.billing.usage.noBand')}
                    {' · '}
                    {t(`pages.billing.usage.source.${snapshot.source}`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
        <h3 className="font-display text-sm font-semibold text-amateur-ink">
          {t('pages.billing.plans.bandsTitle')}
        </h3>
        <ul className="mt-3 space-y-2 text-sm">
          {bands.map((band) => (
            <li
              key={band.id}
              className="flex items-center justify-between rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-amateur-ink"
            >
              <span>{band.label}</span>
              <span className="text-xs text-amateur-muted">{band.code}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

type HistoryPanelProps = {
  subscriptions: TenantSubscriptionSummary[];
  selectedTenantId: string | null;
  setSelectedTenantId: (id: string) => void;
};

function HistoryPanel({
  subscriptions,
  selectedTenantId,
  setSelectedTenantId,
}: HistoryPanelProps) {
  const { t } = useTranslation();
  const [history, setHistory] = useState<TenantSubscriptionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!selectedTenantId) {
      setHistory([]);
      return () => {
        cancelled = true;
      };
    }
    setLoading(true);
    setError(null);
    apiGet<TenantSubscriptionHistoryEntry[]>(
      `/api/admin/licensing/subscriptions/${selectedTenantId}/history?limit=50`,
    )
      .then((rows) => {
        if (!cancelled) setHistory(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('app.errors.loadFailed'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTenantId, t]);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-amateur-ink">
              {t('pages.billing.history.title')}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-amateur-muted">
              {t('pages.billing.history.hint')}
            </p>
          </div>
          <FieldLabel label={t('pages.billing.usage.tenantPicker')}>
            <select
              className="w-full rounded-lg border border-amateur-border bg-amateur-surface px-3 py-2 text-sm"
              value={selectedTenantId ?? ''}
              onChange={(e) => setSelectedTenantId(e.target.value)}
            >
              {subscriptions.map((subscription) => (
                <option key={subscription.tenantId} value={subscription.tenantId}>
                  {subscription.tenantName}
                </option>
              ))}
            </select>
          </FieldLabel>
        </div>

        {error ? (
          <InlineAlert tone="error" className="mt-3">
            {error}
          </InlineAlert>
        ) : null}

        {loading ? (
          <p className="mt-3 text-sm text-amateur-muted">{t('app.states.loading')}</p>
        ) : history.length === 0 ? (
          <InlineAlert tone="info" className="mt-3">
            {t('pages.billing.history.empty')}
          </InlineAlert>
        ) : (
          <ol className="mt-4 space-y-3">
            {history.map((entry) => (
              <HistoryEntry key={entry.id} entry={entry} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function HistoryEntry({ entry }: { entry: TenantSubscriptionHistoryEntry }) {
  const { t } = useTranslation();
  const tone =
    entry.changeKind === 'created'
      ? 'success'
      : entry.changeKind === 'plan_change'
        ? 'info'
        : entry.changeKind === 'status_change'
          ? 'warning'
          : 'default';
  const fieldsLabel = entry.changedFields
    .map((field) => t(`pages.billing.history.fieldLabels.${field}`, field))
    .join(', ');
  return (
    <li className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display text-sm font-semibold text-amateur-ink">
            {t(`pages.billing.history.kind.${entry.changeKind}`)}
          </p>
          <p className="mt-1 text-xs text-amateur-muted">
            {formatDate(entry.changedAt)} ·{' '}
            {entry.actorDisplayName ?? t('pages.billing.history.actorFallback')}
          </p>
        </div>
        <StatusBadge tone={tone}>
          {t(`pages.billing.history.kind.${entry.changeKind}`)}
        </StatusBadge>
      </header>
      <div className="mt-3 grid gap-2 text-xs text-amateur-muted md:grid-cols-2">
        {entry.previousPlanCode || entry.nextPlanCode ? (
          <p>
            <span className="font-semibold text-amateur-ink">
              {t('pages.billing.history.fieldLabels.plan')}:
            </span>{' '}
            {t('pages.billing.history.delta.plan', {
              from: entry.previousPlanCode ?? '—',
              to: entry.nextPlanCode ?? '—',
            })}
          </p>
        ) : null}
        {entry.previousStatus || entry.nextStatus ? (
          <p>
            <span className="font-semibold text-amateur-ink">
              {t('pages.billing.history.fieldLabels.status')}:
            </span>{' '}
            {t('pages.billing.history.delta.status', {
              from: entry.previousStatus ?? '—',
              to: entry.nextStatus ?? '—',
            })}
          </p>
        ) : null}
      </div>
      {entry.changedFields.length > 0 ? (
        <p className="mt-2 text-xs text-amateur-muted">
          {t('pages.billing.history.fields', { fields: fieldsLabel })}
        </p>
      ) : null}
      {entry.statusReason ? (
        <p className="mt-2 text-xs text-amateur-muted">
          <span className="font-semibold text-amateur-ink">
            {t('pages.billing.history.fieldLabels.statusReason')}:
          </span>{' '}
          {entry.statusReason}
        </p>
      ) : null}
      {entry.internalNote ? (
        <p className="mt-1 text-xs text-amateur-muted">
          <span className="font-semibold text-amateur-ink">
            {t('pages.billing.history.fieldLabels.internalNotes')}:
          </span>{' '}
          {entry.internalNote}
        </p>
      ) : null}
    </li>
  );
}

type EntitlementEditorPanelProps = {
  plans: LicensePlanSummary[];
};

function EntitlementEditorPanel({ plans }: EntitlementEditorPanelProps) {
  const { t } = useTranslation();
  const [selectedPlanCode, setSelectedPlanCode] = useState<string | null>(
    plans[0]?.code ?? null,
  );
  const [editing, setEditing] = useState<PlanEditingPayload | null>(null);
  const [catalog, setCatalog] = useState<LicenseFeatureCatalogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFeature, setSavedFeature] = useState<string | null>(null);
  const [savingFeature, setSavingFeature] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedPlanCode && plans[0]?.code) {
      setSelectedPlanCode(plans[0].code);
    }
  }, [plans, selectedPlanCode]);

  const loadPlan = useCallback(
    async (code: string) => {
      setLoading(true);
      setError(null);
      try {
        const [planPayload, catalogPayload] = await Promise.all([
          apiGet<PlanEditingPayload>(`/api/admin/licensing/plans/${code}/edit`),
          apiGet<LicenseFeatureCatalogResponse>('/api/admin/licensing/feature-catalog'),
        ]);
        setEditing(planPayload);
        setCatalog(catalogPayload);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t('pages.billing.entitlementEditor.loadFailed'),
        );
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (selectedPlanCode) {
      void loadPlan(selectedPlanCode);
    }
  }, [loadPlan, selectedPlanCode]);

  const grouped = useMemo(() => {
    if (!editing) return [] as Array<{ group: string; rows: PlanEditingMatrixRow[] }>;
    const map = new Map<string, PlanEditingMatrixRow[]>();
    for (const row of editing.matrix) {
      const list = map.get(row.catalog.group) ?? [];
      list.push(row);
      map.set(row.catalog.group, list);
    }
    const groupOrder = catalog?.groups ?? [
      'parent_portal',
      'communications',
      'reporting',
      'operations',
      'onboarding',
    ];
    return groupOrder
      .filter((group) => map.has(group))
      .map((group) => ({ group, rows: map.get(group) ?? [] }));
  }, [editing, catalog]);

  async function saveRow(row: PlanEditingMatrixRow) {
    if (!selectedPlanCode) return;
    setSavingFeature(row.featureKey);
    setError(null);
    try {
      await apiPut(
        `/api/admin/licensing/plans/${selectedPlanCode}/entitlements/${encodeURIComponent(row.featureKey)}`,
        {
          enabled: row.enabled,
          limitValue: row.limitValue,
          notes: row.notes,
        },
      );
      setSavedFeature(row.featureKey);
      await loadPlan(selectedPlanCode);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('app.errors.saveFailed'),
      );
    } finally {
      setSavingFeature(null);
      setTimeout(() => setSavedFeature((current) => (current === row.featureKey ? null : current)), 1800);
    }
  }

  function updateRowDraft(featureKey: string, patch: Partial<PlanEditingMatrixRow>) {
    setEditing((current) => {
      if (!current) return current;
      return {
        ...current,
        matrix: current.matrix.map((row) =>
          row.featureKey === featureKey ? { ...row, ...patch } : row,
        ),
      };
    });
  }

  if (plans.length === 0) {
    return <InlineAlert tone="info">{t('pages.billing.plans.empty')}</InlineAlert>;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-amateur-ink">
              {t('pages.billing.entitlementEditor.title')}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-amateur-muted">
              {t('pages.billing.entitlementEditor.subtitle')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {plans.map((plan) => {
              const isActive = plan.code === selectedPlanCode;
              return (
                <button
                  key={plan.code}
                  type="button"
                  onClick={() => setSelectedPlanCode(plan.code)}
                  className={
                    isActive
                      ? 'rounded-xl bg-amateur-accent-soft px-3 py-2 text-sm font-semibold text-amateur-accent'
                      : 'rounded-xl border border-amateur-border px-3 py-2 text-sm text-amateur-muted hover:text-amateur-ink'
                  }
                >
                  {plan.name}
                </button>
              );
            })}
          </div>
        </header>

        {error ? (
          <InlineAlert tone="error" className="mt-3">
            {error}
          </InlineAlert>
        ) : null}

        {loading && !editing ? (
          <p className="mt-3 text-sm text-amateur-muted">{t('app.states.loading')}</p>
        ) : editing ? (
          <div className="mt-4 space-y-5">
            {grouped.map((group) => (
              <article
                key={group.group}
                className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4"
              >
                <header className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-semibold text-amateur-ink">
                    {t(`pages.billing.entitlementEditor.groups.${group.group}`)}
                  </h3>
                </header>
                <ul className="mt-3 space-y-3">
                  {group.rows.map((row) => {
                    const featureLabel = t(
                      `pages.billing.featureCatalog.${row.featureKey}`,
                      row.featureKey,
                    );
                    const isSaving = savingFeature === row.featureKey;
                    const justSaved = savedFeature === row.featureKey;
                    return (
                      <li
                        key={row.featureKey}
                        className="rounded-xl border border-amateur-border bg-amateur-surface p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-amateur-ink">
                              {featureLabel}
                            </p>
                            <p className="mt-0.5 text-[11px] uppercase tracking-wide text-amateur-muted">
                              {row.featureKey}
                            </p>
                            <p className="mt-1 text-xs text-amateur-muted">
                              {row.catalog.gatingActive
                                ? t('pages.billing.entitlementEditor.gatingActiveHint')
                                : t('pages.billing.entitlementEditor.gatingPassiveHint')}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge
                              tone={row.catalog.gatingActive ? 'success' : 'default'}
                            >
                              {row.catalog.gatingActive
                                ? t('pages.billing.entitlementEditor.gatingActiveChip')
                                : t('pages.billing.entitlementEditor.gatingPassiveChip')}
                            </StatusBadge>
                            {justSaved ? (
                              <StatusBadge tone="info">
                                {t('pages.billing.entitlementEditor.savedJustNow')}
                              </StatusBadge>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-3">
                          <label className="flex items-center gap-2 text-sm text-amateur-ink">
                            <input
                              type="checkbox"
                              checked={row.enabled}
                              onChange={(e) =>
                                updateRowDraft(row.featureKey, { enabled: e.target.checked })
                              }
                            />
                            {t('pages.billing.entitlementEditor.enabled')}
                          </label>
                          {row.catalog.supportsLimit ? (
                            <label className="flex flex-col gap-1 text-xs text-amateur-muted">
                              <span>{t('pages.billing.entitlementEditor.limit')}</span>
                              <input
                                type="number"
                                min={0}
                                value={row.limitValue ?? ''}
                                onChange={(e) =>
                                  updateRowDraft(row.featureKey, {
                                    limitValue: e.target.value
                                      ? Math.max(0, Number(e.target.value))
                                      : null,
                                  })
                                }
                                className="rounded-lg border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-ink"
                              />
                              <span className="text-[11px] text-amateur-muted">
                                {t('pages.billing.entitlementEditor.limitHint')}
                              </span>
                            </label>
                          ) : null}
                          <label className="flex flex-col gap-1 text-xs text-amateur-muted md:col-span-1">
                            <span>{t('pages.billing.entitlementEditor.notes')}</span>
                            <input
                              type="text"
                              value={row.notes ?? ''}
                              maxLength={240}
                              onChange={(e) =>
                                updateRowDraft(row.featureKey, { notes: e.target.value })
                              }
                              placeholder={t(
                                'pages.billing.entitlementEditor.notesPlaceholder',
                              )}
                              className="rounded-lg border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-ink"
                            />
                          </label>
                        </div>
                        <div className="mt-3 flex justify-end">
                          <Button
                            type="button"
                            variant="primary"
                            disabled={isSaving}
                            onClick={() => void saveRow(row)}
                          >
                            {isSaving
                              ? t('app.states.saving')
                              : t('pages.billing.entitlementEditor.save')}
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function FieldLabel({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={['flex flex-col gap-1 text-xs font-medium text-amateur-muted', className]
      .filter(Boolean)
      .join(' ')}
    >
      <span>{label}</span>
      {children}
    </label>
  );
}

function Snippet({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-amateur-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-amateur-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-amateur-muted">{hint}</p> : null}
    </div>
  );
}
