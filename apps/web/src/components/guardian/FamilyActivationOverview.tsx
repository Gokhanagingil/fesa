import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { InlineAlert } from '../ui/InlineAlert';
import { StatCard } from '../ui/StatCard';
import { apiGet } from '../../lib/api';
import { formatDateTime } from '../../lib/display';
import { useTenant } from '../../lib/tenant-hooks';

/**
 * Family Activation & Landing Pack v1 — calm staff-side overview.
 *
 * The view answers two operational questions for club staff:
 *   1. Where do families stand right now? (totals strip)
 *   2. Who should I gently follow up with next? (segmented bucket list)
 *
 * It is intentionally not a CRM-style funnel: there are no charts, no
 * conversion rates, no marketing language. Each row links straight back
 * to the same Guardian detail surface where staff can already manage
 * portal access, so we never invent a parallel workflow.
 */

type ActivationOverviewItem = {
  guardianId: string;
  guardianName: string;
  email: string | null;
  linkedAthletes: number;
  inviteAgeDays: number | null;
  lastSeenAgeDays: number | null;
  status: 'invited' | 'active' | 'disabled' | null;
  recoveryRequestedAt?: string | null;
  recoveryRequestCount?: number;
};

type ActivationBucket = {
  count: number;
  items: ActivationOverviewItem[];
};

type ActivationOverview = {
  tenantId: string;
  generatedAt: string;
  thresholds: {
    dormantAfterDays: number;
    staleInviteAfterDays: number;
  };
  totals: {
    guardians: number;
    guardiansWithAccess: number;
    notInvited: number;
    invited: number;
    active: number;
    dormant: number;
    recovery: number;
    disabled: number;
    recentlyActivated: number;
    staleInvites: number;
    activationRatePercent: number;
  };
  buckets: {
    notInvited: ActivationBucket;
    invited: ActivationBucket;
    active: ActivationBucket;
    dormant: ActivationBucket;
    recovery: ActivationBucket;
    disabled: ActivationBucket;
  };
};

type BucketKey = keyof ActivationOverview['buckets'];

const FOLLOW_UP_BUCKETS: BucketKey[] = ['recovery', 'invited', 'notInvited', 'dormant'];
const ALL_BUCKETS: BucketKey[] = [
  'recovery',
  'invited',
  'notInvited',
  'dormant',
  'active',
  'disabled',
];

