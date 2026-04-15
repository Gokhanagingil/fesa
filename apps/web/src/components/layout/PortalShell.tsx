import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitch } from '../ui/LanguageSwitch';
import { Button } from '../ui/Button';
import { apiPost } from '../../lib/api';

export function PortalShell() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  async function logout() {
    try {
      await apiPost('/api/guardian-portal/logout', {});
    } finally {
      navigate('/portal/login', { replace: true });
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-amateur-canvas to-amateur-surface">
      <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to="/portal" className="font-display text-xl font-semibold text-amateur-accent">
              {t('portal.brand')}
            </Link>
            <p className="text-sm text-amateur-muted">{t('portal.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/portal">
              <Button variant="ghost">{t('portal.nav.home')}</Button>
            </Link>
            <Button variant="ghost" onClick={() => void logout()}>
              {t('portal.actions.logout')}
            </Button>
            <LanguageSwitch />
          </div>
        </header>
        <main className="flex-1 pt-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
