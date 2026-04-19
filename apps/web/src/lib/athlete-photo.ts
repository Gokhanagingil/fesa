/**
 * Wave 16 — helpers for the athlete photo surface.
 *
 * The photo URL embeds `photoUploadedAt` as a `v=` query parameter so a
 * freshly uploaded photo replaces the previous one immediately without
 * stale browser caching.  The route itself is tenant-scoped on the API
 * via the standard X-Tenant-Id header.
 */
export function buildAthletePhotoUrl(athleteId: string, photoUploadedAt?: string | null): string {
  const version = photoUploadedAt ? Date.parse(photoUploadedAt) : 0;
  return `/api/athletes/${athleteId}/photo${version ? `?v=${version}` : ''}`;
}