export function FamilyActivationOverview() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [data, setData] = useState<ActivationOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeBucket, setActiveBucket] = useState<BucketKey>('recovery');

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const next = await apiGet<ActivationOverview>(
        '/api/guardian-portal/staff/activation-overview',
      );
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const followUpTotal = useMemo(() => {
    if (!data) return 0;
    return FOLLOW_UP_BUCKETS.reduce((sum, key) => sum + data.totals[key], 0);
  }, [data]);

  const visibleBucket = data ? data.buckets[activeBucket] : null;

  function handlePrepareReminder() {
    if (!data) return;
    const guardianIds = collectFollowUpGuardianIds(data);
    if (guardianIds.length === 0) {
      return;
    }
    const params = new URLSearchParams();
    guardianIds.forEach((id) => params.append('guardianIds', id));
    params.set('source', 'family_activation');
    params.set('sourceKey', `activation-followup-${guardianIds.length}`);
    params.set('templateKey', 'activation_reminder');
    params.set('channel', 'whatsapp');
    params.set('primaryContactsOnly', 'true');
    navigate(`/app/communications?${params.toString()}`);
  }

  if (!tenantId && !tenantLoading) {
    return <p className="text-sm text-amateur-muted">{t('app.errors.needTenant')}</p>;
  }

  if (loading || !data) {
    return (
      <div className="space-y-4">
        {error ? (
          <InlineAlert tone="error">{error}</InlineAlert>
        ) : (
          <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-amateur-border bg-amateur-surface p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-amateur-accent">
              {t('pages.guardians.activation.badge')}
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold text-amateur-ink sm:text-2xl">
              {t('pages.guardians.activation.title')}
            </h2>
            <p className="mt-1 max-w-prose text-sm text-amateur-muted">
              {t('pages.guardians.activation.subtitle')}
            </p>
          </div>
          {followUpTotal > 0 ? (
            <Button type="button" onClick={handlePrepareReminder}>
              {t('pages.guardians.activation.prepareReminder', { count: followUpTotal })}
            </Button>
          ) : null}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={t('pages.guardians.activation.statActiveLabel')}
            value={data.totals.active + data.totals.dormant}
            helper={t('pages.guardians.activation.statActiveHelper', {
              percent: data.totals.activationRatePercent,
            })}
            compact
          />
          <StatCard
            label={t('pages.guardians.activation.statInvitedLabel')}
            value={data.totals.invited}
            helper={
              data.totals.staleInvites > 0
                ? t('pages.guardians.activation.statInvitedHelper', {
                    count: data.totals.staleInvites,
                    days: data.thresholds.staleInviteAfterDays,
                  })
                : t('pages.guardians.activation.statInvitedFresh')
            }
            compact
            tone={data.totals.staleInvites > 0 ? 'danger' : 'default'}
          />
          <StatCard
            label={t('pages.guardians.activation.statNotInvitedLabel')}
            value={data.totals.notInvited}
            helper={t('pages.guardians.activation.statNotInvitedHelper')}
            compact
          />
          <StatCard
            label={t('pages.guardians.activation.statRecoveryLabel')}
            value={data.totals.recovery}
            helper={t('pages.guardians.activation.statRecoveryHelper')}
            compact
            tone={data.totals.recovery > 0 ? 'danger' : 'default'}
          />
        </div>
        <p className="mt-4 text-xs text-amateur-muted">
          {t('pages.guardians.activation.calmReassurance', {
            dormant: data.thresholds.dormantAfterDays,
          })}
        </p>
      </section>

      <section className="rounded-3xl border border-amateur-border bg-amateur-surface p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-amateur-ink">
              {t('pages.guardians.activation.bucketTitle')}
            </h3>
            <p className="mt-1 text-sm text-amateur-muted">
              {t('pages.guardians.activation.bucketHint')}
            </p>
          </div>
        </div>
        <div className="mt-4 -mx-1 flex flex-wrap gap-2 overflow-x-auto px-1">
          {ALL_BUCKETS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveBucket(key)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition-colors ${
                key === activeBucket
                  ? 'border-amateur-accent bg-amateur-accent text-white'
                  : 'border-amateur-border bg-amateur-canvas text-amateur-muted hover:text-amateur-ink'
              }`}
              aria-pressed={key === activeBucket}
            >
              <span>{t(`pages.guardians.activation.bucket.${key}`)}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  key === activeBucket
                    ? 'bg-white/20 text-white'
                    : 'bg-amateur-surface text-amateur-ink'
                }`}
              >
                {data.totals[key]}
              </span>
            </button>
          ))}
        </div>

        {visibleBucket && visibleBucket.items.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              title={t(`pages.guardians.activation.empty.${activeBucket}`)}
              hint={t(`pages.guardians.activation.emptyHint.${activeBucket}`)}
            />
          </div>
        ) : (
          <ul className="mt-5 space-y-2">
            {visibleBucket?.items.map((item) => (
              <li
                key={`${activeBucket}-${item.guardianId}`}
                className="rounded-2xl border border-amateur-border bg-amateur-canvas px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-amateur-ink">{item.guardianName}</p>
                    <p className="mt-0.5 truncate text-xs text-amateur-muted">
                      {item.email ?? t('pages.guardians.activation.row.noEmail')}
                    </p>
                    <p className="mt-2 text-xs text-amateur-muted">
                      {[
                        t('pages.guardians.activation.row.linkedAthletes', {
                          count: item.linkedAthletes,
                        }),
                        renderActivityHint(t, activeBucket, item),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {activeBucket === 'recovery' && item.recoveryRequestedAt ? (
                      <p className="mt-1 text-xs text-amber-700">
                        {t('pages.guardians.activation.row.recoveryAt', {
                          when: formatDateTime(item.recoveryRequestedAt, i18n.language),
                          count: item.recoveryRequestCount ?? 1,
                        })}
                      </p>
                    ) : null}
                  </div>
                  <Link
                    to={`/app/guardians/${item.guardianId}`}
                    className="shrink-0 text-sm font-medium text-amateur-accent hover:underline"
                  >
                    {t('pages.guardians.activation.row.open')}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}

        {visibleBucket && visibleBucket.count > visibleBucket.items.length ? (
          <p className="mt-3 text-xs text-amateur-muted">
            {t('pages.guardians.activation.truncatedHint', {
              shown: visibleBucket.items.length,
              total: visibleBucket.count,
            })}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function renderActivityHint(
  t: ReturnType<typeof useTranslation>['t'],
  bucket: BucketKey,
  item: ActivationOverviewItem,
): string | null {
  if (bucket === 'invited' && item.inviteAgeDays != null) {
    return t('pages.guardians.activation.row.invitedAge', { count: item.inviteAgeDays });
  }
  if (bucket === 'dormant' && item.lastSeenAgeDays != null) {
    return t('pages.guardians.activation.row.lastSeenAge', { count: item.lastSeenAgeDays });
  }
  if (bucket === 'active' && item.lastSeenAgeDays != null) {
    return t('pages.guardians.activation.row.lastSeenAge', { count: item.lastSeenAgeDays });
  }
  if (bucket === 'notInvited') {
    return t('pages.guardians.activation.row.readyToInvite');
  }
  if (bucket === 'disabled') {
    return t('pages.guardians.activation.row.disabledHint');
  }
  return null;
}

function collectFollowUpGuardianIds(overview: ActivationOverview): string[] {
  const ids = new Set<string>();
  for (const key of FOLLOW_UP_BUCKETS) {
    for (const item of overview.buckets[key].items) {
      if (item.email) {
        ids.add(item.guardianId);
      }
    }
  }
  return Array.from(ids);
}
