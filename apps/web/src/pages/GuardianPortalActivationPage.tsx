import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiGet, apiPost } from '../lib/api';
import type { GuardianPortalActivationStatus, GuardianPortalHome } from '../lib/domain-types';
import { LanguageSwitch } from '../components/ui/LanguageSwitch';
import { InlineAlert } from '../components/ui/InlineAlert';
import { Button } from '../components/ui/Button';

export function GuardianPortalActivationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<GuardianPortalActivationStatus | null>(null);
  const [password, setPassword] = useState('');
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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
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
    <div className="min-h-dvh bg-gradient-to-b from-amateur-canvas to-amateur-surface">
      <div className="mx-auto flex max-w-md flex-col gap-8 px-4 pb-16 pt-8 sm:px-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <Link to="/" className="font-display text-xl font-semibold text-amateur-accent">
              {t('portal.brand')}
            </Link>
            <p className="text-sm text-amateur-muted">{t('portal.activate.subtitle')}</p>
          </div>
          <LanguageSwitch />
        </header>

        <section className="rounded-3xl border border-amateur-border bg-amateur-surface p-6 shadow-sm">
          <p className="text-sm font-semibold text-amateur-accent">{t('portal.activate.badge')}</p>
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
            <form onSubmit={submit} className="mt-5 space-y-4">
              <div className="rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-4 text-sm">
                <p className="font-medium text-amateur-ink">{status.guardianName}</p>
                <p className="mt-1 text-amateur-muted">
                  {status.tenantName} · {status.email}
                </p>
              </div>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{t('portal.activate.password')}</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-amateur-ink"
                />
              </label>

              <Button type="submit" className="w-full" disabled={password.length < 8 || saving}>
                {saving ? t('portal.activate.submitting') : t('portal.activate.submit')}
              </Button>
            </form>
          ) : null}
        </section>
      </div>
    </div>
  );
}
