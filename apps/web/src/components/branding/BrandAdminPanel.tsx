import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, apiDelete, apiGet, apiPut } from '../../lib/api';
import type { TenantBrandingPayload } from '../../lib/domain-types';
import { useFeatureAvailability } from '../../lib/feature-availability';
import {
  resolveBrandingTokens,
} from '../../lib/portal-branding';
import { Button } from '../ui/Button';
import { InlineAlert } from '../ui/InlineAlert';
import { StatusBadge } from '../ui/StatusBadge';
import { FeatureAvailabilityNotice } from '../licensing/FeatureAvailabilityNotice';

/**
 * Parent Portal v1.1 — Brand Admin v1.1.
 *
 * A polished, controlled brand surface for staff. Keeps the same small
 * field set as Wave 17 (display name, tagline, two colours, logo,
 * welcome copy) but wraps it in:
 *
 *   - a calm, mobile-friendly form with friendly helper text and clamped
 *     character counters, so club operators don't need to know the API;
 *   - a "what parents will see" preview card on the right that re-renders
 *     immediately as fields change, including a faithful brand mark and
 *     greeting card mock-up;
 *   - a small contrast advisory that surfaces when the configured colour
 *     would be hard to read (using the API's WCAG ratio response);
 *   - a safe logo upload flow on top of the existing media foundation,
 *     preserving the option to point at an externally-hosted URL instead.
 *
 * The panel never mutates the live portal until the staff user clicks
 * Save (and the upload flow is the one exception — it commits immediately
 * because the file write is a discrete action and we want the preview to
 * reflect the real persisted asset).
 */
