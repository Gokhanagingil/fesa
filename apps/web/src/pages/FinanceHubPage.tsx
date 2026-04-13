import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/ui/PageHeader';

export function FinanceHubPage() {
  const { t } = useTranslation();

  return (
    <div>
      <PageHeader title={t('pages.finance.title')} subtitle={t('pages.finance.subtitle')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/app/finance/charge-items"
          className="rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm transition hover:border-amateur-accent/40"
        >
          <h2 className="font-display text-lg font-semibold text-amateur-ink">{t('pages.finance.chargeItemsLink')}</h2>
          <p className="mt-2 text-sm text-amateur-muted">{t('pages.chargeItems.subtitle')}</p>
        </Link>
        <Link
          to="/app/finance/athlete-charges"
          className="rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm transition hover:border-amateur-accent/40"
        >
          <h2 className="font-display text-lg font-semibold text-amateur-ink">{t('pages.finance.athleteChargesLink')}</h2>
          <p className="mt-2 text-sm text-amateur-muted">{t('pages.athleteCharges.subtitle')}</p>
        </Link>
      </div>
      <p className="mt-8 max-w-2xl text-sm text-amateur-muted">{t('pages.finance.hubBody')}</p>
    </div>
  );
}
