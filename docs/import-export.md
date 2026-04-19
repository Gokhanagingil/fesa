# Import / Export & Bulk Operations Foundation

This page describes the first release of the import / export and bulk
operations capability. The intent is operational: help clubs move existing
data into the platform with confidence, pull practical lists back out, and act
on many records at once without repeated clicking.

This is **not** an enterprise ETL or admin console. The goal is to feel
significantly easier than spreadsheet chaos while staying warm and guided.

## What ships today

| Area | Shape |
|------|-------|
| **Import wizard** | Guided CSV import for **athletes, guardians, athlete↔guardian links and groups** with paste-or-upload, auto column mapping, preview, validation, and explicit commit. |
| **Bulk selection** | One reusable `BulkActionBar` component shared across the athletes, guardians, inventory and **training sessions** surfaces. Patterns: select one, select visible, deselect visible, clear selection, visible selected count. On phones the bar also shows a calm sticky reach-friendly footer once a selection exists. |
| **Bulk actions** | Athletes — bulk lifecycle update, export selection, **prepare message (deep-link into the communications hub)**. Guardians — bulk delete (linked guardians are protected) + export selection. Inventory — bulk return all active assignments on an item. Training sessions — bulk cancel / shift + export selection through the shared bar. |
| **Practical exports** | "Export visible (CSV)" on athletes, guardians, inventory, **training sessions** and **athlete charges** list pages. The reporting engine still owns deep export from Report Builder. |
| **Import templates** | `GET /api/imports/template?entity=…` returns a CSV with the supported column headers and two filled sample rows. |
| **Import history (on-device)** | Successful commits are recorded per tenant in browser storage so staff can see "what we last brought in" without us having to operate a server-side audit log. Capped to the most recent ten entries. |

The capability is wired into the existing sidebar as **Import / Export**
(`/app/imports`).

## Importable entities

Each entity has an explicit, small column contract. New columns are a
one-place change in `apps/api/src/modules/imports/import-definitions.ts` plus
the corresponding handler in `imports.service.ts`. There is no generic
schema-mapping engine.

### Athletes (`athletes`)

| Field | Required | Notes |
|-------|----------|-------|
| `firstName` | yes | |
| `lastName` | yes | |
| `preferredName` | no | |
| `birthDate` | no | Accepts `YYYY-MM-DD` or `DD/MM/YYYY`. |
| `gender` | no | Free-form to support club vocabulary. |
| `sportBranch` | yes (or default) | Branch name or short code. The wizard also exposes a "default sport branch" picker so single-branch clubs can leave the column blank. |
| `primaryGroup` | no | Group must already exist in the chosen sport branch. Missing groups produce a warning, not an error. |
| `status` | no | One of `trial · active · paused · inactive · archived`. Defaults to `active`. |
| `jerseyNumber` | no | |
| `notes` | no | Truncated at 500 characters. |

Existing athletes (case-insensitive name match) are **skipped**, never
overwritten — clubs can update them through the existing UI.

### Guardians (`guardians`)

| Field | Required | Notes |
|-------|----------|-------|
| `firstName` | yes | |
| `lastName` | yes | |
| `phone` | no | Cleaned to digits + `+`. |
| `email` | no | Lightly validated; bad addresses become warnings, not errors. |
| `notes` | no | |

Existing guardians (matched by name + phone or email) are **updated** in
place. Unmatched guardians are created.

### Athlete ↔ guardian links (`athlete_guardians`)

| Field | Required | Notes |
|-------|----------|-------|
| `athleteFirstName` / `athleteLastName` | yes | Athlete must already exist in the club. |
| `guardianFirstName` / `guardianLastName` | yes | Guardian must already exist. |
| `relationshipType` | yes | One of `mother · father · guardian · other`. |
| `isPrimaryContact` | no | `true` / `false` / `yes` / `no` / `evet` / `hayır`. Setting to true clears the existing primary contact for the athlete. |
| `notes` | no | |

Existing links are updated in place; new links are created.

### Groups (`groups`)

| Field | Required | Notes |
|-------|----------|-------|
| `name` | yes | Group label as staff use it (e.g. `U10 Basketball`). |
| `sportBranch` | yes | Branch name or short code; must already exist. |
| `headCoachName` | no | Matches an existing coach by full name (or preferred name). Unknown names produce a warning, not an error, and the group is created without a head coach. |

Existing groups in the same sport branch (case-insensitive name match) are
**skipped** so re-running the import is safe.

## Wizard flow

1. **Pick entity** — three calm cards.
2. **Download template** — optional but recommended.
3. **Paste CSV or upload a file** — both work. The first row must be a header.
4. **Auto-map columns** — alias-aware (English + Turkish).
5. **Preview validation** — every row gets a label, an outcome
   (`create` / `update` / `skip` / `reject`), and any field-level issues.
