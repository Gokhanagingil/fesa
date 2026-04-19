import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiGet, apiPost } from '../lib/api';
import type { GuardianPortalActivationStatus, GuardianPortalHome } from '../lib/domain-types';
import { LanguageSwitch } from '../components/ui/LanguageSwitch';
import { InlineAlert } from '../components/ui/InlineAlert';
import { PortalBrandMark } from '../components/ui/PortalBrandMark';
import { resolveBrandingTokens } from '../lib/portal-branding';

/**
 * Parent activation surface — turn an invite into a working portal login.
 *
 * Mobile-first, branded, and intentionally constrained:
 *   - the parent confirms who they are and which club this is,
 *   - sets a password (with a confirm field, server enforces ≥ 8 chars),
 *   - lands directly on the portal home with a session cookie set.
 *
 * Open self-signup is NOT supported in v1 by design; activation requires a
 * club-issued invite token (see docs/parent-portal.md).
 */
export function GuardianPortalActivationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<GuardianPortalActivationStatus | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError(t('portal.activate.invalidLink'));
      return;
    }

    void (async () => {
      try {
        const next = await apiGet<GuardianPortalActivationStatus>(`/api/guardian-portal/activate/${token}`);
        setStatus(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('app.errors.loadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t, token]);

  const branding = status?.branding ?? null;
  const tokens = useMemo(() => resolveBrandingTokens(branding), [branding]);

  const passwordTooShort = password.length > 0 && password.length < 8;
  const passwordsDoNotMatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= 8 && password === confirm;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      await apiPost<GuardianPortalHome>(`/api/guardian-portal/activate/${token}`, { password });
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
            <PortalBrandMark branding={branding} size="sm" />
            <div className="min-w-0">
              <p
                className="truncate font-display text-base font-semibold leading-tight"
                style={{ color: tokens.primary }}
              >
                {branding?.displayName ?? status?.tenantName ?? t('portal.brand')}
              </p>
              <p className="truncate text-xs text-amateur-muted">
                {branding?.tagline ?? t('portal.activate.subtitle')}
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
            {t('portal.activate.badge')}
          </p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-amateur-ink">
            {t('portal.activate.title')}
          </h1>
          <p className="mt-2 text-sm text-amateur-muted">{t('portal.activate.hint')}</p>

          {error ? (
            <InlineAlert tone="error" className="mt-4">
              {error}
            </InlineAlert>
          ) : null}

          {loading ? (
            <p className="mt-4 text-sm text-amateur-muted">{t('app.states.loading')}</p>
          ) : status ? (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-4 text-sm">
                <p className="font-medium text-amateur-ink">{status.guardianName}</p>
                <p className="mt-1 text-amateur-muted">
                  {status.tenantName} · {status.email}
                </p>
              </div>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-amateur-ink">{t('portal.activate.password')}</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 rounded-xl border border-amateur-border bg-amateur-canvas px-3 text-base text-amateur-ink focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-amateur-accent"
                />
                <span className="text-xs text-amateur-muted">
                  {t('portal.activate.passwordHint')}
                </span>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-amateur-ink">
                  {t('portal.activate.confirmPassword')}
                </span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  className="h-12 rounded-xl border border-amateur-border bg-amateur-canvas px-3 text-base text-amateur-ink focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-amateur-accent"
                />
              </label>

              {passwordTooShort ? (
                <InlineAlert tone="info">{t('portal.activate.errorTooShort')}</InlineAlert>
              ) : null}
              {passwordsDoNotMatch ? (
                <InlineAlert tone="info">{t('portal.activate.errorMismatch')}</InlineAlert>
              ) : null}

              <button
                type="submit"
                className="inline-flex h-12 w-full items-center justify-center rounded-xl text-base font-semibold transition-colors disabled:opacity-50"
                style={{ backgroundColor: tokens.primary, color: tokens.inkOnPrimary }}
                disabled={!canSubmit || saving}
              >
                {saving ? t('portal.activate.submitting') : t('portal.activate.submit')}
              </button>

              <p className="text-xs text-amateur-muted">{t('portal.activate.safetyNote')}</p>
            </form>
          ) : null}
        </section>
      </div>
    </div>
  );
}
