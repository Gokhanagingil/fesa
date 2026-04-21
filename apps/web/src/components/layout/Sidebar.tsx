import clsx from 'clsx';
import { useEffect, useMemo, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/auth-context';

type SidebarLink = {
  to: string;
  key:
    | 'dashboard'
    | 'onboarding'
    | 'actionCenter'
    | 'athletes'
    | 'coaches'
    | 'guardians'
    | 'groups'
    | 'teams'
    | 'training'
    | 'privateLessons'
    | 'finance'
    | 'inventory'
    | 'communications'
    | 'clubUpdates'
    | 'reports'
    | 'imports'
    | 'settings'
    | 'billing';
  platformAdminOnly?: boolean;
};

const links: SidebarLink[] = [
  { to: '/app/dashboard', key: 'dashboard' },
  { to: '/app/onboarding', key: 'onboarding' },
  { to: '/app/action-center', key: 'actionCenter' },
  { to: '/app/athletes', key: 'athletes' },
  { to: '/app/coaches', key: 'coaches' },
  { to: '/app/guardians', key: 'guardians' },
  { to: '/app/groups', key: 'groups' },
  { to: '/app/teams', key: 'teams' },
  { to: '/app/training', key: 'training' },
  { to: '/app/private-lessons', key: 'privateLessons' },
  { to: '/app/finance', key: 'finance' },
  { to: '/app/inventory', key: 'inventory' },
  { to: '/app/communications', key: 'communications' },
  { to: '/app/club-updates', key: 'clubUpdates' },
  { to: '/app/reports', key: 'reports' },
  { to: '/app/imports', key: 'imports' },
  { to: '/app/billing', key: 'billing', platformAdminOnly: true },
  { to: '/app/settings', key: 'settings' },
];

export function Sidebar() {
  const { t } = useTranslation();
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const { canAccessCrossTenant } = useAuth();
  // Billing & Licensing is intentionally a platform-admin-only menu in
  // v1 — tenant admins do not see it at all so commercial state cannot
  // accidentally leak into a club's day-to-day navigation.
  const visibleLinks = useMemo(
    () => links.filter((link) => !link.platformAdminOnly || canAccessCrossTenant),
    [canAccessCrossTenant],
  );

  // On phones the sidebar collapses to a single horizontally-scrolling
  // strip. With 17 staff destinations the active link can sit far off
  // screen, leaving the strip looking like it starts at "Dashboard"
  // even when the user is on, say, Communications. We scroll the active
  // tab into view on route changes so the user always has visible
  // context for where they are. This is purely a mobile polish — on
  // md+ the sidebar is vertical and the effect is a no-op.
  useEffect(() => {
    if (!navRef.current) return;
    const active = navRef.current.querySelector<HTMLElement>('a[aria-current="page"]');
    if (!active) return;
    active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [location.pathname]);

  return (
    <aside className="border-amateur-border bg-amateur-surface md:w-56 md:shrink-0 md:border-r">
      <div className="flex items-center justify-between gap-3 border-b border-amateur-border px-4 py-4 md:flex-col md:items-stretch md:gap-6 md:border-b-0 md:py-8">
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold tracking-tight text-amateur-accent">
            {t('app.name')}
          </p>
          <p className="truncate text-xs text-amateur-muted">{t('app.tagline')}</p>
        </div>
      </div>
      <nav
        ref={navRef}
        className="flex snap-x snap-mandatory gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:snap-none md:px-3 md:pb-0"
      >
        {visibleLinks.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              clsx(
                'min-h-[40px] snap-start whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-amateur-accent-soft text-amateur-accent'
                  : 'text-amateur-muted hover:bg-amateur-canvas hover:text-amateur-ink',
              )
            }
          >
            {t(`app.nav.${l.key}`)}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
