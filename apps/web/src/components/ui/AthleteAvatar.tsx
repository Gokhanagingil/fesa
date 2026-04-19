import clsx from 'clsx';
import { useState } from 'react';
import type { Athlete } from '../../lib/domain-types';
import { getPersonName } from '../../lib/display';
import { buildAthletePhotoUrl } from '../../lib/athlete-photo';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASS: Record<Size, string> = {
  xs: 'h-7 w-7 text-[10px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-20 w-20 text-lg',
  xl: 'h-28 w-28 text-2xl',
};

export type AthleteAvatarProps = {
  athlete: Pick<Athlete, 'id' | 'firstName' | 'lastName' | 'preferredName' | 'photoFileName' | 'photoUploadedAt'>;
  size?: Size;
  className?: string;
  /** Override the photo URL used when an image is available (mostly for tests / seeds). */
  src?: string | null;
};

/**
 * Wave 16 — calm, reusable athlete avatar.
 *
 * Renders the current profile photo when one is stored, or a soft initials
 * placeholder when not.  The photo URL is constructed with a cache-busting
 * `v=<photoUploadedAt>` query so a freshly uploaded photo replaces the
 * previous one immediately without stale browser caching.
 */
export function AthleteAvatar({ athlete, size = 'md', className, src }: AthleteAvatarProps) {
  const [errored, setErrored] = useState(false);
  const url =
    src !== undefined
      ? src
      : athlete.photoFileName
        ? buildAthletePhotoUrl(athlete.id, athlete.photoUploadedAt)
        : null;

  const initials = getInitials(athlete);
  const showImage = Boolean(url) && !errored;

  return (
    <span
      className={clsx(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-amateur-canvas font-semibold text-amateur-ink ring-1 ring-inset ring-amateur-border',
        SIZE_CLASS[size],
        className,
      )}
      aria-label={getPersonName(athlete)}
    >
      {showImage && url ? (
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => setErrored(true)}
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}

function getInitials(athlete: AthleteAvatarProps['athlete']): string {
  const first = (athlete.preferredName?.trim() || athlete.firstName || '').trim();
  const last = (athlete.lastName || '').trim();
  const a = first ? first[0] : '';
  const b = last ? last[0] : '';
  const initials = `${a}${b}`.toUpperCase();
  return initials || '·';
}
