import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiGet, apiPost } from '../lib/api';
import type { GuardianPortalHome } from '../lib/domain-types';
import type { TenantRow } from '../lib/tenant-context';
import { LanguageSwitch } from '../components/ui/LanguageSwitch';
import { InlineAlert } from '../components/ui/InlineAlert';
import { Button } from '../components/ui/Button';

export function GuardianPortalLoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const rows = await apiGet<TenantRow[]>('/api/tenants');
        setTenants(rows);
        if (rows.length === 1) {
          setTenantId(rows[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t('app.errors.loadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

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
    <div className="min-h-dvh bg-gradient-to-b from-amateur-canvas to-amateur-surface">
      <div className="mx-auto flex max-w-md flex-col gap-8 px-4 pb-16 pt-8 sm:px-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <Link to="/" className="font-display text-xl font-semibold text-amateur-accent">
              {t('portal.brand')}
            </Link>
            <p className="text-sm text-amateur-muted">{t('portal.login.subtitle')}</p>
          </div>
          <LanguageSwitch />
        </header>

        <section className="rounded-3xl border border-amateur-border bg-amateur-surface p-6 shadow-sm">
          <p className="text-sm font-semibold text-amateur-accent">{t('portal.login.badge')}</p>
          <h1 className="mt-2 font-display text-2xl font-semibold text-amateur-ink">
            {t('portal.login.title')}
          </h1>
          <p className="mt-2 text-sm text-amateur-muted">{t('portal.login.hint')}</p>

          {error ? (
            <InlineAlert tone="error" className="mt-4">
              {error}
            </InlineAlert>
          ) : null}

          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t('portal.login.club')}</span>
              <select
                value={tenantId}
                onChange={(event) => setTenantId(event.target.value)}
                disabled={loading}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-amateur-ink"
              >
                <option value="">{t('portal.login.selectClub')}</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t('portal.login.email')}</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-amateur-ink"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t('portal.login.password')}</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-amateur-ink"
              />
            </label>

            <Button type="submit" className="w-full" disabled={!tenantId || !email || !password || saving}>
              {saving ? t('portal.login.submitting') : t('portal.login.submit')}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
