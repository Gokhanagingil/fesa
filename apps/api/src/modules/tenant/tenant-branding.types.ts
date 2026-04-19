/**
 * Parent Portal & Tenant Branding Foundation v1.
 *
 * Branding is a small, controlled surface so each club can feel like itself
 * in the parent portal without degrading product quality. Layout, typography,
 * spacing, component structure, and accessibility rules stay shared across
 * all tenants and are deliberately NOT brandable.
 */
export type TenantBrandingPayload = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  displayName: string;
  tagline: string | null;
  primaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  welcomeTitle: string | null;
  welcomeMessage: string | null;
  isCustomized: boolean;
  updatedAt: string | null;
};

export type TenantBrandingInput = {
  displayName?: string | null;
  tagline?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  logoUrl?: string | null;
  welcomeTitle?: string | null;
  welcomeMessage?: string | null;
};

/** Default amateur palette so unbranded tenants still render trustworthy. */
export const DEFAULT_BRAND_PRIMARY = '#0d4a3c';
export const DEFAULT_BRAND_ACCENT = '#1f8f6b';
