import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/ui/PageHeader';

export function SettingsPage() {
  const { t } = useTranslation();

  return (
    <div>
      <PageHeader title={t('pages.settings.title')} subtitle={t('pages.settings.subtitle')} />
      <div className="rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm">
        <p className="text-sm text-amateur-muted">{t('pages.settings.placeholder')}</p>
      </div>
    </div>
  );
}
