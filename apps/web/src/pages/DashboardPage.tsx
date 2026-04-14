import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../components/ui/PageHeader';
import { apiGet } from '../lib/api';
import { useTenant } from '../lib/tenant-hooks';

type SummaryState = {
  athletes: number;
  guardians: number;
  upcomingSessions: number;
  activeChargeItems: number;
};

export function DashboardPage() {
  const { t } = useTranslation();
  const { tenantId } = useTenant();
  const [summary, setSummary] = useState<SummaryState | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const today = new Date().toISOString();
      const [athletes, guardians, sessions, chargeItems] = await Promise.all([
        apiGet<{ total: number }>('/api/athletes?limit=1'),
        apiGet<{ total: number }>('/api/guardians?limit=1'),
        apiGet<{ total: number }>(`/api/training-sessions?limit=1&from=${encodeURIComponent(today)}`),
        apiGet<{ total: number }>('/api/charge-items?limit=1&isActive=true'),
      ]);
      setSummary({
        athletes: athletes.total,
        guardians: guardians.total,
        upcomingSessions: sessions.total,
        activeChargeItems: chargeItems.total,
      });
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHeader title={t('pages.dashboard.title')} subtitle={t('pages.dashboard.subtitle')} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            key: 'athletes',
            label: t('pages.dashboard.stats.athletes'),
            value: summary?.athletes ?? 0,
            href: '/app/athletes',
          },
          {
            key: 'guardians',
            label: t('pages.dashboard.stats.guardians'),
            value: summary?.guardians ?? 0,
            href: '/app/guardians',
          },
          {
            key: 'sessions',
            label: t('pages.dashboard.stats.upcomingSessions'),
            value: summary?.upcomingSessions ?? 0,
            href: '/app/training',
          },
          {
            key: 'charges',
            label: t('pages.dashboard.stats.activeChargeItems'),
            value: summary?.activeChargeItems ?? 0,
            href: '/app/finance/charge-items',
          },
        ].map((card) => (
          <Link
            key={card.key}
            to={card.href}
            className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm transition hover:border-amateur-accent/40"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-amateur-muted">{card.label}</p>
            <p className="mt-3 font-display text-3xl font-semibold text-amateur-ink">
              {loading && !summary ? '…' : card.value}
            </p>
          </Link>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Link
          to="/app/athletes"
          className="rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm transition hover:border-amateur-accent/40"
        >
          <p className="text-sm font-semibold text-amateur-accent">{t('pages.dashboard.cardPeople')}</p>
          <p className="mt-2 text-sm text-amateur-muted">{t('pages.dashboard.cardPeopleBody')}</p>
        </Link>
        <Link
          to="/app/training"
          className="rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm transition hover:border-amateur-accent/40"
        >
          <p className="text-sm font-semibold text-amateur-accent">{t('pages.dashboard.cardOps')}</p>
          <p className="mt-2 text-sm text-amateur-muted">{t('pages.dashboard.cardOpsBody')}</p>
        </Link>
        <Link
          to="/app/finance"
          className="rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm transition hover:border-amateur-accent/40"
        >
          <p className="text-sm font-semibold text-amateur-accent">{t('pages.dashboard.cardFinance')}</p>
          <p className="mt-2 text-sm text-amateur-muted">{t('pages.dashboard.cardFinanceBody')}</p>
        </Link>
      </div>
    </div>
  );
}
