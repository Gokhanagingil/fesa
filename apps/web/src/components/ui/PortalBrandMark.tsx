import type { TenantBrandingPayload } from '../../lib/domain-types';
import { resolveBrandingTokens } from '../../lib/portal-branding';

type Size = 'sm' | 'md' | 'lg';

const SIZE_CLASS: Record<Size, string> = {
  sm: 'h-9 w-9 text-sm',
  md: 'h-12 w-12 text-base',
  lg: 'h-16 w-16 text-lg',
};

/**
 * Parent Portal & Tenant Branding Foundation v1 — branded mark.
 *
 * Renders either the tenant logo (if configured to a safe URL) or a
 * monogram derived from the display name on the tenant's brand color.
 * The mark stays a fixed size and shape so the portal layout never
 * shifts between tenants — only the color and contents vary.
 */
export function PortalBrandMark({
  branding,
  size = 'md',
  className,
}: {
  branding: TenantBrandingPayload | null | undefined;
  size?: Size;
  className?: string;
}) {
  const tokens = resolveBrandingTokens(branding ?? null);
  const initials = (branding?.displayName ?? branding?.tenantName ?? 'A')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');

  const sizeClass = SIZE_CLASS[size];

  if (branding?.logoUrl) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-amateur-border bg-amateur-surface ${sizeClass} ${className ?? ''}`}
      >
        <img
          src={branding.logoUrl}
          alt=""
          className="h-full w-full object-contain"
          loading="lazy"
        />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-2xl font-display font-semibold ${sizeClass} ${className ?? ''}`}
      style={{ backgroundColor: tokens.primary, color: tokens.inkOnPrimary }}
      aria-hidden="true"
    >
      {initials || 'A'}
    </span>
  );
}
