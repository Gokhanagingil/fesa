import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/ui/PageHeader';

export function FinanceHubPage() {
  const { t } = useTranslation();

  return (
    <div>
      <PageHeader title={t('pages.finance.title')} subtitle={t('pages.finance.subtitle')} />
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
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
            <h2 className="font-display text-lg font-semibold text-amateur-ink">
              {t('pages.finance.athleteChargesLink')}
            </h2>
            <p className="mt-2 text-sm text-amateur-muted">{t('pages.athleteCharges.subtitle')}</p>
          </Link>
        </div>
        <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm">
          <p className="text-sm font-semibold text-amateur-accent">{t('pages.finance.hubChecklistTitle')}</p>
          <ul className="mt-4 space-y-3 text-sm text-amateur-muted">
            {(
              [
                'pages.finance.hubChecklist1',
                'pages.finance.hubChecklist2',
                'pages.finance.hubChecklist3',
              ] as const
            ).map((key) => (
              <li key={key} className="flex gap-3">
                <span className="mt-1 text-amateur-accent">•</span>
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-amateur-muted">{t('pages.finance.hubBody')}</p>
        </section>
      </div>
    </div>
  );
}
