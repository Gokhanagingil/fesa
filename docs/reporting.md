# Reporting and bulk operations (foundation)

## Goals for later waves

- First-class **report definitions** (metadata, versioning, scheduling).
- **Saved filters** reusable across lists and reports.
- **Export-ready lists**: consistent toolbar (search, filters, export, bulk) on list pages.
- **Bulk actions** executed asynchronously with idempotency and audit logs.

## What exists now

### Shared types (`packages/shared-types`)

- `ReportDefinitionMeta`, `SavedFilterPreset`, `BulkActionRequest` — structural placeholders for API and UI contracts.

### Backend

- Entities: `report_definitions`, `saved_filter_presets` (minimal columns).
- `GET /api/reporting/definitions` — placeholder response until registry is populated.

### Frontend

- `ListPageFrame` — search placeholder + toolbar area for filter/export/bulk buttons.
- List pages use **disabled** toolbar actions to show intent without fake workflows.

## Conventions

- **Report keys**: stable `key` column + `titleKey` for i18n (not free-form titles in DB for user-facing labels).
- **Saved filters**: `surface` identifies which list/report the payload applies to; validation per surface in later waves.
- **Bulk actions**: `BulkActionKind` enum will grow; execution layer not implemented in wave one.
