import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { InlineAlert } from '../components/ui/InlineAlert';
import { ListPageFrame } from '../components/ui/ListPageFrame';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { apiGet, apiPatch } from '../lib/api';
import {
  formatDateTime,
  getActionCenterCategoryLabel,
  getActionCenterItemTitle,
  getActionCenterItemSummary,
  getActionCenterTypeLabel,
  getActionCenterMutationLabel,
  getActionCenterUrgencyLabel,
  getActionCenterUrgencyTone,
} from '../lib/display';
import type {
  ActionCenterItem,
  ActionCenterItemGroup,
  ActionCenterItemCategory,
  ActionCenterItemMutation,
  ActionCenterItemUrgency,
  ActionCenterResponse,
} from '../lib/domain-types';
import { useTenant } from '../lib/tenant-hooks';

const categories: Array<ActionCenterItemCategory | ''> = ['', 'finance', 'family', 'readiness', 'private_lessons', 'training'];
const urgencies: Array<ActionCenterItemUrgency | ''> = ['', 'overdue', 'today', 'upcoming', 'normal'];
const bulkActions: ActionCenterItemMutation[] = ['mark_read', 'dismiss', 'complete'];
const categoryPriority: ActionCenterItemCategory[] = ['finance', 'family', 'readiness', 'training', 'private_lessons'];

