import { useEffect, useState } from 'react';
import { apiGet } from './api';

/**
 * Wave 23 — Billing & Licensing Operationalization Pack v1.
 *
 * Calm, tenant-side feature availability lookup. Mirrors the server
 * payload from `GET /api/licensing/me/feature/:featureKey` so the UI
 * can:
 *   - render a non-hostile "Available on Operations / Growth" notice,
 *   - distinguish "license inactive" from "plan excludes feature",
 *   - disable controls instead of silently throwing 403s,
 *
 * without leaking the platform-admin entitlement matrix to tenants.
 */
export type FeatureAvailability =
  | { available: true; featureKey: string }
  | {
      available: false;
      featureKey: string;
      reason: 'no_subscription' | 'license_inactive' | 'plan_excludes_feature';
      planCode?: string;
      planName?: string;
      status?: string | null;
    };

export function useFeatureAvailability(
  featureKey: string,
  tenantId: string | null,
): {
  availability: FeatureAvailability | null;
  loading: boolean;
  error: string | null;
} {
  const [availability, setAvailability] = useState<FeatureAvailability | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!tenantId) {
      setAvailability(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setLoading(true);
    setError(null);
    let promise: Promise<FeatureAvailability | undefined>;
    try {
      promise = Promise.resolve(
        apiGet<FeatureAvailability>(
          `/api/licensing/me/feature/${encodeURIComponent(featureKey)}`,
        ),
      );
    } catch (err: unknown) {
      setLoading(false);
      setError(err instanceof Error ? err.message : 'failed');
      return () => {
        cancelled = true;
      };
    }
    promise
      .then((next) => {
        if (!cancelled && next) setAvailability(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [featureKey, tenantId]);

  return { availability, loading, error };
}
