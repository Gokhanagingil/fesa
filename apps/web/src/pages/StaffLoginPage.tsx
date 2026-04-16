import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitch } from '../components/ui/LanguageSwitch';
import { InlineAlert } from '../components/ui/InlineAlert';
import { Button } from '../components/ui/Button';
import { useAuth } from '../lib/auth-context';
import { SESSION_BOOTSTRAP_FAILED } from '../lib/auth-provider';

const DEMO_ACCOUNTS = [
  { label: 'Platform Admin', email: 'platform.admin@amateur.local' },
  { label: 'Kadıköy Gençlik', email: 'club.admin@amateur.local' },
  { label: 'Fesa Basketbol', email: 'admin@fesabasketbol.local' },
  { label: 'Moda Voleybol', email: 'admin@modavoleybol.local' },
  { label: 'Marmara Futbol', email: 'admin@marmarafutbol.local' },
];
const DEMO_PASSWORD = 'Admin123!';

export function StaffLoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTarget =
    searchParams.get('redirect') ??
    (location.state as { from?: string } | null)?.from ??
    '/app';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectTarget, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectTarget]);

  function prefillAccount(accountEmail: string) {
    setEmail(accountEmail);
    setPassword(DEMO_PASSWORD);
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await login({ email, password });
      navigate(redirectTarget, { replace: true });
    } catch (err) {
      if (err instanceof Error && err.message === SESSION_BOOTSTRAP_FAILED) {
        setError(t('pages.staffLogin.sessionBootstrapFailed'));
      } else {
        setError(err instanceof Error ? err.message : t('app.errors.saveFailed'));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-amateur-canvas to-amateur-surface">
      <div className="mx-auto flex max-w-md flex-col gap-8 px-4 pb-16 pt-8 sm:px-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <Link to="/" className="font-display text-xl font-semibold text-amateur-accent">
              {t('app.name')}
            </Link>
            <p className="text-sm text-amateur-muted">{t('pages.staffLogin.subtitle')}</p>
          </div>
          <LanguageSwitch />
        </header>

        <section className="rounded-3xl border border-amateur-border bg-amateur-surface p-6 shadow-sm">
          <p className="text-sm font-semibold text-amateur-accent">{t('pages.staffLogin.badge')}</p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-amateur-ink">
            {t('pages.staffLogin.title')}
          </h1>
          <p className="mt-2 text-sm text-amateur-muted">{t('pages.staffLogin.hint')}</p>

          {error ? (
            <InlineAlert tone="error" className="mt-4">
              {error}
            </InlineAlert>
          ) : null}

          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t('pages.staffLogin.email')}</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-amateur-ink"
                autoComplete="email"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t('pages.staffLogin.password')}</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-amateur-ink"
                autoComplete="current-password"
              />
            </label>

            <Button type="submit" className="w-full" disabled={!email || !password || saving}>
              {saving ? t('pages.staffLogin.submitting') : t('pages.staffLogin.submit')}
            </Button>
          </form>

          <div className="mt-6 rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-3 text-xs text-amateur-muted">
            <p className="font-medium text-amateur-ink">{t('pages.staffLogin.helperTitle')}</p>
            <p className="mt-1">{t('pages.staffLogin.helperBody')}</p>
          </div>

          <div className="mt-4 rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-3">
            <p className="text-xs font-medium text-amateur-ink">{t('pages.staffLogin.demoAccountsTitle')}</p>
            <p className="mt-1 text-xs text-amateur-muted">{t('pages.staffLogin.demoAccountsHint')}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => prefillAccount(account.email)}
                  className="rounded-lg border border-amateur-border bg-amateur-surface px-2.5 py-1.5 text-xs font-medium text-amateur-accent transition hover:bg-amateur-accent/10"
                >
                  {account.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-amateur-border bg-amateur-surface p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amateur-accent">
            {t('pages.staffLogin.platformNoticeTitle')}
          </p>
          <p className="mt-2 text-sm text-amateur-muted">{t('pages.staffLogin.platformNoticeBody')}</p>
        </section>
      </div>
    </div>
  );
}
