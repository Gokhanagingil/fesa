# Athlete Photo & Media Foundation v1

Wave 16 introduces a small, deliberate media boundary so amateur clubs can give
athletes a real face on the platform without dragging in a full DAM. The
capability is intentionally narrow: a single profile photo per athlete, with
calm UX, tenant-safe storage, and an extensible service-layer surface that can
later cover other media types (coach photo, team crest, inventory image)
without rethinking the rules.

## What v1 includes

- **Athlete profile photo** — upload, replace, and remove from the athlete
  detail page.
- **Tenant-isolated storage** on disk under
  `<MEDIA_STORAGE_ROOT>/<tenantId>/athletes/<athleteId>/<uuid>.<ext>`.
- **Server-side validation** of file type and size before anything is written.
- **Reusable `<AthleteAvatar />`** component that renders the current photo or
  a soft initials placeholder.
- **List + detail surfaces** show the avatar where recognition helps (athletes
  list, athlete detail header, athlete photo card).

## What v1 explicitly does *not* include

- No general media library / DAM.
- No cropping, filters, or image transformations.
- No version history (replace is destructive on purpose — clubs need one
  trustworthy current photo, not a CMS).
- No public/anonymous photo URLs (every read still goes through the API and
  the tenant guard).
- No HEIC/HEIF support yet (browsers still need a transcoder for those).

## File rules

| Rule | Value |
|------|-------|
| Allowed mime types | `image/jpeg`, `image/png`, `image/webp`, `image/gif` |
| Max upload size | 5 MB |
| Storage path | `<MEDIA_STORAGE_ROOT>/<tenantId>/athletes/<athleteId>/<uuid>.<ext>` |
| Default storage root | `<cwd>/storage/media` (override with `MEDIA_STORAGE_ROOT`) |

Validation lives in `MediaStorageService` and is called from the controller
before persistence. Errors come back as calm, human-readable messages
(`"Use a JPG, PNG, WEBP, or GIF image."`, `"Photo is larger than 5 MB. Try a
smaller image."`) so the UI can surface them as-is.

## API surface

All endpoints are scoped by the standard `TenantGuard` and use the
`X-Tenant-Id` header (or the active staff session's default tenant).

| Method | Path | Purpose |
|--------|------|---------|
| `POST`   | `/api/athletes/:id/photo` | Upload or replace the current photo (multipart `file` field). Returns the updated athlete row, including `photoUploadedAt`. Replacing is destructive and unlinks the previous file. |
| `DELETE` | `/api/athletes/:id/photo` | Remove the current photo, unlink the file, and clear the photo columns. |
| `GET`    | `/api/athletes/:id/photo` | Stream the current photo (private, immutable cache for 24 hours). 404 when no photo is stored. |

The photo image URL surfaced to the frontend is constructed via
`buildAthletePhotoUrl(id, photoUploadedAt)` so the version timestamp is part
of the URL — replaces invalidate caches immediately without any custom cache
plumbing.

## Persistence model

The athletes table now carries the active photo descriptor on the row itself
(see `Wave16AthletePhotoMediaFoundation`). No separate media table is
introduced for v1 because we do not need history.

| Column | Purpose |
|--------|---------|
| `photoFileName` | Relative filename inside the per-(tenant, athlete) directory. |
| `photoContentType` | Validated mime, used for `Content-Type` on read. |
| `photoSizeBytes` | For UI display + safety guards. |
| `photoUploadedAt` | Drives cache busting and "last changed" copy. |

When v2 needs more (multiple photos, coach photos, inventory images, etc.) we
expand `MediaStorageService` with new scopes and add a dedicated table for the
ones that need history. The on-disk layout already accommodates other scopes
(`<tenantId>/<scope>/<ownerId>/...`).

## Tenant isolation

The storage layer treats tenant isolation as a hard invariant:

- Owner ids and tenant ids are validated against `^[A-Za-z0-9_-]+$` before
  joining them onto the storage root.
- The resolved absolute path is asserted to remain inside the storage root —
  any path traversal returns immediately with a 400.
- Reads also re-resolve the path through the same guard before piping the
  file, so a forged `athleteId` belonging to another tenant cannot leak the
  file (the database load via `findOne(tenantId, ...)` filters first).

A pure-Node smoke validates the rules without needing a database:

```bash
npm run media:isolation:test
```

## Mobile-friendly UX

The athlete photo card on the detail page is built around three patterns
that hold up on phones:

- One obvious primary action at a time (`Upload photo` becomes
  `Replace photo` once one exists).
- Comfortable tap targets and stacked actions on small screens.
- File input uses `accept="image/jpeg,image/png,image/webp,image/gif"` and
  `capture="environment"` so on mobile browsers the camera/gallery pickers
  show up naturally.

The avatar component falls back to soft initials when no photo is present, so
no broken-image icons or jarring placeholders appear anywhere in the UI.

## Operational notes

- The default storage root is `<cwd>/storage/media`. In production, point
  `MEDIA_STORAGE_ROOT` at a persistent volume so photos survive deploys.
- Add `storage/` to your container/host's persistent-data backups. The path
  is also included in `.gitignore`.
- The seed (`npm run seed:demo`) does not ship any photos — fresh tenants
  show the initials placeholder until staff upload a photo.
