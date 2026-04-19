import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../lib/api';
import type { Athlete } from '../../lib/domain-types';
import { Button } from '../ui/Button';
import { InlineAlert } from '../ui/InlineAlert';
import { AthleteAvatar } from '../ui/AthleteAvatar';

type AthletePhotoCardProps = {
  athlete: Athlete;
  onChanged: (athlete: Athlete) => void;
};

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Wave 16 — Athlete Photo & Media Foundation v1.
 *
 * Calm, single-purpose card that lets staff upload, replace, or remove the
 * current athlete profile photo from any device.  Designed to feel light:
 * one obvious primary action at a time, no scary technical wording, and
 * mobile-friendly tap targets.
 */
export function AthletePhotoCard({ athlete, onChanged }: AthletePhotoCardProps) {
  const { t } = useTranslation();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hasPhoto = Boolean(athlete.photoFileName);
  const busy = uploading || removing;

  function pickFile() {
    if (busy) return;
    setError(null);
    fileInput.current?.click();
  }

  async function handleFile(file: File) {
    if (!file) return;
    setError(null);
    setSuccess(null);

    if (!ACCEPT.split(',').includes(file.type)) {
      setError(t('pages.athletes.photo.errorType'));
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(t('pages.athletes.photo.errorSize'));
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/athletes/${athlete.id}/photo`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
        headers: tenantHeader(),
      });
      if (!res.ok) {
        throw new ApiError(res.status, await readErrorMessage(res));
      }
      const updated = (await res.json()) as Athlete;
      onChanged(updated);
      setSuccess(
        hasPhoto
          ? t('pages.athletes.photo.replaceSuccess')
          : t('pages.athletes.photo.uploadSuccess'),
      );
    } catch (e) {
      setError(
        e instanceof ApiError && e.message
          ? e.message
          : t('pages.athletes.photo.errorGeneric'),
      );
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function handleRemove() {
    if (!hasPhoto || busy) return;
    setError(null);
    setSuccess(null);
    setRemoving(true);
    try {
      const res = await fetch(`/api/athletes/${athlete.id}/photo`, {
        method: 'DELETE',
        credentials: 'include',
        headers: tenantHeader(),
      });
      if (!res.ok) {
        throw new ApiError(res.status, await readErrorMessage(res));
      }
      const updated = (await res.json()) as Athlete;
      onChanged(updated);
      setSuccess(t('pages.athletes.photo.removeSuccess'));
    } catch (e) {
      setError(
        e instanceof ApiError && e.message
          ? e.message
          : t('pages.athletes.photo.errorGeneric'),
      );
    } finally {
      setRemoving(false);
    }
  }

  return (
    <section
      aria-label={t('pages.athletes.photo.sectionLabel')}
      className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm"
    >
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:gap-5 sm:text-left">
        <AthleteAvatar athlete={athlete} size="xl" />
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amateur-accent">
            {t('pages.athletes.photo.eyebrow')}
          </p>
          <h3 className="mt-1 font-display text-lg font-semibold text-amateur-ink">
            {hasPhoto
              ? t('pages.athletes.photo.titleWithPhoto')
              : t('pages.athletes.photo.titleEmpty')}
          </h3>
          <p className="mt-2 text-sm text-amateur-muted">
            {hasPhoto
              ? t('pages.athletes.photo.hintWithPhoto')
              : t('pages.athletes.photo.hintEmpty')}
          </p>
          <p className="mt-2 text-xs text-amateur-muted">
            {t('pages.athletes.photo.constraints')}
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
            <Button
              type="button"
              onClick={pickFile}
              disabled={busy}
              aria-label={hasPhoto ? t('pages.athletes.photo.replace') : t('pages.athletes.photo.upload')}
            >
              {uploading
                ? t('pages.athletes.photo.uploading')
                : hasPhoto
                  ? t('pages.athletes.photo.replace')
                  : t('pages.athletes.photo.upload')}
            </Button>
            {hasPhoto ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => void handleRemove()}
                disabled={busy}
                aria-label={t('pages.athletes.photo.remove')}
              >
                {removing ? t('pages.athletes.photo.removing') : t('pages.athletes.photo.remove')}
              </Button>
            ) : null}
          </div>

          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />

          {error ? (
            <InlineAlert tone="error" className="mt-3">
              {error}
            </InlineAlert>
          ) : null}
          {!error && success ? (
            <InlineAlert tone="success" className="mt-3">
              {success}
            </InlineAlert>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function tenantHeader(): HeadersInit {
  const tenantId = localStorage.getItem('amateur.tenantId');
  return tenantId ? { 'X-Tenant-Id': tenantId } : {};
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: unknown };
    if (typeof body?.message === 'string') return body.message;
    if (Array.isArray(body?.message)) return body.message.join(', ');
  } catch {
    /* ignore */
  }
  return res.statusText || 'Request failed';
}
