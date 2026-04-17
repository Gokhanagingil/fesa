import clsx from 'clsx';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../lib/auth-context';

const links = [
  { to: '/app/dashboard', key: 'dashboard' as const },
  { to: '/app/action-center', key: 'actionCenter' as const },
  { to: '/app/athletes', key: 'athletes' as const },
  { to: '/app/coaches', key: 'coaches' as const },
  { to: '/app/guardians', key: 'guardians' as const },
  { to: '/app/groups', key: 'groups' as const },
  { to: '/app/teams', key: 'teams' as const },
  { to: '/app/training', key: 'training' as const },
  { to: '/app/private-lessons', key: 'privateLessons' as const },
  { to: '/app/finance', key: 'finance' as const },
  { to: '/app/communications', key: 'communications' as const },
  { to: '/app/reports', key: 'reports' as const },
  { to: '/app/report-builder', key: 'reportBuilder' as const },
  { to: '/app/settings', key: 'settings' as const },
];

export function Sidebar() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const isGlobalAdmin = session?.user.platformRole === 'global_admin';
  const visibleLinks = links.filter((link) => (link.key === 'settings' ? true : !isGlobalAdmin || link.key !== 'reports'));

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
      <nav className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:px-3 md:pb-0">
        {visibleLinks.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) =>
              clsx(
                'whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors',
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
