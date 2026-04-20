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
  /**
   * Effective logo URL — either the uploaded asset (preferred when
   * present) or the externally-hosted `brandLogoUrl`. Parents only ever
   * see this combined value; staff branding splits the two on the admin
   * surface so they can keep both around.
   */
  logoUrl: string | null;
  /** Externally hosted, free-form logo URL (legacy v1 surface). */
  externalLogoUrl: string | null;
  /** True when the tenant has uploaded a logo asset via Brand Admin v1.1. */
  hasUploadedLogo: boolean;
  welcomeTitle: string | null;
  welcomeMessage: string | null;
  /**
   * Contrast advisory for the staff-side brand admin so they understand
   * whether their colour choices stay readable in the portal. The portal
   * itself always picks a readable ink colour automatically (see
   * resolveBrandingTokens) — this advisory is purely a UX hint.
   */
  contrast: {
    primaryInk: 'light' | 'dark';
    accentInk: 'light' | 'dark';
    primaryRatio: number;
    accentRatio: number;
    primaryReadable: boolean;
    accentReadable: boolean;
  };
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
