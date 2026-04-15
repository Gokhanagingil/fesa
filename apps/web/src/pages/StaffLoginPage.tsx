import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitch } from '../components/ui/LanguageSwitch';
import { InlineAlert } from '../components/ui/InlineAlert';
import { Button } from '../components/ui/Button';
import { useAuth } from '../lib/auth-context';

export function StaffLoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      const next = (location.state as { from?: string } | null)?.from ?? '/app';
      navigate(next, { replace: true });
    }
  }, [isAuthenticated, location.state, navigate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await login({ email, password });
      const next = (location.state as { from?: string } | null)?.from ?? '/app';
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('app.errors.saveFailed'));
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
            <p className="text-sm text-amateur-muted">{t('auth.staffLogin.subtitle')}</p>
          </div>
          <LanguageSwitch />
        </header>

        <section className="rounded-3xl border border-amateur-border bg-amateur-surface p-6 shadow-sm">
          <p className="text-sm font-semibold text-amateur-accent">{t('auth.staffLogin.badge')}</p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-amateur-ink">
            {t('auth.staffLogin.title')}
          </h1>
          <p className="mt-2 text-sm text-amateur-muted">{t('auth.staffLogin.hint')}</p>

          {error ? (
            <InlineAlert tone="error" className="mt-4">
              {error}
            </InlineAlert>
          ) : null}

          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t('auth.staffLogin.email')}</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-amateur-ink"
                autoComplete="email"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t('auth.staffLogin.password')}</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-amateur-ink"
                autoComplete="current-password"
              />
            </label>

            <Button type="submit" className="w-full" disabled={!email || !password || saving}>
              {saving ? t('auth.staffLogin.submitting') : t('auth.staffLogin.submit')}
            </Button>
          </form>

          <div className="mt-6 rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-3 text-xs text-amateur-muted">
            <p className="font-medium text-amateur-ink">{t('auth.staffLogin.demoTitle')}</p>
            <p className="mt-1">{t('auth.staffLogin.demoHint')}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
