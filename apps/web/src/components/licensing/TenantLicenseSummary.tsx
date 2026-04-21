import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiGet } from '../../lib/api';
import type { TenantEntitlementPublicSummary } from '../../lib/licensing-types';
import { InlineAlert } from '../ui/InlineAlert';
import { StatusBadge } from '../ui/StatusBadge';

type Props = {
  tenantId: string | null;
};

function statusTone(
  status: TenantEntitlementPublicSummary['status'],
): 'success' | 'info' | 'warning' | 'danger' | 'default' {
  switch (status) {
    case 'active':
      return 'success';
    case 'trial':
      return 'info';
    case 'suspended':
      return 'warning';
    case 'expired':
    case 'cancelled':
      return 'danger';
    default:
      return 'default';
  }
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toISOString().slice(0, 10);
}

/**
 * Calm, read-only commercial summary for tenant admins / staff. Shows
 * the current plan, lifecycle, and live usage band — no controls, no
 * internal notes. The Billing & Licensing console is platform-admin
 * only; this card just makes the tenant's own commercial state honest
 * and visible.
 */
export function TenantLicenseSummary({ tenantId }: Props) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<TenantEntitlementPublicSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!tenantId) {
      setSummary(null);
      return () => {
        cancelled = true;
      };
    }
    setLoading(true);
    setError(null);
    apiGet<TenantEntitlementPublicSummary>('/api/licensing/me')
      .then((next) => {
        if (!cancelled) {
          setSummary(next);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('app.errors.loadFailed'));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [t, tenantId]);

  return (
    <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-amateur-ink">
            {t('pages.settings.licensing.title')}
          </h3>
          <p className="mt-1 max-w-3xl text-sm text-amateur-muted">
            {t('pages.settings.licensing.hint')}
          </p>
        </div>
        {summary?.status ? (
          <StatusBadge tone={statusTone(summary.status)}>
            {t(`pages.billing.statuses.${summary.status}`)}
          </StatusBadge>
        ) : null}
      </div>

      {error ? (
        <InlineAlert tone="error" className="mt-4">
          {error}
        </InlineAlert>
      ) : null}

      {loading && !summary ? (
        <p className="mt-4 text-sm text-amateur-muted">{t('app.states.loading')}</p>
      ) : !summary || !summary.plan ? (
        <InlineAlert tone="info" className="mt-4">
          {t('pages.settings.licensing.noSubscription')}
        </InlineAlert>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Cell
            label={t('pages.settings.licensing.currentPlan')}
            value={summary.plan.name}
          />
          <Cell
            label={t('pages.settings.licensing.lifecycle')}
            value={summary.status ? t(`pages.billing.statuses.${summary.status}`) : '—'}
          />
          <Cell
            label={t('pages.settings.licensing.trialEndsAt')}
            value={formatDate(summary.trialEndsAt)}
          />
          <Cell
            label={t('pages.settings.licensing.renewalDate')}
            value={formatDate(summary.renewalDate)}
          />
          <Cell
            label={t('pages.settings.licensing.activeAthletes')}
            value={String(summary.usage.activeAthleteCount)}
          />
          <Cell
            label={t('pages.settings.licensing.evaluatedBand')}
            value={summary.usage.band.label ?? t('pages.settings.licensing.noBand')}
          />
        </div>
      )}

      <p className="mt-4 text-xs text-amateur-muted">
        {t('pages.settings.licensing.platformOnly')}
      </p>
    </section>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-amateur-muted">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-amateur-ink">{value}</p>
    </div>
  );
}
