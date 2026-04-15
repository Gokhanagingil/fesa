import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiGet, apiPatch } from '../../lib/api';
import {
  getActionCenterCategoryLabel,
  getActionCenterItemSummary,
  getActionCenterItemTitle,
  getActionCenterUrgencyLabel,
  getActionCenterUrgencyTone,
} from '../../lib/display';
import type { ActionCenterResponse } from '../../lib/domain-types';
import { useAuth } from '../../lib/auth-context';
import { useTenant } from '../../lib/tenant-hooks';
import { LanguageSwitch } from '../ui/LanguageSwitch';
import { Button } from '../ui/Button';
import { StatusBadge } from '../ui/StatusBadge';

export function Header() {
  const { t } = useTranslation();
  const { user, logout, canAccessCrossTenant } = useAuth();
  const { tenants, tenantId, setTenantId, loading } = useTenant();
  const [notifications, setNotifications] = useState<ActionCenterResponse | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!tenantId) {
      setNotifications(null);
      return;
    }

    setLoadingNotifications(true);
    setNotificationError(null);
    try {
      const response = await apiGet<ActionCenterResponse>('/api/action-center/items?view=notifications&limit=8');
      setNotifications(response);
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : t('app.errors.loadFailed'));
    } finally {
      setLoadingNotifications(false);
    }
  }, [t, tenantId]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!panelOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        setPanelOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [panelOpen]);

  async function markAllRead() {
    const active = await apiGet<ActionCenterResponse>('/api/action-center/items?view=notifications&limit=100&includeRead=true');
    const unreadKeys = active.items.filter((item) => !item.read).map((item) => item.itemKey);
    if (unreadKeys.length === 0) {
      return;
    }

    try {
      await apiPatch('/api/action-center/items', {
        itemKeys: unreadKeys,
        action: 'mark_read',
      });
      await loadNotifications();
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : t('app.errors.saveFailed'));
    }
  }

  async function markSingleRead(itemKey: string) {
    try {
      await apiPatch('/api/action-center/items', {
        itemKeys: [itemKey],
        action: 'mark_read',
      });
      await loadNotifications();
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : t('app.errors.saveFailed'));
    }
  }

  const tenantName = useMemo(
    () => tenants.find((tenant) => tenant.id === tenantId)?.name ?? null,
    [tenantId, tenants],
  );

  return (
    <header className="sticky top-0 z-10 border-b border-amateur-border bg-amateur-surface/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
            {t('app.name')}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-amateur-muted">
            <p className="truncate">{t('app.tagline')}</p>
            {tenantName ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">{tenantName}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative" ref={panelRef}>
            <button
              type="button"
              onClick={() => setPanelOpen((current) => !current)}
              className="relative inline-flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm font-medium text-amateur-ink transition hover:bg-amateur-surface"
            >
              <span aria-hidden="true">!</span>
              <span>{t('app.notifications.title')}</span>
              {(notifications?.counts.unread ?? 0) > 0 ? (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                  {notifications?.counts.unread ?? 0}
                </span>
              ) : null}
            </button>
            {panelOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.75rem)] z-20 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-amateur-border bg-amateur-surface p-4 shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-base font-semibold text-amateur-ink">
                      {t('app.notifications.title')}
                    </p>
                    <p className="mt-1 text-xs text-amateur-muted">
                      {t('app.notifications.subtitle')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => void markAllRead()}>
                      {t('app.notifications.markAllRead')}
                    </Button>
                  </div>
                </div>
                {notificationError ? (
                  <p className="mt-3 text-sm text-red-700">{notificationError}</p>
                ) : null}
                {loadingNotifications && !notifications ? (
                  <p className="mt-4 text-sm text-amateur-muted">{t('app.states.loading')}</p>
                ) : !notifications || notifications.items.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-dashed border-amateur-border bg-amateur-canvas/70 px-4 py-5 text-sm text-amateur-muted">
                    {t('app.notifications.empty')}
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {notifications.items.map((item) => (
                      <Link
                        key={item.itemKey}
                        to={item.deepLink}
                        onClick={() => {
                          setPanelOpen(false);
                          if (!item.read) {
                            void markSingleRead(item.itemKey);
                          }
                        }}
                        className="block rounded-xl border border-amateur-border bg-amateur-canvas px-4 py-3 transition hover:border-amateur-accent/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusBadge tone={getActionCenterUrgencyTone(item.urgency)}>
                                {getActionCenterUrgencyLabel(t, item.urgency)}
                              </StatusBadge>
                              <span className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
                                {getActionCenterCategoryLabel(t, item.category)}
                              </span>
                              {!item.read ? (
                                <span className="rounded-full bg-amateur-accent-soft px-2 py-0.5 text-[11px] font-medium text-amateur-accent">
                                  {t('app.notifications.unread')}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 text-sm font-semibold text-amateur-ink">
                              {getActionCenterItemTitle(t, item)}
                            </p>
                            <p className="mt-1 text-xs text-amateur-muted">
                              {[item.subjectName, item.relatedName].filter(Boolean).join(' · ')}
                            </p>
                            <p className="mt-1 text-xs text-amateur-muted">
                              {getActionCenterItemSummary(t, item)}
                            </p>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-amateur-border pt-3">
                  <p className="text-xs text-amateur-muted">
                    {t('app.notifications.summary', {
                      unread: notifications?.counts.unread ?? 0,
                      total: notifications?.counts.total ?? 0,
                    })}
                  </p>
                  <Link
                    to="/app/action-center"
                    onClick={() => setPanelOpen(false)}
                    className="text-sm font-semibold text-amateur-accent hover:underline"
                  >
                    {t('app.notifications.openQueue')}
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
          {user ? (
            <div className="hidden rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm md:block">
              <p className="font-medium text-amateur-ink">{user.displayName}</p>
              <p className="text-xs text-amateur-muted">
                {t(`app.enums.staffPlatformRole.${user.platformRole}`)}
                {tenantName && !canAccessCrossTenant ? ` · ${tenantName}` : ''}
              </p>
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-sm text-amateur-muted">
            <span className="whitespace-nowrap">{t('app.tenant.label')}</span>
            <select
              className="max-w-[14rem] rounded-lg border border-amateur-border bg-amateur-canvas px-2 py-1.5 text-sm text-amateur-ink outline-none focus:ring-2 focus:ring-amateur-accent/30"
              value={tenantId ?? ''}
              disabled={loading || tenants.length === 0}
              onChange={(e) => setTenantId(e.target.value)}
            >
              {tenants.length === 0 ? (
                <option value="">{t('app.tenant.empty')}</option>
              ) : (
                tenants.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <Link to={canAccessCrossTenant ? '/app/settings?section=platform' : '/app/settings?section=club'}>
            <Button variant="ghost">{t('app.nav.settings')}</Button>
          </Link>
          <Button type="button" variant="ghost" onClick={() => void logout()}>
            {t('app.auth.logout')}
          </Button>
          <LanguageSwitch />
        </div>
      </div>
    </header>
  );
}
