import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiGet, apiPost } from '../lib/api';
import type { GuardianPortalHome, TenantBrandingPayload } from '../lib/domain-types';
import { LanguageSwitch } from '../components/ui/LanguageSwitch';
import { InlineAlert } from '../components/ui/InlineAlert';
import { PortalBrandMark } from '../components/ui/PortalBrandMark';
import { resolveBrandingTokens } from '../lib/portal-branding';

/**
 * Parent Portal & Tenant Branding Foundation v1 — login surface.
 *
 * Mobile-first, calm, branded.  We resolve a bounded brand payload per
 * tenant (logo, display name, primary/accent color) so the parent feels
 * like they are arriving at their own club, not a generic admin login.
 *
 * v1 only supports the invitation-based, club-controlled access model:
 * email + password.  No open self-signup, no magic link, no OTP — those
 * stay deferred (see docs/parent-portal.md).
 */
export function GuardianPortalLoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<TenantBrandingPayload[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const rows = await apiGet<TenantBrandingPayload[]>('/api/portal/tenants');
        setTenants(rows);
        if (rows.length === 1) {
          setTenantId(rows[0].tenantId);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t('app.errors.loadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const activeBrand = useMemo(
    () => tenants.find((tenant) => tenant.tenantId === tenantId) ?? null,
    [tenantId, tenants],
  );
  const tokens = useMemo(() => resolveBrandingTokens(activeBrand), [activeBrand]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiPost<GuardianPortalHome>('/api/guardian-portal/login', {
        tenantId,
        email,
        password,
      });
      navigate('/portal', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('app.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="min-h-dvh bg-amateur-canvas"
      style={{
        backgroundImage: `linear-gradient(180deg, ${tokens.primarySoft} 0%, transparent 60%)`,
      }}
    >
      <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 px-4 pb-16 pt-8 sm:px-6">
        <header className="flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            <PortalBrandMark branding={activeBrand} size="sm" />
            <div className="min-w-0">
              <p
                className="truncate font-display text-base font-semibold leading-tight"
                style={{ color: tokens.primary }}
              >
                {activeBrand?.displayName ?? t('portal.brand')}
              </p>
              <p className="truncate text-xs text-amateur-muted">
                {activeBrand?.tagline ?? t('portal.subtitle')}
              </p>
            </div>
          </Link>
          <LanguageSwitch />
        </header>

        <section className="rounded-3xl border border-amateur-border bg-amateur-surface p-6 shadow-sm">
          <p
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: tokens.primary }}
          >
            {t('portal.login.badge')}
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-amateur-ink">
            {activeBrand?.welcomeTitle ?? t('portal.login.title')}
          </h1>
          <p className="mt-2 text-sm text-amateur-muted">
            {activeBrand?.welcomeMessage ?? t('portal.login.hint')}
          </p>

          {error ? (
            <InlineAlert tone="error" className="mt-4">
              {error}
            </InlineAlert>
          ) : null}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-amateur-ink">{t('portal.login.club')}</span>
              <select
                value={tenantId}
                onChange={(event) => setTenantId(event.target.value)}
                disabled={loading}
                className="h-12 rounded-xl border border-amateur-border bg-amateur-canvas px-3 text-base text-amateur-ink focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-amateur-accent"
              >
                <option value="">{t('portal.login.selectClub')}</option>
                {tenants.map((tenant) => (
                  <option key={tenant.tenantId} value={tenant.tenantId}>
                    {tenant.displayName}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-amateur-ink">{t('portal.login.email')}</span>
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 rounded-xl border border-amateur-border bg-amateur-canvas px-3 text-base text-amateur-ink focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-amateur-accent"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-amateur-ink">{t('portal.login.password')}</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 rounded-xl border border-amateur-border bg-amateur-canvas px-3 text-base text-amateur-ink focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-amateur-accent"
              />
            </label>

            <button
              type="submit"
              disabled={!tenantId || !email || !password || saving}
              className="inline-flex h-12 w-full items-center justify-center rounded-xl text-base font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
              style={{ backgroundColor: tokens.primary, color: tokens.inkOnPrimary }}
            >
              {saving ? t('portal.login.submitting') : t('portal.login.submit')}
            </button>
          </form>

          <p className="mt-6 text-xs text-amateur-muted">{t('portal.login.invitationHint')}</p>
        </section>

        <p className="text-center text-xs text-amateur-muted">
          {t('portal.login.signedOutHint')}
        </p>
      </div>
    </div>
  );
}
