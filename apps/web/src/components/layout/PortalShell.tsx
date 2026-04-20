import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitch } from '../ui/LanguageSwitch';
import { apiPost } from '../../lib/api';
import {
  PortalBrandingContext,
  resolveBrandingTokens,
  usePortalBranding,
} from '../../lib/portal-branding';
import type { TenantBrandingPayload } from '../../lib/domain-types';
import { PortalBrandMark } from '../ui/PortalBrandMark';

/**
 * Parent Portal & Tenant Branding Foundation v1 — branded but controlled shell.
 *
 * The shell is intentionally calmer than admin pages: more spacious, fewer
 * controls in view at any time, mobile-native bottom navigation, and a brand
 * mark that reflects the current club without altering layout, typography,
 * spacing, or component structure.
 */
export function PortalShell() {
  const [branding, setBranding] = useState<TenantBrandingPayload | null>(null);

  const value = useMemo(() => ({ branding, setBranding }), [branding]);

  return (
    <PortalBrandingContext.Provider value={value}>
      <PortalChrome />
    </PortalBrandingContext.Provider>
  );
}

function PortalChrome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { branding } = usePortalBranding();
  const tokens = useMemo(() => resolveBrandingTokens(branding), [branding]);

  const logout = useCallback(async () => {
    try {
      await apiPost('/api/guardian-portal/logout', {});
    } finally {
      navigate('/portal/login', { replace: true });
    }
  }, [navigate]);

  // Re-applies branded CSS variables to the portal root so brand color shifts
  // (for example after the home payload arrives) cascade through every card,
  // button, and accent without re-rendering the whole shell.
  useEffect(() => {
    const root = document.getElementById('portal-root');
    if (!root) return;
    root.style.setProperty('--portal-primary', tokens.primary);
    root.style.setProperty('--portal-accent', tokens.accent);
    root.style.setProperty('--portal-primary-soft', tokens.primarySoft);
    root.style.setProperty('--portal-accent-soft', tokens.accentSoft);
    root.style.setProperty('--portal-ink-on-primary', tokens.inkOnPrimary);
    root.style.setProperty('--portal-ink-on-accent', tokens.inkOnAccent);
    root.style.setProperty('--portal-ring-soft', tokens.ringSoft);
    root.style.setProperty('--portal-surface-wash', tokens.surfaceWash);
  }, [tokens]);

  const isHome = location.pathname === '/portal' || location.pathname === '/portal/home';

  return (
    <div
      id="portal-root"
      className="min-h-dvh bg-amateur-canvas pb-24 sm:pb-10"
      style={{
        backgroundImage:
          'radial-gradient(1200px 600px at 100% -10%, var(--portal-surface-wash, transparent), transparent 60%)',
      }}
    >
      <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 pt-5 sm:px-6">
        <header className="flex items-center justify-between gap-3">
          <Link
            to="/portal"
            className="flex min-w-0 items-center gap-3"
            aria-label={t('portal.aria.brandHome')}
          >
            <PortalBrandMark branding={branding} size="sm" />
            <div className="min-w-0">
              <p
                className="truncate font-display text-base font-semibold leading-tight"
                style={{ color: tokens.primary }}
              >
                {branding?.displayName ?? t('portal.brand')}
              </p>
              <p className="truncate text-xs text-amateur-muted">
                {branding?.tagline ?? t('portal.subtitle')}
              </p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitch />
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-full border border-amateur-border bg-amateur-surface px-3 py-1.5 text-xs font-medium text-amateur-ink transition-colors hover:bg-amateur-canvas focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amateur-accent"
            >
              {t('portal.actions.signOut')}
            </button>
          </div>
        </header>

        <main className="flex-1 pt-6 pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile-first bottom navigation. We deliberately keep this to two
          large, comfortable tap targets so the parent never has to think
          about navigation; “Home” covers the calm utility surface and
          “My family” is a quick scroll anchor on the same page. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-amateur-border bg-amateur-surface/95 backdrop-blur sm:hidden"
        aria-label={t('portal.aria.bottomNav')}
      >
        <div className="mx-auto flex max-w-3xl items-stretch justify-between gap-2 px-3 py-2">
          <NavLink
            to="/portal/home"
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-[11px] font-medium transition-colors ${
                isActive || isHome
                  ? 'bg-[color:var(--portal-primary-soft)] text-[color:var(--portal-primary)]'
                  : 'text-amateur-muted hover:text-amateur-ink'
              }`
            }
          >
            <span aria-hidden="true">●</span>
            {t('portal.nav.home')}
          </NavLink>
          <a
            href="#family"
            className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-[11px] font-medium text-amateur-muted hover:text-amateur-ink"
          >
            <span aria-hidden="true">○</span>
            {t('portal.nav.family')}
          </a>
          <a
            href="#updates"
            className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-[11px] font-medium text-amateur-muted hover:text-amateur-ink"
          >
            <span aria-hidden="true">◇</span>
            {t('portal.nav.updates')}
          </a>
        </div>
      </nav>
    </div>
  );
}
