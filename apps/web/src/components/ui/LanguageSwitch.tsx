import { useTranslation } from 'react-i18next';

const locales = [
  { code: 'en' as const, labelKey: 'app.language.en' as const },
  { code: 'tr' as const, labelKey: 'app.language.tr' as const },
];

export function LanguageSwitch() {
  const { t, i18n } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-xs text-amateur-muted sm:inline">{t('app.language.label')}</span>
      <div
        className="inline-flex rounded-full border border-amateur-border bg-amateur-canvas p-0.5"
        role="group"
        aria-label={t('app.language.label')}
      >
        {locales.map((loc) => {
          const active = i18n.language.startsWith(loc.code);
          return (
            <button
              key={loc.code}
              type="button"
              onClick={() => void i18n.changeLanguage(loc.code)}
              className={
                active
                  ? 'rounded-full bg-amateur-surface px-3 py-1.5 text-xs font-semibold text-amateur-accent shadow-sm'
                  : 'rounded-full px-3 py-1.5 text-xs font-medium text-amateur-muted hover:text-amateur-ink'
              }
            >
              {t(loc.labelKey)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
