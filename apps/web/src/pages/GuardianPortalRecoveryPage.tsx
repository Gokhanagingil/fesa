import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiGet, apiPost } from '../lib/api';
import type { TenantBrandingPayload } from '../lib/domain-types';
import { LanguageSwitch } from '../components/ui/LanguageSwitch';
import { InlineAlert } from '../components/ui/InlineAlert';
import { PortalBrandMark } from '../components/ui/PortalBrandMark';
import { resolveBrandingTokens } from '../lib/portal-branding';

/**
 * Parent Portal v1.2 — calm "I lost access" surface.
 *
 * Mirrors the login page chrome on purpose so the parent never feels
 * dropped into an unfamiliar flow. The page asks for an email and an
 * optional club, posts to `/api/guardian-portal/recover`, and renders
 * a calm confirmation regardless of whether a row was found. The actual
 * reset still happens through the staff resend-invite path, which keeps
 * recovery safely under club control without forcing us to ship a brand
 * new public reset link surface yet (see docs/parent-portal.md).
 */
export function GuardianPortalRecoveryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<TenantBrandingPayload[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiPost('/api/guardian-portal/recover', {
        email: email.trim(),
        tenantId: tenantId || undefined,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('app.errors.saveFailed'));
    } finally {
      setSubmitting(false);
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
          <Link to="/portal/login" className="flex items-center gap-3">
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
            {t('portal.recovery.badge')}
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-amateur-ink">
            {t('portal.recovery.title')}
          </h1>
          <p className="mt-2 text-sm text-amateur-muted">{t('portal.recovery.hint')}</p>

          {error ? (
            <InlineAlert tone="error" className="mt-4">
              {error}
            </InlineAlert>
          ) : null}

          {done ? (
            <div className="mt-6 space-y-4">
              <InlineAlert tone="success">{t('portal.recovery.submitted')}</InlineAlert>
              <p className="text-sm text-amateur-muted">{t('portal.recovery.submittedHint')}</p>
              <p className="text-xs text-amateur-muted">
                {t('portal.recovery.submittedNextStep')}
              </p>
              <button
                type="button"
                onClick={() => navigate('/portal/login')}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl text-base font-semibold transition-colors"
                style={{ backgroundColor: tokens.primary, color: tokens.inkOnPrimary }}
              >
                {t('portal.recovery.backToLogin')}
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              {tenants.length > 1 ? (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-amateur-ink">
                    {t('portal.recovery.club')}
                  </span>
                  <select
                    value={tenantId}
                    onChange={(event) => setTenantId(event.target.value)}
                    disabled={loading}
                    className="h-12 rounded-xl border border-amateur-border bg-amateur-canvas px-3 text-base text-amateur-ink focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-amateur-accent"
                  >
                    <option value="">{t('portal.recovery.clubAny')}</option>
                    {tenants.map((tenant) => (
                      <option key={tenant.tenantId} value={tenant.tenantId}>
                        {tenant.displayName}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-amateur-ink">{t('portal.recovery.email')}</span>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-12 rounded-xl border border-amateur-border bg-amateur-canvas px-3 text-base text-amateur-ink focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-amateur-accent"
                />
                <span className="text-xs text-amateur-muted">{t('portal.recovery.emailHint')}</span>
              </label>

              <button
                type="submit"
                disabled={!email || submitting}
                className="inline-flex h-12 w-full items-center justify-center rounded-xl text-base font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
                style={{ backgroundColor: tokens.primary, color: tokens.inkOnPrimary }}
              >
                {submitting ? t('portal.recovery.submitting') : t('portal.recovery.submit')}
              </button>

              <p className="text-xs text-amateur-muted">{t('portal.recovery.safetyNote')}</p>
            </form>
          )}
        </section>

        <p className="text-center text-xs text-amateur-muted">
          <Link to="/portal/login" className="font-medium text-amateur-ink underline-offset-2 hover:underline">
            {t('portal.recovery.backToLogin')}
          </Link>
        </p>
      </div>
    </div>
  );
}
