import { useTranslation } from 'react-i18next';
import { LanguageSwitch } from '../ui/LanguageSwitch';

export function Header() {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-10 border-b border-amateur-border bg-amateur-surface/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
            {t('app.name')}
          </p>
          <p className="truncate text-sm text-amateur-muted">{t('app.tagline')}</p>
        </div>
        <LanguageSwitch />
      </div>
    </header>
  );
}