export function BrandAdminPanel({ tenantId }: { tenantId: string | null }) {
  const { t } = useTranslation();
  const [branding, setBranding] = useState<TenantBrandingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { availability: brandingAvailability } = useFeatureAvailability(
    'parent_portal.branding',
    tenantId,
  );
  const brandingAvailable = brandingAvailability?.available !== false;

  // Local form state — loaded from server, then edited locally until save.
  const [draft, setDraft] = useState({
    displayName: '',
    tagline: '',
    primaryColor: '#0d4a3c',
    accentColor: '#1f8f6b',
    externalLogoUrl: '',
    welcomeTitle: '',
    welcomeMessage: '',
  });

  const refresh = useCallback(async () => {
    if (!tenantId) {
      setBranding(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await apiGet<TenantBrandingPayload>('/api/tenant/branding');
      setBranding(next);
      setDraft({
        displayName: next.displayName ?? '',
        tagline: next.tagline ?? '',
        primaryColor: next.primaryColor || '#0d4a3c',
        accentColor: next.accentColor || '#1f8f6b',
        externalLogoUrl: next.externalLogoUrl ?? '',
        welcomeTitle: next.welcomeTitle ?? '',
        welcomeMessage: next.welcomeMessage ?? '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t, tenantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // The preview renders against the draft so staff see colour/text
  // changes without saving.
  const previewBranding = useMemo<TenantBrandingPayload | null>(() => {
    if (!branding) return null;
    return {
      ...branding,
      displayName: draft.displayName || branding.tenantName,
      tagline: draft.tagline || null,
      primaryColor: isValidHex(draft.primaryColor) ? draft.primaryColor : branding.primaryColor,
      accentColor: isValidHex(draft.accentColor) ? draft.accentColor : branding.accentColor,
      welcomeTitle: draft.welcomeTitle || null,
      welcomeMessage: draft.welcomeMessage || null,
      externalLogoUrl: draft.externalLogoUrl || null,
      logoUrl: branding.hasUploadedLogo ? branding.logoUrl : draft.externalLogoUrl || null,
    };
  }, [branding, draft]);

  const tokens = useMemo(() => resolveBrandingTokens(previewBranding), [previewBranding]);

  const saveProfile = async () => {
    if (!tenantId) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, string | null> = {
        displayName: draft.displayName.trim() || null,
        tagline: draft.tagline.trim() || null,
        primaryColor: draft.primaryColor.trim() || null,
        accentColor: draft.accentColor.trim() || null,
        logoUrl: draft.externalLogoUrl.trim() || null,
        welcomeTitle: draft.welcomeTitle.trim() || null,
        welcomeMessage: draft.welcomeMessage.trim() || null,
      };
      const next = await apiPut<TenantBrandingPayload>('/api/tenant/branding', payload);
      setBranding(next);
      setSavedAt(Date.now());
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : t('app.errors.saveFailed'),
      );
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File) => {
    setLogoBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/tenant/branding/logo', {
        method: 'POST',
        body: form,
        headers: tenantId ? { 'X-Tenant-Id': tenantId } : undefined,
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? t('app.errors.saveFailed'));
      }
      const next = (await res.json()) as TenantBrandingPayload;
      setBranding(next);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('app.errors.saveFailed'));
    } finally {
      setLogoBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeLogo = async () => {
    if (!tenantId) return;
    setLogoBusy(true);
    setError(null);
    try {
      await apiDelete('/api/tenant/branding/logo');
      await refresh();
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('app.errors.saveFailed'));
    } finally {
      setLogoBusy(false);
    }
  };

  if (!tenantId) {
    return (
      <InlineAlert tone="info">{t('pages.brandAdmin.noTenant')}</InlineAlert>
    );
  }

  if (loading && !branding) {
    return <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>;
  }

  const contrast = branding?.contrast;
  const showPrimaryWarning = contrast && !contrast.primaryReadable;
  const showAccentWarning = contrast && !contrast.accentReadable;

  return (
    <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold text-amateur-ink">
            {t('pages.brandAdmin.title')}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-amateur-muted">
            {t('pages.brandAdmin.subtitle')}
          </p>
        </div>
        {savedAt ? (
          <StatusBadge tone="success">{t('pages.brandAdmin.savedJustNow')}</StatusBadge>
        ) : null}
      </div>

      {error ? (
        <InlineAlert tone="error" className="mt-4">
          {error}
        </InlineAlert>
      ) : null}

      <FeatureAvailabilityNotice
        availability={brandingAvailability}
        className="mt-4"
      />

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="space-y-4">
          <FieldSection title={t('pages.brandAdmin.identityTitle')} hint={t('pages.brandAdmin.identityHint')}>
            <LabeledInput
              label={t('pages.brandAdmin.displayName')}
              value={draft.displayName}
              onChange={(value) => setDraft((d) => ({ ...d, displayName: value }))}
              maxLength={160}
              placeholder={branding?.tenantName ?? ''}
              hint={t('pages.brandAdmin.displayNameHint')}
            />
            <LabeledInput
              label={t('pages.brandAdmin.tagline')}
              value={draft.tagline}
              onChange={(value) => setDraft((d) => ({ ...d, tagline: value }))}
              maxLength={200}
              placeholder={t('pages.brandAdmin.taglinePlaceholder')}
              hint={t('pages.brandAdmin.taglineHint')}
            />
          </FieldSection>

          <FieldSection title={t('pages.brandAdmin.colorsTitle')} hint={t('pages.brandAdmin.colorsHint')}>
            <ColorField
              label={t('pages.brandAdmin.primary')}
              value={draft.primaryColor}
              onChange={(value) => setDraft((d) => ({ ...d, primaryColor: value }))}
              warning={showPrimaryWarning ? t('pages.brandAdmin.contrastWarning') : null}
              ratio={contrast?.primaryRatio ?? null}
            />
            <ColorField
              label={t('pages.brandAdmin.accent')}
              value={draft.accentColor}
              onChange={(value) => setDraft((d) => ({ ...d, accentColor: value }))}
              warning={showAccentWarning ? t('pages.brandAdmin.contrastWarning') : null}
              ratio={contrast?.accentRatio ?? null}
            />
            <p className="text-xs text-amateur-muted">
              {t('pages.brandAdmin.contrastHelp')}
            </p>
          </FieldSection>

          <FieldSection title={t('pages.brandAdmin.logoTitle')} hint={t('pages.brandAdmin.logoHint')}>
            <div className="flex items-center gap-3">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-amateur-border bg-amateur-canvas"
                style={{ backgroundColor: branding?.hasUploadedLogo ? undefined : tokens.primary }}
                aria-hidden="true"
              >
                {branding?.logoUrl ? (
                  <img
                    src={cacheBust(branding.logoUrl, branding.updatedAt)}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span
                    className="font-display text-base font-semibold"
                    style={{ color: tokens.inkOnPrimary }}
                  >
                    {(draft.displayName || branding?.tenantName || 'A').slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadLogo(file);
                  }}
                />
                <Button
                  type="button"
                  variant="primary"
                  disabled={logoBusy || !brandingAvailable}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {logoBusy
                    ? t('pages.brandAdmin.logoUploading')
                    : branding?.hasUploadedLogo
                      ? t('pages.brandAdmin.logoReplace')
                      : t('pages.brandAdmin.logoUpload')}
                </Button>
                {branding?.hasUploadedLogo ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={logoBusy || !brandingAvailable}
                    onClick={() => void removeLogo()}
                  >
                    {t('pages.brandAdmin.logoRemove')}
                  </Button>
                ) : null}
              </div>
            </div>
            <p className="text-xs text-amateur-muted">{t('pages.brandAdmin.logoConstraints')}</p>
            <LabeledInput
              label={t('pages.brandAdmin.externalLogo')}
              value={draft.externalLogoUrl}
              onChange={(value) => setDraft((d) => ({ ...d, externalLogoUrl: value }))}
              maxLength={512}
              placeholder="https://"
              hint={t('pages.brandAdmin.externalLogoHint')}
              type="url"
            />
          </FieldSection>

          <FieldSection title={t('pages.brandAdmin.welcomeTitle')} hint={t('pages.brandAdmin.welcomeHint')}>
            <LabeledInput
              label={t('pages.brandAdmin.welcomeHeadline')}
              value={draft.welcomeTitle}
              onChange={(value) => setDraft((d) => ({ ...d, welcomeTitle: value }))}
              maxLength={160}
              placeholder={t('pages.brandAdmin.welcomeHeadlinePlaceholder')}
            />
            <LabeledTextarea
              label={t('pages.brandAdmin.welcomeMessage')}
              value={draft.welcomeMessage}
              onChange={(value) => setDraft((d) => ({ ...d, welcomeMessage: value }))}
              maxLength={400}
              placeholder={t('pages.brandAdmin.welcomeMessagePlaceholder')}
              rows={3}
            />
          </FieldSection>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-xs text-amateur-muted">{t('pages.brandAdmin.guardrailNote')}</p>
            <Button
              type="button"
              onClick={() => void saveProfile()}
              disabled={saving || !brandingAvailable}
            >
              {saving ? t('pages.brandAdmin.saving') : t('pages.brandAdmin.save')}
            </Button>
          </div>
        </div>

        <div className="lg:sticky lg:top-4">
          <BrandPreviewCard branding={previewBranding} />
        </div>
      </div>
    </section>
  );
}

function FieldSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
      <h3 className="font-display text-sm font-semibold text-amateur-ink">{title}</h3>
      {hint ? <p className="mt-1 text-xs text-amateur-muted">{hint}</p> : null}
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  maxLength,
  placeholder,
  hint,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  placeholder?: string;
  hint?: string;
  type?: 'text' | 'url';
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 flex items-center justify-between text-xs font-medium text-amateur-muted">
        <span>{label}</span>
        {maxLength ? (
          <span className="tabular-nums">{value.length}/{maxLength}</span>
        ) : null}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        className="w-full rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-ink shadow-sm placeholder:text-amateur-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amateur-accent"
      />
      {hint ? <p className="mt-1 text-[11px] text-amateur-muted">{hint}</p> : null}
    </label>
  );
}

