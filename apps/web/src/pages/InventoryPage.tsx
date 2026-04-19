import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { InlineAlert } from '../components/ui/InlineAlert';
import { ListPageFrame } from '../components/ui/ListPageFrame';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import { useTenant } from '../lib/tenant-hooks';
import type {
  Athlete,
  InventoryAssignmentSummary,
  InventoryCategory,
  InventoryItemDetailResponse,
  InventoryItemSummary,
  InventoryListResponse,
  InventoryMovementType,
  InventoryVariantSummary,
  SportBranch,
} from '../lib/domain-types';

type CategoryFilter = 'all' | InventoryCategory;

const CATEGORY_VALUES: InventoryCategory[] = ['apparel', 'balls', 'equipment', 'gear', 'other'];

type CreateVariantRow = {
  size: string;
  number: string;
  color: string;
  initialStock: string;
};

const emptyCreateVariant = (): CreateVariantRow => ({
  size: '',
  number: '',
  color: '',
  initialStock: '0',
});

type CreateForm = {
  name: string;
  category: InventoryCategory;
  sportBranchId: string;
  hasVariants: boolean;
  trackAssignment: boolean;
  lowStockThreshold: string;
  description: string;
  initialStock: string;
  variants: CreateVariantRow[];
};

const emptyCreateForm = (): CreateForm => ({
  name: '',
  category: 'equipment',
  sportBranchId: '',
  hasVariants: false,
  trackAssignment: false,
  lowStockThreshold: '0',
  description: '',
  initialStock: '0',
  variants: [emptyCreateVariant()],
});

function MovementBadge({ type }: { type: InventoryMovementType }) {
  const { t } = useTranslation();
  const tones: Record<InventoryMovementType, string> = {
    stock_added: 'bg-emerald-100 text-emerald-800',
    stock_removed: 'bg-amber-100 text-amber-800',
    stock_adjusted: 'bg-sky-100 text-sky-800',
    assigned: 'bg-indigo-100 text-indigo-800',
    returned: 'bg-slate-100 text-slate-800',
    retired: 'bg-rose-100 text-rose-800',
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tones[type]}`}>
      {t(`pages.inventory.movement.${type}`)}
    </span>
  );
}

function VariantLabel({ variant }: { variant: InventoryVariantSummary }) {
  const { t } = useTranslation();
  if (variant.isDefault && !variant.size && !variant.number && !variant.color) {
    return <span>{t('pages.inventory.defaultVariant')}</span>;
  }
  const parts: string[] = [];
  if (variant.size) parts.push(variant.size);
  if (variant.number) parts.push(`#${variant.number}`);
  if (variant.color) parts.push(variant.color);
  return <span>{parts.join(' · ')}</span>;
}

