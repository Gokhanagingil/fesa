import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/ui/PageHeader';

export function DashboardPage() {
  const { t } = useTranslation();

  return (
    <div>
      <PageHeader title={t('pages.dashboard.title')} subtitle={t('pages.dashboard.subtitle')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm">
          <p className="text-sm font-semibold text-amateur-accent">{t('pages.dashboard.cardOps')}</p>
          <p className="mt-2 text-sm text-amateur-muted">{t('pages.dashboard.cardOpsBody')}</p>
        </div>
        <div className="rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm">
          <p className="text-sm font-semibold text-amateur-accent">{t('pages.dashboard.cardPeople')}</p>
          <p className="mt-2 text-sm text-amateur-muted">{t('pages.dashboard.cardPeopleBody')}</p>
        </div>
      </div>
    </div>
  );
}
