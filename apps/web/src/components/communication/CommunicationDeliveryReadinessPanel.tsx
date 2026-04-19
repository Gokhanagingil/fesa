import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import { InlineAlert } from '../ui/InlineAlert';
import { StatusBadge } from '../ui/StatusBadge';
import {
  getCommunicationReadiness,
  saveWhatsAppReadiness,
  validateWhatsAppReadiness,
} from '../../lib/communication';
import { formatDateTime } from '../../lib/display';
import type {
  CommunicationReadinessResponse,
  WhatsAppReadinessSummary,
} from '../../lib/domain-types';

type Props = {
  tenantId: string | null;
  languageTag: string;
};

/**
 * CommunicationDeliveryReadinessPanel
 * -----------------------------------
 * Lightweight, club-friendly admin surface for the WhatsApp Cloud API
 * readiness model.  Shows the current mode, lets a club admin save the
 * configuration shape (without ever storing secrets), and exposes a
 * gentle readiness check.
 *
 * The panel is intentionally calm — it never claims real delivery, it
 * never surfaces raw provider errors, and assisted mode always remains
 * the documented fallback.
 */
export function CommunicationDeliveryReadinessPanel({ tenantId, languageTag }: Props) {
  const { t } = useTranslation();
  const [response, setResponse] = useState<CommunicationReadinessResponse | null>(null);
  const [summary, setSummary] = useState<WhatsAppReadinessSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [businessAccountId, setBusinessAccountId] = useState('');
  const [accessTokenRef, setAccessTokenRef] = useState('');
  const [displayPhoneNumber, setDisplayPhoneNumber] = useState('');

  const hydrateFromSummary = useCallback((next: WhatsAppReadinessSummary | null) => {
    setSummary(next);
    setEnabled(Boolean(next?.cloudApiEnabled));
    if (next?.displayPhoneNumber) {
      setDisplayPhoneNumber(next.displayPhoneNumber);
    }
    // Configured-only fields are kept locally; we never display the
    // saved values back as inputs to avoid implying we know the actual
    // secret material.  The "configured" booleans on the response
    // surface what is on file.
  }, []);

  const load = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getCommunicationReadiness('whatsapp');
      setResponse(res);
      hydrateFromSummary(res.whatsapp);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [hydrateFromSummary, t, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = useCallback(async () => {
    if (!tenantId) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const next = await saveWhatsAppReadiness({
        cloudApiEnabled: enabled,
        phoneNumberId: phoneNumberId.trim() || null,
        businessAccountId: businessAccountId.trim() || null,
        accessTokenRef: accessTokenRef.trim() || null,
        displayPhoneNumber: displayPhoneNumber.trim() || null,
      });
      hydrateFromSummary(next);
      setAccessTokenRef('');
      setPhoneNumberId('');
      setBusinessAccountId('');
      setNotice(t('pages.communications.delivery.config.saved'));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setSaving(false);
    }
  }, [
    accessTokenRef,
    businessAccountId,
    displayPhoneNumber,
    enabled,
    hydrateFromSummary,
    load,
    phoneNumberId,
    t,
    tenantId,
  ]);

  const handleValidate = useCallback(async () => {
    if (!tenantId) return;
    setValidating(true);
    setError(null);
    try {
      const next = await validateWhatsAppReadiness();
      hydrateFromSummary(next);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setValidating(false);
    }
  }, [hydrateFromSummary, load, t, tenantId]);

  if (!tenantId) {
    return null;
  }

  const stateKey = summary?.state ?? response?.whatsapp.state ?? 'not_configured';
  const stateLabel = t(`pages.communications.delivery.readiness.states.${stateKey}`, {
    defaultValue: stateKey,
  });
  const stateHint = t(`pages.communications.delivery.readiness.stateHints.${stateKey}`, {
    defaultValue: '',
  });
  const validatedAt = summary?.validation.validatedAt ?? null;

  return (
    <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-amateur-ink">
            {t('pages.communications.delivery.readiness.title')}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-amateur-muted">
            {t('pages.communications.delivery.readiness.hint')}
          </p>
        </div>
        <StatusBadge
          tone={
            stateKey === 'direct_capable'
              ? 'success'
              : stateKey === 'invalid' || stateKey === 'partial'
                ? 'warning'
                : 'default'
          }
        >
          {stateLabel}
        </StatusBadge>
      </div>

      {stateHint ? (
        <p className="mt-3 rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-muted">
          {stateHint}
        </p>
      ) : null}

      <p className="mt-2 text-xs text-amateur-muted">
        {t('pages.communications.delivery.readiness.fallbackNote')}
      </p>

      {error ? (
        <InlineAlert tone="error" className="mt-4">
          {error}
        </InlineAlert>
      ) : null}
      {notice ? (
        <InlineAlert tone="info" className="mt-4">
          {notice}
        </InlineAlert>
      ) : null}

      {summary?.issues.length ? (
        <ul className="mt-4 space-y-1 text-xs text-amateur-muted">
          {summary.issues.map((issue) => (
            <li key={issue} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-800">
              {t(`pages.communications.delivery.readiness.issues.${issue}`, { defaultValue: issue })}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
          <h3 className="font-display text-base font-semibold text-amateur-ink">
            {t('pages.communications.delivery.config.title')}
          </h3>
          <p className="mt-1 text-sm text-amateur-muted">
            {t('pages.communications.delivery.config.hint')}
          </p>
          <div className="mt-4 space-y-3">
            <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                disabled={loading || saving}
              />
              <span>{t('pages.communications.delivery.config.enabledLabel')}</span>
            </label>
            <p className="text-xs text-amateur-muted">
              {t('pages.communications.delivery.config.enabledHint')}
            </p>

            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pages.communications.delivery.config.phoneNumberIdLabel')}</span>
              <input
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                placeholder={t('pages.communications.delivery.config.phoneNumberIdPlaceholder')}
                className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                autoComplete="off"
              />
              {summary?.configured.phoneNumberId ? (
                <span className="text-[11px] text-emerald-700">●●●●</span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pages.communications.delivery.config.businessAccountIdLabel')}</span>
              <input
                value={businessAccountId}
                onChange={(e) => setBusinessAccountId(e.target.value)}
                placeholder={t('pages.communications.delivery.config.businessAccountIdPlaceholder')}
                className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                autoComplete="off"
              />
              {summary?.configured.businessAccountId ? (
                <span className="text-[11px] text-emerald-700">●●●●</span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pages.communications.delivery.config.accessTokenRefLabel')}</span>
              <input
                value={accessTokenRef}
                onChange={(e) => setAccessTokenRef(e.target.value)}
                placeholder={t('pages.communications.delivery.config.accessTokenRefPlaceholder')}
                className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                autoComplete="off"
              />
              <span className="text-[11px] text-amateur-muted">
                {t('pages.communications.delivery.config.accessTokenRefHint')}
              </span>
              {summary?.configured.accessTokenRef ? (
                <span className="text-[11px] text-emerald-700">●●●●</span>
              ) : null}
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pages.communications.delivery.config.displayPhoneNumberLabel')}</span>
              <input
                value={displayPhoneNumber}
                onChange={(e) => setDisplayPhoneNumber(e.target.value)}
                placeholder={t('pages.communications.delivery.config.displayPhoneNumberPlaceholder')}
                className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
              />
              <span className="text-[11px] text-amateur-muted">
                {t('pages.communications.delivery.config.displayPhoneNumberHint')}
              </span>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" onClick={() => void handleSave()} disabled={saving || loading}>
              {saving
                ? t('pages.communications.delivery.config.saving')
                : t('pages.communications.delivery.config.saveAction')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => void handleValidate()}
              disabled={validating || loading}
            >
              {validating
                ? t('pages.communications.delivery.config.validating')
                : t('pages.communications.delivery.config.validateAction')}
            </Button>
          </div>
          <p className="mt-3 text-xs text-amateur-muted">
            {validatedAt
              ? t('pages.communications.delivery.config.validatedAt', {
                  when: formatDateTime(validatedAt, languageTag),
                })
              : t('pages.communications.delivery.config.neverValidated')}
          </p>
        </div>

        <div className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
          <h3 className="font-display text-base font-semibold text-amateur-ink">
            {t('pages.communications.delivery.modeBadge.assisted')} ·{' '}
            {t('pages.communications.delivery.modeBadge.direct')}
          </h3>
          <p className="mt-1 text-sm text-amateur-muted">
            {t('pages.communications.delivery.modeHint.assisted')}
          </p>
          <p className="mt-2 text-sm text-amateur-muted">
            {t('pages.communications.delivery.modeHint.direct')}
          </p>
          {summary?.displayPhoneNumber ? (
            <p className="mt-3 rounded-lg border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-ink">
              {summary.displayPhoneNumber}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