function LabeledTextarea({
  label,
  value,
  onChange,
  maxLength,
  placeholder,
  rows,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  maxLength?: number;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 flex items-center justify-between text-xs font-medium text-amateur-muted">
        <span>{label}</span>
        {maxLength ? (
          <span className="tabular-nums">{value.length}/{maxLength}</span>
        ) : null}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        rows={rows ?? 3}
        className="w-full rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-ink shadow-sm placeholder:text-amateur-muted/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amateur-accent"
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
  warning,
  ratio,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  warning: string | null;
  ratio: number | null;
}) {
  const valid = isValidHex(value);
  return (
    <div>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={valid ? value : '#0d4a3c'}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-12 cursor-pointer rounded-xl border border-amateur-border bg-amateur-surface"
          aria-label={label}
        />
        <div className="flex-1">
          <span className="mb-1 block text-xs font-medium text-amateur-muted">{label}</span>
          <input
            type="text"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            maxLength={9}
            className="w-full rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 font-mono text-sm uppercase tracking-wide text-amateur-ink shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amateur-accent"
          />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-amateur-muted">
        {ratio != null ? <span>{`Contrast ${ratio.toFixed(2)}:1`}</span> : null}
        {!valid ? <StatusBadge tone="warning">Use a 6-digit hex like #0d4a3c</StatusBadge> : null}
        {warning ? <StatusBadge tone="warning">{warning}</StatusBadge> : null}
      </div>
    </div>
  );
}

function BrandPreviewCard({ branding }: { branding: TenantBrandingPayload | null }) {
  const { t } = useTranslation();
  const tokens = resolveBrandingTokens(branding);
  if (!branding) return null;
  return (
    <div className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
      <h3 className="font-display text-sm font-semibold text-amateur-ink">
        {t('pages.brandAdmin.previewTitle')}
      </h3>
      <p className="mt-1 text-xs text-amateur-muted">{t('pages.brandAdmin.previewHint')}</p>

      <div className="mt-4 overflow-hidden rounded-2xl border border-amateur-border bg-amateur-surface">
        <div
          className="flex items-center gap-3 px-4 py-4"
          style={{
            backgroundImage: `linear-gradient(135deg, ${tokens.primarySoft} 0%, transparent 80%)`,
          }}
        >
          <span
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl"
            style={{ backgroundColor: tokens.primary, color: tokens.inkOnPrimary }}
          >
            {branding.logoUrl ? (
              <img
                src={cacheBust(branding.logoUrl, branding.updatedAt)}
                alt=""
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="font-display text-base font-semibold">
                {(branding.displayName || branding.tenantName || 'A').slice(0, 2).toUpperCase()}
              </span>
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-wide text-amateur-muted">
              {t('pages.brandAdmin.previewBadge')}
            </p>
            <p className="font-display text-base font-semibold" style={{ color: tokens.primary }}>
              {branding.displayName || branding.tenantName}
            </p>
            {branding.tagline ? (
              <p className="text-xs text-amateur-muted">{branding.tagline}</p>
            ) : null}
          </div>
        </div>
        <div className="space-y-3 px-4 py-4">
          <p className="font-display text-sm font-semibold text-amateur-ink">
            {branding.welcomeTitle ?? t('pages.brandAdmin.previewWelcomeFallback')}
          </p>
          <p className="text-xs text-amateur-muted">
            {branding.welcomeMessage ?? t('pages.brandAdmin.previewMessageFallback')}
          </p>
          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-3 py-1 text-[11px] font-semibold"
              style={{ backgroundColor: tokens.primarySoft, color: tokens.primary }}
            >
              {t('pages.brandAdmin.previewPill')}
            </span>
            <span
              className="rounded-full px-3 py-1 text-[11px] font-semibold"
              style={{ backgroundColor: tokens.accentSoft, color: tokens.primary }}
            >
              {t('pages.brandAdmin.previewPillSecondary')}
            </span>
          </div>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-amateur-muted">{t('pages.brandAdmin.previewFooter')}</p>
    </div>
  );
}

function isValidHex(value: string): boolean {
  return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value);
}

function cacheBust(url: string, version: string | null | undefined): string {
  if (!version) return url;
  const ts = Date.parse(version);
  if (!Number.isFinite(ts)) return url;
  return url.includes('?') ? `${url}&_v=${ts}` : `${url}?_v=${ts}`;
}