export function ActionCenterPage() {
  const { t } = useTranslation();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const [category, setCategory] = useState<ActionCenterItemCategory | ''>(
    (searchParams.get('category') as ActionCenterItemCategory | null) ?? '',
  );
  const [urgency, setUrgency] = useState<ActionCenterItemUrgency | ''>(
    (searchParams.get('urgency') as ActionCenterItemUrgency | null) ?? '',
  );
  const [showRead, setShowRead] = useState(searchParams.get('showRead') === 'true');
  const [response, setResponse] = useState<ActionCenterResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  useEffect(() => {
    setCategory((searchParams.get('category') as ActionCenterItemCategory | null) ?? '');
    setUrgency((searchParams.get('urgency') as ActionCenterItemUrgency | null) ?? '');
    setShowRead(searchParams.get('showRead') === 'true');
  }, [searchParams]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (category) next.set('category', category);
    if (urgency) next.set('urgency', urgency);
    if (showRead) next.set('showRead', 'true');
    setSearchParams(next, { replace: true });
  }, [category, urgency, showRead, setSearchParams]);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ view: 'queue', limit: '100' });
      if (category) params.set('category', category);
      if (urgency) params.set('urgency', urgency);
      if (showRead) params.set('includeRead', 'true');
      const next = await apiGet<ActionCenterResponse>(`/api/action-center/items?${params.toString()}`);
      setResponse(next);
      setSelectedKeys((current) => current.filter((key) => next.items.some((item) => item.itemKey === key)));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [category, showRead, t, tenantId, urgency]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 200);
    return () => clearTimeout(id);
  }, [load]);

  const visibleItems = useMemo(() => response?.items ?? [], [response]);
  const groupedItems = useMemo(() => {
    const sourceGroups = response?.groups ?? [];
    if (sourceGroups.length > 0) {
      return sourceGroups.filter((group) => group.items.length > 0);
    }
    return categoryPriority
      .map((groupCategory) => ({
        category: groupCategory,
        count: visibleItems.filter((item) => item.category === groupCategory).length,
        unread: visibleItems.filter((item) => item.category === groupCategory && !item.read).length,
        overdue: visibleItems.filter((item) => item.category === groupCategory && item.urgency === 'overdue').length,
        today: visibleItems.filter((item) => item.category === groupCategory && item.urgency === 'today').length,
        items: visibleItems.filter((item) => item.category === groupCategory),
      }))
      .filter((group) => group.items.length > 0);
  }, [response, visibleItems]);
  const selectedItems = useMemo(
    () => visibleItems.filter((item) => selectedKeys.includes(item.itemKey)),
    [selectedKeys, visibleItems],
  );
  const hasActiveFilters = Boolean(category || urgency || showRead);

  function toggleSelected(itemKey: string) {
    setSelectedKeys((current) =>
      current.includes(itemKey) ? current.filter((value) => value !== itemKey) : [...current, itemKey],
    );
  }

  async function runBulkAction(action: ActionCenterItemMutation) {
    if (selectedKeys.length === 0) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiPatch<{ updatedCount: number }>('/api/action-center/items', {
        itemKeys: selectedKeys,
        action,
      });
      setMessage(
        t('pages.actionCenter.bulkSuccess', {
          count: result.updatedCount,
          action: getActionCenterMutationLabel(t, action),
        }),
      );
      setSelectedKeys([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={t('pages.actionCenter.title')}
        subtitle={t('pages.actionCenter.subtitle')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={() => void load()}>
              {t('app.actions.refresh')}
            </Button>
            <Link to="/app/communications?needsFollowUp=true&channel=whatsapp&template=family_follow_up&source=action_center">
              <Button variant="ghost">{t('pages.actionCenter.openCommunications')}</Button>
            </Link>
          </div>
        }
      />

      {message ? <InlineAlert tone="success" className="mb-4">{message}</InlineAlert> : null}
      {error ? <InlineAlert tone="error" className="mb-4">{error}</InlineAlert> : null}

      {response ? (
        <div className="mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label={t('pages.actionCenter.summary.total')} value={response.counts.total} compact />
          <StatCard
            label={t('pages.actionCenter.summary.unread')}
            value={response.counts.unread}
            compact
            tone={response.counts.unread > 0 ? 'danger' : 'default'}
          />
          <StatCard
            label={t('pages.actionCenter.summary.overdue')}
            value={response.counts.overdue}
            compact
            tone={response.counts.overdue > 0 ? 'danger' : 'default'}
          />
          <StatCard
            label={t('pages.actionCenter.summary.today')}
            value={response.counts.today}
            compact
            tone={response.counts.today > 0 ? 'danger' : 'default'}
          />
          <StatCard
            label={t('pages.actionCenter.summary.followUp')}
            value={
              response.counts.byCategory.family +
              response.counts.byCategory.finance +
              response.counts.byCategory.readiness
            }
            compact
          />
        </div>
      ) : null}

      <ListPageFrame
        toolbarLabel={t('app.actions.filter')}
        toolbar={
          <>
            <label className="flex min-w-0 items-center gap-2 rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-muted">
              <span>{t('pages.actionCenter.filterCategory')}</span>
              <select
                value={category}
                onChange={(e) => setCategory((e.target.value as ActionCenterItemCategory) || '')}
                className="min-w-0 flex-1 bg-transparent text-amateur-ink outline-none"
              >
                {categories.map((value) => (
                  <option key={value || 'all'} value={value}>
                    {value ? getActionCenterCategoryLabel(t, value) : t('pages.actionCenter.allCategories')}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 items-center gap-2 rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-muted">
              <span>{t('pages.actionCenter.filterUrgency')}</span>
              <select
                value={urgency}
                onChange={(e) => setUrgency((e.target.value as ActionCenterItemUrgency) || '')}
                className="min-w-0 flex-1 bg-transparent text-amateur-ink outline-none"
              >
                {urgencies.map((value) => (
                  <option key={value || 'all'} value={value}>
                    {value ? getActionCenterUrgencyLabel(t, value) : t('pages.actionCenter.allUrgencies')}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-muted">
              <input type="checkbox" checked={showRead} onChange={(e) => setShowRead(e.target.checked)} />
              <span>{t('pages.actionCenter.showRead')}</span>
            </label>
            <Button
              type="button"
              variant="ghost"
              className="justify-center"
              onClick={() => {
                setCategory('');
                setUrgency('');
                setShowRead(false);
              }}
            >
              {t('app.actions.clear')}
            </Button>
          </>
        }
      >
        {!tenantId && !tenantLoading ? (
          <p className="text-sm text-amateur-muted">{t('app.errors.needTenant')}</p>
        ) : loading && !response ? (
          <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>
        ) : !response || visibleItems.length === 0 ? (
          <EmptyState
            title={t('pages.actionCenter.empty')}
            hint={hasActiveFilters ? t('pages.actionCenter.emptyFilteredHint') : t('pages.actionCenter.emptyHint')}
          />
        ) : (
          <div className="space-y-6">
            <section className="rounded-3xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amateur-accent">
                    {t('pages.actionCenter.workQueueEyebrow')}
                  </p>
                  <h2 className="mt-2 font-display text-xl font-semibold text-amateur-ink">
                    {t('pages.actionCenter.workQueueTitle')}
                  </h2>
                  <p className="mt-2 max-w-3xl text-sm text-amateur-muted">
                    {t('pages.actionCenter.workQueueHint')}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-3 text-sm">
                    <p className="text-xs uppercase tracking-wide text-amateur-muted">
                      {t('pages.actionCenter.summary.overdue')}
                    </p>
                    <p className="mt-2 font-display text-2xl font-semibold text-red-700">
                      {response.counts.overdue}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-3 text-sm">
                    <p className="text-xs uppercase tracking-wide text-amateur-muted">
                      {t('pages.actionCenter.summary.today')}
                    </p>
                    <p className="mt-2 font-display text-2xl font-semibold text-amateur-ink">
                      {response.counts.today}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-3 text-sm">
                    <p className="text-xs uppercase tracking-wide text-amateur-muted">
                      {t('pages.actionCenter.summary.unread')}
                    </p>
                    <p className="mt-2 font-display text-2xl font-semibold text-amateur-ink">
                      {response.counts.unread}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-amateur-ink">
                    {t('pages.actionCenter.bulkTitle')}
                  </h2>
                  <p className="mt-1 text-sm text-amateur-muted">{t('pages.actionCenter.bulkHint')}</p>
                </div>
                <div className="rounded-xl border border-dashed border-amateur-border px-3 py-2 text-sm text-amateur-muted">
                  {t('pages.actionCenter.selectedCount', { count: selectedItems.length })}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {bulkActions.map((action) => (
                  <Button
                    key={action}
                    type="button"
                    variant={action === 'mark_read' ? 'ghost' : 'primary'}
                    onClick={() => void runBulkAction(action)}
                    disabled={selectedItems.length === 0 || saving}
                  >
                    {getActionCenterMutationLabel(t, action)}
                  </Button>
                ))}
              </div>
            </section>

            <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-5">
              {groupedItems.map((group) => (
                <CategorySummaryCard key={group.category} group={group} />
              ))}
            </section>

            <div className="space-y-6">
              {groupedItems.map((group) => (
                <section key={group.category} className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone="default">{getActionCenterCategoryLabel(t, group.category)}</StatusBadge>
                        {group.unread > 0 ? (
                          <StatusBadge tone="warning">
                            {t('pages.actionCenter.groupUnread', { count: group.unread })}
                          </StatusBadge>
                        ) : null}
                        {group.overdue > 0 ? (
                          <StatusBadge tone="danger">
                            {t('pages.actionCenter.groupOverdue', { count: group.overdue })}
                          </StatusBadge>
                        ) : null}
                      </div>
                      <h2 className="mt-3 font-display text-lg font-semibold text-amateur-ink">
                        {getActionCenterCategoryLabel(t, group.category)}
                      </h2>
                      <p className="mt-1 text-sm text-amateur-muted">
                        {t('pages.actionCenter.groupSummary', { count: group.count })}
                      </p>
                    </div>
                    <div className="rounded-xl border border-dashed border-amateur-border px-3 py-2 text-sm text-amateur-muted">
                      {t('pages.actionCenter.groupSelectedCount', {
                        count: group.items.filter((item) => selectedKeys.includes(item.itemKey)).length,
                      })}
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {group.items.map((item) => (
                      <ActionCenterRow
                        key={item.itemKey}
                        item={item}
                        selected={selectedKeys.includes(item.itemKey)}
                        onToggleSelected={() => toggleSelected(item.itemKey)}
                        onRefresh={load}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}
      </ListPageFrame>
    </div>
  );
}

type ActionCenterRowProps = {
  item: ActionCenterItem;
  selected: boolean;
  onToggleSelected: () => void;
  onRefresh: () => Promise<void>;
};

function CategorySummaryCard({ group }: { group: ActionCenterItemGroup }) {
  const { t } = useTranslation();

  return (
    <div className="rounded-2xl border border-amateur-border bg-amateur-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amateur-muted">
            {getActionCenterCategoryLabel(t, group.category)}
          </p>
          <p className="mt-2 font-display text-2xl font-semibold text-amateur-ink">{group.count}</p>
        </div>
        <StatusBadge tone={group.overdue > 0 ? 'danger' : group.unread > 0 ? 'warning' : 'success'}>
          {group.overdue > 0
            ? t('pages.actionCenter.groupStatusOverdue')
            : group.unread > 0
              ? t('pages.actionCenter.groupStatusUnread')
              : t('pages.actionCenter.groupStatusStable')}
        </StatusBadge>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-amateur-muted">
        <span>{t('pages.actionCenter.groupUnread', { count: group.unread })}</span>
        <span>·</span>
        <span>{t('pages.actionCenter.groupOverdue', { count: group.overdue })}</span>
      </div>
    </div>
  );
}

function ActionCenterRow({ item, selected, onToggleSelected, onRefresh }: ActionCenterRowProps) {
  const { t, i18n } = useTranslation();
  const [saving, setSaving] = useState(false);

  async function mutate(action: ActionCenterItemMutation, snoozedUntil?: string) {
    setSaving(true);
    try {
      await apiPatch('/api/action-center/items', {
        itemKeys: [item.itemKey],
        action,
        snoozedUntil,
      });
      await onRefresh();
    } finally {
      setSaving(false);
    }
  }

  const snoozeUntil = useMemo(() => {
    const next = new Date();
    next.setHours(next.getHours() + 24);
    return next.toISOString();
  }, []);

  return (
    <article className="rounded-2xl border border-amateur-border bg-amateur-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-start gap-3">
        <input type="checkbox" checked={selected} onChange={onToggleSelected} className="mt-1" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={getActionCenterUrgencyTone(item.urgency)}>
                  {getActionCenterUrgencyLabel(t, item.urgency)}
                </StatusBadge>
                <StatusBadge tone={item.read ? 'default' : 'warning'}>
                  {item.read ? t('pages.actionCenter.readState') : t('pages.actionCenter.unreadState')}
                </StatusBadge>
                <StatusBadge tone="default">{getActionCenterCategoryLabel(t, item.category)}</StatusBadge>
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold text-amateur-ink">
                {getActionCenterItemTitle(t, item)}
              </h3>
              <p className="mt-1 text-sm text-amateur-muted">
                {[getActionCenterTypeLabel(t, item.type), item.relatedName].filter(Boolean).join(' · ')}
              </p>
              <p className="mt-2 text-sm text-amateur-ink">
                {getActionCenterItemSummary(t, item)}
              </p>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-amateur-muted">
                {item.dueAt ? (
                  <span>{t('pages.actionCenter.dueAt')}: {formatDateTime(item.dueAt, i18n.language)}</span>
                ) : null}
                {item.amount ? (
                  <span>{t('pages.actionCenter.amount')}: {item.currency ? `${item.currency} ` : ''}{item.amount}</span>
                ) : null}
                <span>{t('pages.actionCenter.issueCount')}: {item.count}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link to={item.deepLink}>
                <Button variant="ghost">{t('pages.actionCenter.openItem')}</Button>
              </Link>
              {item.communicationLink ? (
                <Link to={item.communicationLink}>
                  <Button variant="ghost">{t('pages.actionCenter.openCommunication')}</Button>
                </Link>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {!item.read ? (
              <Button type="button" variant="ghost" onClick={() => void mutate('mark_read')} disabled={saving}>
                {getActionCenterMutationLabel(t, 'mark_read')}
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={() => void mutate('mark_unread')} disabled={saving}>
                {getActionCenterMutationLabel(t, 'mark_unread')}
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => void mutate('snooze', snoozeUntil)} disabled={saving}>
              {getActionCenterMutationLabel(t, 'snooze')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => void mutate('dismiss')} disabled={saving}>
              {getActionCenterMutationLabel(t, 'dismiss')}
            </Button>
            <Button type="button" onClick={() => void mutate('complete')} disabled={saving}>
              {getActionCenterMutationLabel(t, 'complete')}
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
