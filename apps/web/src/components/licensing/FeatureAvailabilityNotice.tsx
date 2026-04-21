import { useTranslation } from 'react-i18next';
import { InlineAlert } from '../ui/InlineAlert';
import type { FeatureAvailability } from '../../lib/feature-availability';

type Props = {
  availability: FeatureAvailability | null;
  className?: string;
};

/**
 * Wave 23 — Billing & Licensing Operationalization Pack v1.
 *
 * Calm, tenant-safe explanation for why a capability is currently
 * unavailable. The component intentionally:
 *   - never renders harsh "blocked" / "denied" wording,
 *   - distinguishes "license inactive" from "plan excludes feature",
 *   - hides itself when the feature IS available (so callers can drop
 *     it next to a control without conditional logic),
 *   - leaves all action affordances to the parent (this is just copy).
 */
export function FeatureAvailabilityNotice({ availability, className }: Props) {
  const { t } = useTranslation();
  if (!availability || availability.available) return null;
  const reason = availability.reason;

  const heading = t(`pages.gating.${reason}.title`);
  const body =
    reason === 'plan_excludes_feature'
      ? t('pages.gating.plan_excludes_feature.body', {
          plan: availability.planName ?? availability.planCode ?? '',
        })
      : reason === 'license_inactive'
        ? t('pages.gating.license_inactive.body', {
            plan: availability.planName ?? availability.planCode ?? '',
          })
        : t('pages.gating.no_subscription.body');

  return (
    <InlineAlert tone="info" className={className}>
      <p className="font-semibold text-amateur-ink">{heading}</p>
      <p className="mt-1 text-sm text-amateur-muted">{body}</p>
      <p className="mt-1 text-xs text-amateur-muted">
        {t('pages.gating.platformOnly')}
      </p>
    </InlineAlert>
  );
}
