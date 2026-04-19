import { createContext, useContext } from 'react';
import type { TenantBrandingPayload } from './domain-types';

/**
 * Parent Portal & Tenant Branding Foundation v1 — controlled brand context.
 *
 * This context only carries the small set of brand fields the portal renders
 * per club (display name, optional logo, primary + accent color, optional
 * welcome copy). Layout, typography, spacing, component structure, and
 * accessibility rules stay shared across all tenants and are not brandable
 * here on purpose.
 */
export const DEFAULT_PORTAL_PRIMARY = '#0d4a3c';
export const DEFAULT_PORTAL_ACCENT = '#1f8f6b';

export type PortalBrandingContextValue = {
  branding: TenantBrandingPayload | null;
  setBranding: (next: TenantBrandingPayload | null) => void;
};

export const PortalBrandingContext = createContext<PortalBrandingContextValue>({
  branding: null,
  setBranding: () => undefined,
});

export function usePortalBranding(): PortalBrandingContextValue {
  return useContext(PortalBrandingContext);
}

const HEX = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function hexToRgb(value: string): { r: number; g: number; b: number } | null {
  if (!HEX.test(value)) return null;
  const cleaned = value.slice(1, 7);
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function pickReadableInk(background: string): string {
  const rgb = hexToRgb(background);
  if (!rgb) return '#0f1f1a';
  // WCAG-style readable choice between dark ink and pure white. We bias
  // toward the dark ink because pure white over light brand colors hurts
  // accessibility, and we want to keep the calm, trustworthy feel.
  return relativeLuminance(rgb) > 0.55 ? '#0f1f1a' : '#ffffff';
}

export function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

export type PortalBrandingTokens = {
  primary: string;
  accent: string;
  primarySoft: string;
  accentSoft: string;
  inkOnPrimary: string;
  inkOnAccent: string;
  ringSoft: string;
  surfaceWash: string;
};

export function resolveBrandingTokens(
  branding: TenantBrandingPayload | null | undefined,
): PortalBrandingTokens {
  const primary = branding?.primaryColor || DEFAULT_PORTAL_PRIMARY;
  const accent = branding?.accentColor || DEFAULT_PORTAL_ACCENT;
  return {
    primary,
    accent,
    primarySoft: withAlpha(primary, 0.08),
    accentSoft: withAlpha(accent, 0.12),
    inkOnPrimary: pickReadableInk(primary),
    inkOnAccent: pickReadableInk(accent),
    ringSoft: withAlpha(primary, 0.18),
    surfaceWash: withAlpha(accent, 0.05),
  };
}