function StockTone({ summary }: { summary: InventoryVariantSummary }) {
  const { t } = useTranslation();
  if (summary.isOutOfStock) {
    return (
      <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
        {t('pages.inventory.outOfStock')}
      </span>
    );
  }
  if (summary.isLowStock) {
    return (
      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
        {t('pages.inventory.lowStock')}
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
      {t('pages.inventory.healthy')}
    </span>
  );
}

export function InventoryPage() {
  const { t } = useTranslation();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [data, setData] = useState<InventoryListResponse | null>(null);
  const [branches, setBranches] = useState<SportBranch[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreateForm);
  const [saving, setSaving] = useState(false);

  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InventoryItemDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [adjustingVariantId, setAdjustingVariantId] = useState<string | null>(null);
  const [adjustDelta, setAdjustDelta] = useState('1');
  const [adjustNote, setAdjustNote] = useState('');
  const [assignVariantId, setAssignVariantId] = useState('');
  const [assignAthleteId, setAssignAthleteId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assigning, setAssigning] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (q.trim()) params.set('q', q.trim());
      if (category !== 'all') params.set('category', category);
      if (showLowStockOnly) params.set('lowStockOnly', 'true');
      if (!showInactive) params.set('isActive', 'true');
      const [itemsRes, branchRes, athletesRes] = await Promise.all([
        apiGet<InventoryListResponse>(`/api/inventory/items?${params.toString()}`),
        apiGet<SportBranch[]>('/api/sport-branches'),
        apiGet<{ items: Athlete[] }>('/api/athletes?limit=200'),
      ]);
      setData(itemsRes);
      setBranches(branchRes);
      setAthletes(athletesRes.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [tenantId, q, category, showLowStockOnly, showInactive, t]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 150);
    return () => clearTimeout(id);
  }, [load]);

  const loadDetail = useCallback(
    async (itemId: string) => {
      setDetailLoading(true);
      setDetailError(null);
      try {
        const res = await apiGet<InventoryItemDetailResponse>(`/api/inventory/items/${itemId}`);
        setDetail(res);
        if (!assignVariantId && res.item.variants.length > 0) {
          setAssignVariantId(res.item.variants[0].id);
        }
      } catch (e) {
        setDetailError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
      } finally {
        setDetailLoading(false);
      }
    },
    [assignVariantId, t],
  );

  useEffect(() => {
    if (openItemId) void loadDetail(openItemId);
    else {
      setDetail(null);
      setAssignAthleteId('');
      setAssignVariantId('');
      setAssignNotes('');
      setAdjustingVariantId(null);
    }
  }, [openItemId, loadDetail]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!tenantId) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: createForm.name.trim(),
        category: createForm.category,
        sportBranchId: createForm.sportBranchId || null,
        hasVariants: createForm.hasVariants,
        trackAssignment: createForm.trackAssignment,
        lowStockThreshold: Number(createForm.lowStockThreshold) || 0,
        description: createForm.description || null,
        isActive: true,
      };
      if (createForm.hasVariants) {
        payload.variants = createForm.variants
          .filter((v) => v.size || v.number || v.color || Number(v.initialStock))
          .map((v) => ({
            size: v.size || null,
            number: v.number || null,
            color: v.color || null,
            initialStock: Number(v.initialStock) || 0,
          }));
      } else {
        payload.initialStock = Number(createForm.initialStock) || 0;
      }
      await apiPost<InventoryItemSummary>('/api/inventory/items', payload);
      setMessage(t('pages.inventory.created'));
      setShowCreate(false);
      setCreateForm(emptyCreateForm());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(item: InventoryItemSummary) {
    setError(null);
    try {
      await apiPatch(`/api/inventory/items/${item.id}`, { isActive: !item.isActive });
      setMessage(t('pages.inventory.updated'));
      await load();
      if (openItemId === item.id) await loadDetail(item.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    }
  }

  async function handleDeleteItem(item: InventoryItemSummary) {
    if (!confirm(t('pages.inventory.deleteConfirm', { name: item.name }))) return;
    setError(null);
    try {
      await apiDelete(`/api/inventory/items/${item.id}`);
      setMessage(t('pages.inventory.deleted'));
      if (openItemId === item.id) setOpenItemId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    }
  }

  async function handleAdjustStock(variantId: string) {
    setError(null);
    const delta = Number(adjustDelta);
    if (!Number.isFinite(delta) || delta === 0) {
      setError(t('pages.inventory.adjustDeltaInvalid'));
      return;
    }
    try {
      await apiPost(`/api/inventory/variants/${variantId}/stock-adjustments`, {
        delta,
        note: adjustNote || undefined,
      });
      setAdjustingVariantId(null);
      setAdjustDelta('1');
      setAdjustNote('');
      setMessage(t('pages.inventory.stockUpdated'));
      await load();
      if (openItemId) await loadDetail(openItemId);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    }
  }

  async function handleAssign(event: FormEvent) {
    event.preventDefault();
    if (!assignVariantId || !assignAthleteId) return;
    setAssigning(true);
    setError(null);
    try {
      await apiPost('/api/inventory/assignments', {
        inventoryVariantId: assignVariantId,
        athleteId: assignAthleteId,
        notes: assignNotes || undefined,
      });
      setMessage(t('pages.inventory.assigned'));
      setAssignNotes('');
      setAssignAthleteId('');
      await load();
      if (openItemId) await loadDetail(openItemId);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    } finally {
      setAssigning(false);
    }
  }

  async function handleReturn(assignment: InventoryAssignmentSummary) {
    setError(null);
    try {
      await apiPost(`/api/inventory/assignments/${assignment.id}/return`, {});
      setMessage(t('pages.inventory.returned'));
      await load();
      if (openItemId) await loadDetail(openItemId);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    }
  }

  const counts = data?.counts;

  const filteredItems = useMemo(() => data?.items ?? [], [data]);

  const branchMap = useMemo(
    () => new Map(branches.map((branch) => [branch.id, branch.name])),
    [branches],
  );

  return (
    <div>
      <PageHeader
        title={t('pages.inventory.title')}
        subtitle={t('pages.inventory.subtitle')}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setShowCreate(false);
                setOpenItemId(null);
                void load();
              }}
            >
              {t('app.actions.refresh')}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setShowCreate((current) => !current);
                if (showCreate) setCreateForm(emptyCreateForm());
              }}
            >
              {showCreate ? t('app.actions.cancel') : t('pages.inventory.newItem')}
            </Button>
          </div>
        }
      />
      {message ? (
        <InlineAlert tone="success" className="mb-3">
          {message}
        </InlineAlert>
      ) : null}
      {error ? (
        <InlineAlert tone="error" className="mb-3">
          {error}
        </InlineAlert>
      ) : null}

      {counts ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={t('pages.inventory.statActive')}
            value={counts.activeItems}
            helper={t('pages.inventory.statActiveHelper', { count: counts.inactiveItems })}
          />
          <StatCard
            label={t('pages.inventory.statLow')}
            value={counts.lowStockItems}
            tone={counts.lowStockItems > 0 ? 'danger' : 'default'}
            helper={t('pages.inventory.statLowHelper')}
          />
          <StatCard
            label={t('pages.inventory.statOut')}
            value={counts.outOfStockItems}
            tone={counts.outOfStockItems > 0 ? 'danger' : 'default'}
            helper={t('pages.inventory.statOutHelper')}
          />
          <StatCard
            label={t('pages.inventory.statAssigned')}
            value={counts.totalAssignments}
            helper={t('pages.inventory.statAssignedHelper')}
          />
        </div>
      ) : null}

      {showCreate ? (
        <form
          onSubmit={handleCreate}
          className="mb-6 rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm"
        >
          <p className="font-display text-lg font-semibold text-amateur-ink">
            {t('pages.inventory.newItem')}
          </p>
          <p className="mb-4 text-sm text-amateur-muted">{t('pages.inventory.newItemHint')}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pages.inventory.fieldName')}</span>
              <input
                required
                value={createForm.name}
                onChange={(e) => setCreateForm((c) => ({ ...c, name: e.target.value }))}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pages.inventory.fieldCategory')}</span>
              <select
                value={createForm.category}
                onChange={(e) =>
                  setCreateForm((c) => ({ ...c, category: e.target.value as InventoryCategory }))
                }
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              >
                {CATEGORY_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {t(`pages.inventory.category.${value}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pages.inventory.fieldBranch')}</span>
              <select
                value={createForm.sportBranchId}
                onChange={(e) => setCreateForm((c) => ({ ...c, sportBranchId: e.target.value }))}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              >
                <option value="">{t('pages.inventory.fieldBranchAny')}</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pages.inventory.fieldLowStockThreshold')}</span>
              <input
                type="number"
                min={0}
                value={createForm.lowStockThreshold}
                onChange={(e) =>
                  setCreateForm((c) => ({ ...c, lowStockThreshold: e.target.value }))
                }
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              />
            </label>
          </div>
          <label className="mt-4 flex flex-col gap-1 text-sm">
            <span>{t('pages.inventory.fieldDescription')}</span>
            <textarea
              rows={2}
              value={createForm.description}
              onChange={(e) => setCreateForm((c) => ({ ...c, description: e.target.value }))}
              className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
            />
          </label>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={createForm.hasVariants}
                onChange={(e) =>
                  setCreateForm((c) => ({ ...c, hasVariants: e.target.checked }))
                }
              />
              {t('pages.inventory.fieldHasVariants')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={createForm.trackAssignment}
                onChange={(e) =>
                  setCreateForm((c) => ({ ...c, trackAssignment: e.target.checked }))
                }
              />
              {t('pages.inventory.fieldTrackAssignment')}
            </label>
          </div>
          {createForm.hasVariants ? (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-amateur-ink">
                {t('pages.inventory.variantsHeader')}
              </p>
              <div className="space-y-2">
                {createForm.variants.map((variant, idx) => (
                  <div
                    key={idx}
                    className="grid gap-2 rounded-xl border border-amateur-border bg-amateur-canvas p-3 sm:grid-cols-5"
                  >
                    <input
                      placeholder={t('pages.inventory.fieldSize')}
                      value={variant.size}
                      onChange={(e) =>
                        setCreateForm((c) => ({
                          ...c,
                          variants: c.variants.map((v, i) =>
                            i === idx ? { ...v, size: e.target.value } : v,
                          ),
                        }))
                      }
                      className="rounded-lg border border-amateur-border bg-amateur-surface px-3 py-2 text-sm"
                    />
                    <input
                      placeholder={t('pages.inventory.fieldNumber')}
                      value={variant.number}
                      onChange={(e) =>
                        setCreateForm((c) => ({
                          ...c,
                          variants: c.variants.map((v, i) =>
                            i === idx ? { ...v, number: e.target.value } : v,
                          ),
                        }))
                      }
                      className="rounded-lg border border-amateur-border bg-amateur-surface px-3 py-2 text-sm"
                    />
                    <input
                      placeholder={t('pages.inventory.fieldColor')}
                      value={variant.color}
                      onChange={(e) =>
                        setCreateForm((c) => ({
                          ...c,
                          variants: c.variants.map((v, i) =>
                            i === idx ? { ...v, color: e.target.value } : v,
                          ),
                        }))
                      }
                      className="rounded-lg border border-amateur-border bg-amateur-surface px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      min={0}
                      placeholder={t('pages.inventory.fieldInitialStock')}
                      value={variant.initialStock}
                      onChange={(e) =>
                        setCreateForm((c) => ({
                          ...c,
                          variants: c.variants.map((v, i) =>
                            i === idx ? { ...v, initialStock: e.target.value } : v,
                          ),
                        }))
                      }
                      className="rounded-lg border border-amateur-border bg-amateur-surface px-3 py-2 text-sm"
                    />
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() =>
                        setCreateForm((c) => ({
                          ...c,
                          variants: c.variants.filter((_, i) => i !== idx),
                        }))
                      }
                    >
                      {t('pages.inventory.removeVariant')}
                    </Button>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() =>
                    setCreateForm((c) => ({ ...c, variants: [...c.variants, emptyCreateVariant()] }))
                  }
                >
                  {t('pages.inventory.addVariant')}
                </Button>
              </div>
            </div>
          ) : (
            <label className="mt-4 flex flex-col gap-1 text-sm sm:max-w-xs">
              <span>{t('pages.inventory.fieldInitialStock')}</span>
              <input
                type="number"
                min={0}
                value={createForm.initialStock}
                onChange={(e) => setCreateForm((c) => ({ ...c, initialStock: e.target.value }))}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              />
            </label>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? t('app.states.saving') : t('app.actions.save')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowCreate(false);
                setCreateForm(emptyCreateForm());
              }}
            >
              {t('app.actions.cancel')}
            </Button>
          </div>
        </form>
      ) : null}

      <ListPageFrame
        search={{
          value: q,
          onChange: setQ,
          placeholder: t('pages.inventory.searchPlaceholder'),
          disabled: !tenantId || tenantLoading,
        }}
        toolbar={
          <>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryFilter)}
              className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm"
            >
              <option value="all">{t('pages.inventory.filterAllCategories')}</option>
              {CATEGORY_VALUES.map((value) => (
                <option key={value} value={value}>
                  {t(`pages.inventory.category.${value}`)}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showLowStockOnly}
                onChange={(e) => setShowLowStockOnly(e.target.checked)}
              />
              {t('pages.inventory.filterLowOnly')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              {t('pages.inventory.filterIncludeInactive')}
            </label>
          </>
        }
      >
        {!tenantId && !tenantLoading ? (
          <p className="text-sm text-amateur-muted">{t('app.errors.needTenant')}</p>
        ) : loading ? (
          <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>
        ) : filteredItems.length === 0 ? (
          <EmptyState title={t('pages.inventory.emptyTitle')} hint={t('pages.inventory.emptyHint')} />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {filteredItems.map((item) => {
              const isOpen = openItemId === item.id;
              return (
                <li
                  key={item.id}
                  className={`rounded-2xl border bg-amateur-surface p-4 shadow-sm transition-colors ${
                    isOpen ? 'border-amateur-accent' : 'border-amateur-border'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-base font-semibold text-amateur-ink">
                        {item.name}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-wide text-amateur-muted">
                        {t(`pages.inventory.category.${item.category}`)}
                        {item.sportBranchId
                          ? ` · ${branchMap.get(item.sportBranchId) ?? ''}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!item.isActive ? (
                        <span className="inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {t('pages.inventory.inactive')}
                        </span>
                      ) : null}
                      {item.lowStockVariantCount > 0 ? (
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          {t('pages.inventory.lowStockBadge', { count: item.lowStockVariantCount })}
                        </span>
                      ) : null}
                      {item.outOfStockVariantCount > 0 ? (
                        <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">
                          {t('pages.inventory.outOfStockBadge', {
                            count: item.outOfStockVariantCount,
                          })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded-xl bg-amateur-canvas p-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-amateur-muted">
                        {t('pages.inventory.statTotal')}
                      </p>
                      <p className="mt-1 font-semibold text-amateur-ink">{item.totalStock}</p>
                    </div>
                    <div className="rounded-xl bg-amateur-canvas p-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-amateur-muted">
                        {t('pages.inventory.statAvailable')}
                      </p>
                      <p className="mt-1 font-semibold text-amateur-ink">{item.totalAvailable}</p>
                    </div>
                    <div className="rounded-xl bg-amateur-canvas p-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-amateur-muted">
                        {t('pages.inventory.statAssignedShort')}
                      </p>
                      <p className="mt-1 font-semibold text-amateur-ink">{item.totalAssigned}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant={isOpen ? 'ghost' : 'primary'}
                      onClick={() => setOpenItemId(isOpen ? null : item.id)}
                    >
                      {isOpen ? t('pages.inventory.close') : t('pages.inventory.open')}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => handleToggleActive(item)}>
                      {item.isActive ? t('pages.inventory.markInactive') : t('pages.inventory.markActive')}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => handleDeleteItem(item)}>
                      {t('pages.inventory.delete')}
                    </Button>
                  </div>
                  {isOpen ? (
                    <div className="mt-4 border-t border-amateur-border pt-4">
                      {detailLoading ? (
                        <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>
                      ) : detailError ? (
                        <InlineAlert tone="error">{detailError}</InlineAlert>
                      ) : detail && detail.item.id === item.id ? (
                        <DetailPanel
                          detail={detail}
                          athletes={athletes}
                          assignVariantId={assignVariantId}
                          setAssignVariantId={setAssignVariantId}
                          assignAthleteId={assignAthleteId}
                          setAssignAthleteId={setAssignAthleteId}
                          assignNotes={assignNotes}
                          setAssignNotes={setAssignNotes}
                          assigning={assigning}
                          onAssign={handleAssign}
                          onReturn={handleReturn}
                          adjustingVariantId={adjustingVariantId}
                          setAdjustingVariantId={setAdjustingVariantId}
                          adjustDelta={adjustDelta}
                          setAdjustDelta={setAdjustDelta}
                          adjustNote={adjustNote}
                          setAdjustNote={setAdjustNote}
                          onAdjust={handleAdjustStock}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </ListPageFrame>
    </div>
  );
}

type DetailPanelProps = {
  detail: InventoryItemDetailResponse;
  athletes: Athlete[];
  assignVariantId: string;
  setAssignVariantId: (value: string) => void;
  assignAthleteId: string;
  setAssignAthleteId: (value: string) => void;
  assignNotes: string;
  setAssignNotes: (value: string) => void;
  assigning: boolean;
  onAssign: (event: FormEvent) => void;
  onReturn: (assignment: InventoryAssignmentSummary) => void;
  adjustingVariantId: string | null;
  setAdjustingVariantId: (value: string | null) => void;
  adjustDelta: string;
  setAdjustDelta: (value: string) => void;
  adjustNote: string;
  setAdjustNote: (value: string) => void;
  onAdjust: (variantId: string) => void;
};

function DetailPanel({
  detail,
  athletes,
  assignVariantId,
  setAssignVariantId,
  assignAthleteId,
  setAssignAthleteId,
  assignNotes,
  setAssignNotes,
  assigning,
  onAssign,
  onReturn,
  adjustingVariantId,
  setAdjustingVariantId,
  adjustDelta,
  setAdjustDelta,
  adjustNote,
  setAdjustNote,
  onAdjust,
}: DetailPanelProps) {
  const { t, i18n } = useTranslation();
  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [i18n.language],
  );
  return (
    <div className="space-y-5">
      {detail.item.description ? (
        <p className="text-sm text-amateur-muted">{detail.item.description}</p>
      ) : null}
      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amateur-muted">
          {t('pages.inventory.variantsHeader')}
        </p>
        <div className="space-y-2">
          {detail.item.variants.map((variant) => (
            <div
              key={variant.id}
              className="rounded-xl border border-amateur-border bg-amateur-canvas p-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-amateur-ink">
                    <VariantLabel variant={variant} />
                  </p>
                  <p className="mt-0.5 text-xs text-amateur-muted">
                    {t('pages.inventory.variantStockSummary', {
                      stock: variant.stockOnHand,
                      assigned: variant.assignedCount,
                      available: variant.available,
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StockTone summary={variant} />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setAdjustingVariantId(
                        adjustingVariantId === variant.id ? null : variant.id,
                      )
                    }
                  >
                    {adjustingVariantId === variant.id
                      ? t('app.actions.cancel')
                      : t('pages.inventory.adjustStock')}
                  </Button>
                </div>
              </div>
              {adjustingVariantId === variant.id ? (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-1 text-xs">
                    <span>{t('pages.inventory.adjustDelta')}</span>
                    <input
                      type="number"
                      value={adjustDelta}
                      onChange={(e) => setAdjustDelta(e.target.value)}
                      className="w-24 rounded-lg border border-amateur-border bg-amateur-surface px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="flex flex-1 flex-col gap-1 text-xs">
                    <span>{t('pages.inventory.adjustNote')}</span>
                    <input
                      value={adjustNote}
                      onChange={(e) => setAdjustNote(e.target.value)}
                      className="rounded-lg border border-amateur-border bg-amateur-surface px-2 py-1 text-sm"
                    />
                  </label>
                  <Button type="button" onClick={() => onAdjust(variant.id)}>
                    {t('app.actions.apply')}
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amateur-muted">
          {t('pages.inventory.assignTitle')}
        </p>
        <form onSubmit={onAssign} className="grid gap-2 sm:grid-cols-3">
          <select
            value={assignVariantId}
            onChange={(e) => setAssignVariantId(e.target.value)}
            className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm"
          >
            {detail.item.variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.isDefault && !variant.size && !variant.number && !variant.color
                  ? t('pages.inventory.defaultVariant')
                  : [variant.size, variant.number ? `#${variant.number}` : null, variant.color]
                      .filter(Boolean)
                      .join(' · ')}
                {variant.available > 0
                  ? ` · ${t('pages.inventory.assignAvailable', { count: variant.available })}`
                  : ` · ${t('pages.inventory.outOfStock')}`}
              </option>
            ))}
          </select>
          <select
            value={assignAthleteId}
            onChange={(e) => setAssignAthleteId(e.target.value)}
            className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm"
          >
            <option value="">{t('pages.inventory.assignChooseAthlete')}</option>
            {athletes.map((athlete) => (
              <option key={athlete.id} value={athlete.id}>
                {athlete.lastName}, {athlete.firstName}
              </option>
            ))}
          </select>
          <input
            placeholder={t('pages.inventory.assignNote')}
            value={assignNotes}
            onChange={(e) => setAssignNotes(e.target.value)}
            className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm"
          />
          <div className="sm:col-span-3">
            <Button type="submit" disabled={assigning || !assignAthleteId || !assignVariantId}>
              {assigning ? t('app.states.saving') : t('pages.inventory.assignButton')}
            </Button>
          </div>
        </form>
      </section>

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amateur-muted">
          {t('pages.inventory.activeAssignments')}
        </p>
        {detail.activeAssignments.length === 0 ? (
          <p className="text-sm text-amateur-muted">{t('pages.inventory.noActiveAssignments')}</p>
        ) : (
          <ul className="space-y-2">
            {detail.activeAssignments.map((assignment) => (
              <li
                key={assignment.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amateur-border bg-amateur-canvas p-3 text-sm"
              >
                <div>
                  <p className="font-medium text-amateur-ink">{assignment.athleteName}</p>
                  <p className="text-xs text-amateur-muted">
                    {assignment.variantLabel} · {dateFmt.format(new Date(assignment.assignedAt))}
                    {assignment.quantity > 1 ? ` · ×${assignment.quantity}` : ''}
                  </p>
                </div>
                <Button type="button" variant="ghost" onClick={() => onReturn(assignment)}>
                  {t('pages.inventory.returnButton')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amateur-muted">
          {t('pages.inventory.recentMovements')}
        </p>
        {detail.recentMovements.length === 0 ? (
          <p className="text-sm text-amateur-muted">{t('pages.inventory.noMovements')}</p>
        ) : (
          <ul className="space-y-2">
            {detail.recentMovements.slice(0, 12).map((movement) => (
              <li
                key={movement.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amateur-border bg-amateur-canvas p-3 text-sm"
              >
                <div>
                  <p className="font-medium text-amateur-ink">{movement.variantLabel}</p>
                  <p className="text-xs text-amateur-muted">
                    {dateFmt.format(new Date(movement.createdAt))}
                    {movement.athleteName ? ` · ${movement.athleteName}` : ''}
                    {movement.note ? ` · ${movement.note}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <MovementBadge type={movement.type as InventoryMovementType} />
                  <span
                    className={`text-sm font-semibold ${
                      movement.quantity >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