6. **Commit** — only enabled when no row is rejected and all required columns
   are mapped.
7. **Done** — completion banner reports created / updated / skipped counts.

Tenant isolation is enforced unconditionally inside `ImportsService` using
`req.tenantId` (resolved by `TenantGuard`).

## Bulk selection pattern

`BulkActionBar` is the single coherent surface for bulk affordances. It
exposes:

- `selectVisible` / `deselectVisible`
- `clearSelection`
- `selectedCount` chip
- a slot for entity-specific action buttons (apply, export, delete, …)

The bar stays compact when nothing is selected and expands once the staff
member starts a selection. Confirmations live on the action button itself
through the `confirm` field of `BulkActionDescriptor`.

## Bulk actions

| Surface | Action | Safety |
|---------|--------|--------|
| Athletes | Apply lifecycle status / primary group move (existing endpoint, now driven by the shared bar) | Existing rules: team memberships outside the new primary group are ended; inactive / archived athletes have active team memberships ended. |
| Athletes | Prepare message | Hands the current selection to the communications hub via `?athleteIds=…&source=athletes_selection&primaryContactsOnly=true`. No server mutation. |
| Athletes | Export selection (CSV) | Local export of visible columns. |
| Guardians | Delete selection | Linked guardians are protected: with `skipLinked=true` they are silently skipped; otherwise the whole batch fails fast. |
| Guardians | Export selection (CSV) | Local export. |
| Inventory | Return all active assignments on an item | Re-uses the existing `returnAssignment` flow per row; idempotent on already-closed assignments. |
| Inventory | Export visible items (CSV) | Local export. |
| Training sessions | Bulk cancel / shift planned sessions | Existing `/api/training-sessions/bulk` endpoint; only planned sessions are eligible. The shift action moves `scheduledStart` / `scheduledEnd` by the chosen number of days. |
| Training sessions | Export selection / Export visible (CSV) | Local export of visible columns. |
| Athlete charges | Export visible (CSV) | Local export of the currently filtered charges (athlete, charge item, amount, due date, status, outstanding). |

## Export behaviour

For v1 we standardise on **CSV with a UTF-8 BOM** so Turkish characters
render correctly in Excel. Two paths exist:

- **Local "Export visible" / "Export selection"** — driven by the tiny helpers
  in `apps/web/src/lib/imports.ts` (`renderCsvFromRows`, `downloadCsv`).
- **Reporting engine export** — unchanged. `/api/reporting/export` remains the
  authoritative path for filter-driven exports and is exposed through the
  Report Builder and embedded `DataExplorer` views on each list surface.

PDF is intentionally **deferred** for v1. CSV first-class is an honest fit
for the current scope.

## API surface (new)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/imports/definitions` | Lists entity definitions and field contracts for the wizard. |
| `GET` | `/api/imports/template?entity=<key>` | Returns the entity template as a CSV (UTF-8 BOM). |
| `POST` | `/api/imports/preview` | Validates a payload and returns a per-row report. Does **not** mutate any data. |
| `POST` | `/api/imports/commit` | Re-validates and, if safe, performs the import inside a single transaction. |
| `POST` | `/api/guardians/bulk-delete` | Deletes guardians by id; linked guardians are protected. |
| `POST` | `/api/inventory/assignments/bulk-return` | Returns the supplied active assignments to stock. |

All endpoints are protected by `TenantGuard`. Imports are capped at 500 rows
per batch on purpose — clubs that need more split the file.

## Validation

- `npm run lint` — ESLint, must pass with `--max-warnings 0`.
- `npm run build` — TypeScript + Nest + Vite.
- `npm run i18n:check` — locale parity, includes the new `pages.imports`,
  `app.bulk`, `app.exportCsv` prefixes and a few targeted bulk keys per page.
- `npm run frontend:smoke` — Vitest + Testing Library smoke suite. Now also
  protects the `ImportsPage` happy path through preview.
- `npm run reporting:starter-views:test`, `npm run reporting:filter-tree:test`
  — unchanged; remain green.

## Intentionally still deferred

- Importing teams, training schedules, finance items.
- **Server-side** import history (re-run / undo) and per-staff import audit
  trail. The current history is on-device (per browser, per tenant) and capped
  to ten entries.
- Bulk WhatsApp / email send from the bulk bar — the existing communication
  hub still owns audience assembly. The new "Prepare message" action on
  Athletes deep-links the selection into that hub.
- PDF exports.
- Server-side scheduled exports.
- Spreadsheet round-trip ("export → edit → re-import").
- Multi-tenant batch operations (everything stays inside the active club).
