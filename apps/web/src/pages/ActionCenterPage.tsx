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
                <div className="max-w-3xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amateur-accent">
                    {t('pages.actionCenter.workQueueEyebrow')}
                  </p>
                  <h2 className="mt-2 font-display text-xl font-semibold text-amateur-ink">
                    {t('pages.actionCenter.workQueueTitle')}
                  </h2>
                  <p className="mt-2 text-sm text-amateur-muted">
                    {t('pages.actionCenter.workQueueHint')}
                  </p>
                </div>
                <div className="rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-3 text-sm text-amateur-muted">
                  {t('pages.actionCenter.selectedCount', { count: selectedItems.length })}
                </div>
              </div>
            </section>

            {selectedItems.length > 0 ? (
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
                  <Button type="button" onClick={() => void runBulkAction('complete')} disabled={saving}>
                    {getActionCenterMutationLabel(t, 'complete')}
                  </Button>
                  <details className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2">
                    <summary className="cursor-pointer text-sm font-semibold text-amateur-ink">
                      {t('app.actions.more')}
                    </summary>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {bulkActions
                        .filter((action) => action !== 'complete')
                        .map((action) => (
                          <Button
                            key={action}
                            type="button"
                            variant="ghost"
                            onClick={() => void runBulkAction(action)}
                            disabled={saving}
                          >
                            {getActionCenterMutationLabel(t, action)}
                          </Button>
                        ))}
                    </div>
                  </details>
                </div>
              </section>
            ) : null}

            <div className="space-y-6">
              {groupedItems.map((group) => (
                <section key={group.category} className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
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
                      <h2 className="mt-1 font-display text-lg font-semibold text-amateur-ink">
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

function ActionCenterRow({ item, selected, onToggleSelected, onRefresh }: ActionCenterRowProps) {
  const { t, i18n } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  // Per-row error surfacing. Previously row-level mutations swallowed
  // failures inside `try { ... } finally { setSaving(false); }`, so when
  // an action like Resolve / Snooze / Dismiss / Mark read failed against
  // the API (network, validation, lost session), the row reverted to the
  // idle state and silently looked successful until the next manual
  // refresh. That eroded trust in the work queue. We now keep the
  // failure visible at the row until the user retries or the next
  // refresh succeeds.
  const [rowError, setRowError] = useState<string | null>(null);

  async function mutate(action: ActionCenterItemMutation, snoozedUntil?: string) {
    setSaving(true);
    setRowError(null);
    try {
      await apiPatch('/api/action-center/items', {
        itemKeys: [item.itemKey],
        action,
        snoozedUntil,
      });
      await onRefresh();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : t('app.errors.saveFailed'));
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
        <input type="checkbox" checked={selected} onChange={onToggleSelected} className="mt-1 h-5 w-5" aria-label={t('pages.actionCenter.selectItemAria')} />
        <div className="min-w-0 flex-1">
          {/* Header: badges + title block. Previously the "Open item"
              button hung off the top-right which on mobile collapsed
              into a separate squashed line. We now keep the entire
              header content as a single flowing block; the row's main
              actions (Resolve / Open / More) live in a dedicated
              action row below where the primary action is full-width
              on mobile and inline on tablet+. */}
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={getActionCenterUrgencyTone(item.urgency)}>
              {getActionCenterUrgencyLabel(t, item.urgency)}
            </StatusBadge>
            {!item.read ? (
              <StatusBadge tone="warning">{t('pages.actionCenter.unreadState')}</StatusBadge>
            ) : null}
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
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-amateur-muted">
            {item.dueAt ? (
              <span>{t('pages.actionCenter.dueAt')}: {formatDateTime(item.dueAt, i18n.language)}</span>
            ) : null}
            {item.amount ? (
              <span>{t('pages.actionCenter.amount')}: {item.currency ? `${item.currency} ` : ''}{item.amount}</span>
            ) : null}
            <span>{t('pages.actionCenter.issueCount')}: {item.count}</span>
          </div>

          {/* Primary action row. On mobile the Resolve button is
              full-width so it's the obvious thumb target; on sm+
              everything sits inline. The "Open item" deep-link is
              kept as a calmer secondary action so the row has one
              clear primary CTA. */}
          <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Button
              type="button"
              onClick={() => void mutate('complete')}
              disabled={saving}
              className="w-full justify-center sm:w-auto"
            >
              {getActionCenterMutationLabel(t, 'complete')}
            </Button>
            <Link to={item.deepLink} className="w-full sm:w-auto">
              <Button variant="ghost" className="w-full justify-center sm:w-auto">
                {t('pages.actionCenter.openItem')}
              </Button>
            </Link>
            {item.communicationLink ? (
              <Link to={item.communicationLink} className="w-full sm:w-auto">
                <Button variant="ghost" className="w-full justify-center sm:w-auto">
                  {t('pages.actionCenter.openCommunication')}
                </Button>
              </Link>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowMoreActions((value) => !value)}
              className="w-full justify-center sm:w-auto"
            >
              {showMoreActions ? t('app.actions.hide') : t('app.actions.more')}
            </Button>
          </div>
          {showMoreActions ? (
            <div className="mt-3 flex flex-wrap gap-2 rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-3">
              {!item.read ? (
                <Button type="button" variant="ghost" onClick={() => void mutate('mark_read')} disabled={saving}>
                  {getActionCenterMutationLabel(t, 'mark_read')}
                </Button>
              ) : (
                <Button type="button" variant="ghost" onClick={() => void mutate('mark_unread')} disabled={saving}>
                  {getActionCenterMutationLabel(t, 'mark_unread')}
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => void mutate('snooze', snoozeUntil)}
                disabled={saving}
              >
                {getActionCenterMutationLabel(t, 'snooze')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => void mutate('dismiss')} disabled={saving}>
                {getActionCenterMutationLabel(t, 'dismiss')}
              </Button>
            </div>
          ) : null}
          {rowError ? (
            <InlineAlert tone="error" className="mt-3">
              {rowError}
            </InlineAlert>
          ) : null}
        </div>
      </div>
    </article>
  );
}
