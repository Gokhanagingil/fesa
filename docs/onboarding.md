# Club Onboarding Wizard + Import Templates

This page describes the **Club Onboarding Wizard**: a calm, guided way for
a club to move from spreadsheet-driven operations into the platform without
fear of doing something irreversible.

It is intentionally **not** a generic ETL platform or an admin-style
"upload-and-pray" form. The wizard reuses the existing
`apps/api/src/modules/imports/*` foundation (column contracts, preview /
validate / commit pipeline) and adds a guided step rail and a small set of
go-live confidence surfaces on top.

The current shape is:

- **v1 — Foundation**: step rail, per-step import flow, downloadable
  templates, dependency-aware ordering, optional vs required step
  discipline, go-live review surface.
- **v1.1 — Go-Live Confidence Pack** (Wave 19): server-side import
  history, per-step "last import" memory, an honest go-live readiness
  summary with soft warning signals, friendlier dependency diagnostics,
  and a calmer review surface.

## What ships in v1.1

| Area | Shape |
|------|-------|
| **Step rail** | Eleven calm steps in dependency order; each tile shows status (`not_started · in_progress · completed · needs_attention`) and the relative time of the last server-recorded import for that step. |
| **Per-step import flow** | Reuses `ImportFlow` (the same preview / validate / commit pipeline used by `/app/imports`). No duplicate import system. |
| **Downloadable templates** | One CSV template per importable step. UTF-8 BOM so Excel handles Turkish characters cleanly. |
| **Live progress banner** | "Welcome, {{name}}", `requiredCompleted / requiredTotal`, and a calm `fresh / in_progress / ready` state pill. |
| **Per-step "last import" card** | Inside the step panel, just above the upload card: a calm summary of when the step was last imported, by whom, the source filename, and the create/update/skip counts. |
| **Server-side history** | Every commit appends a single, deliberately small row to `import_batches` with the per-step counts, status, source label, and the staff member who triggered it. |
| **Recent imports strip** | The go-live review surfaces the most recent batches across the club so staff can answer "what did we last import, and did it land cleanly?". |
| **Go-live readiness summary** | Honest tone (`fresh / in_progress / almost_ready / ready`), required + optional step checklists, and soft warning signals (e.g. "athletes are loaded but no groups exist yet"). |
| **Dependency hints** | Each step explains which prior steps it assumes. Steps blocked by missing prerequisites render a calm warning. Row-level dependency errors point back to the responsible step in human language. |
| **Tenant isolation** | Reuses `TenantGuard`. Both `OnboardingService` and `ImportsService` only ever read / write inside `req.tenantId`, including the new `import_batches` table. |

The wizard sits at `/app/onboarding`. The classic `/app/imports` view is
still available for users who want a flat per-entity import surface, and
also writes to `import_batches`.

## Step order

The order reflects real onboarding dependencies, not just data-model
ordering:

1. **Club basics** — confirm display name, branding, and welcome copy.
2. **Sport branches** — everything else references these.
3. **Coaches** — depend on sport branches.
4. **Groups** — training cohorts; depend on sport branches.
5. **Teams** *(optional)* — competitive squads; depend on sport branches.
6. **Athletes** — sport branch required, primary group recommended.
7. **Guardians** — independent contact records.
8. **Athlete ↔ guardian links** — depend on athletes and guardians.
9. **Finance starter** *(optional)* — `charge_items` rows for dues, camps, etc.
10. **Inventory & stock** *(optional)* — kit catalogue with starting stock.
11. **Review & go live** — readiness summary + checklist + recent imports + quick links.

A step marked `optional` does not block `progress.state === 'ready'`.

## Importable entities and templates

`/api/imports/template?entity=<key>` returns CSV templates for **nine**
importable entities:

| Step / entity | Required fields |
|---------------|-----------------|
| `sport_branches` | `name`, `code` |
| `coaches` | `firstName`, `lastName`, `sportBranch` |
| `groups` | `name`, `sportBranch` |
| `teams` | `name`, `sportBranch` |
| `athletes` | `firstName`, `lastName`, `sportBranch` (or default) |
| `guardians` | `firstName`, `lastName` |
| `athlete_guardians` | athlete name × guardian name + `relationshipType` |
| `charge_items` | `name`, `category`, `defaultAmount`, `currency` |
| `inventory_items` | `name`, `category` |

Every template ships with two filled sample rows so staff can see the
expected shape before filling it in.

### Field types

`string`, `enum`, `date`, `email`, `phone`, `boolean`, `integer`,
`decimal` (decimal accepts both `1250.50` and `1250,50`).

## Commit semantics

The wizard is honest about what each step does. Commits are explicit:
the `Import these rows` button is disabled until preview is clean.

| Entity | Outcome behaviour |
|--------|-------------------|
| `sport_branches` | Match by name **or** code (case-insensitive). Existing rows are skipped. |
| `coaches` | Match by `firstName + lastName` (case-insensitive). Existing rows are skipped. |
| `teams` | Match by `name + sportBranch` (case-insensitive). Existing rows are skipped. |
| `groups` | Match by `name + sportBranch` (case-insensitive). Existing rows are skipped. |
| `athletes` | Existing athletes (by name) are skipped — clubs update them through the existing UI. |
| `guardians` | Matched by name + phone or email. Updated in place; new ones are created. |
| `athlete_guardians` | Existing links are updated in place; new ones are created. Setting `isPrimaryContact=true` clears the previous primary contact for the athlete. |
| `charge_items` | Match by `name + currency` (case-insensitive). Existing rows are skipped. |
| `inventory_items` | Match by `name` (case-insensitive). New rows create the item, a single default variant, and one `STOCK_ADDED` movement when starting stock > 0. |

All commits run inside a single TypeORM transaction per request. Tenant
isolation is asserted by `TenantGuard` and re-asserted on every read /
write inside `ImportsService`. Successful commits also append a single
row to `import_batches` (history-write failures are logged but never roll
back a legitimate import — see "Server-side history" below).

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/onboarding/state` | Per-step status, counts, prerequisites, **last-import per step**, **readiness signals**, and the most recent import batches for the current tenant. Read-only, never mutates anything. |
| `GET` | `/api/onboarding/history?limit=N` | Most recent N (default 25, max 100) server-recorded import batches for the current tenant, newest first. Used by the wizard's "Recent imports" strip. |
| `GET` | `/api/imports/definitions` | Per-entity column contracts the wizard renders against. |
| `GET` | `/api/imports/template?entity=<key>` | CSV template for one importable entity (UTF-8 BOM). |
| `POST` | `/api/imports/preview` | Dry-run validation. Returns per-row outcomes, missing columns, and friendly hints. |
| `POST` | `/api/imports/commit` | Commits a previously-validated batch in a transaction and records a row in `import_batches`. |

Response shapes live in `apps/api/src/modules/imports/onboarding.service.ts`
(`OnboardingStateReport`, `OnboardingHistoryEntry`, `OnboardingReadiness`)
and are mirrored on the web side in `apps/web/src/lib/imports.ts`.

## Server-side history (`import_batches`)

`import_batches` is a deliberately small server-side memory of "what was
brought in" for each onboarding-aligned import commit. It is **not** an
event-sourcing log, **not** an audit ledger, and **not** a rollback engine.

Each row answers four calm questions:

- **Which onboarding step / entity?** (`entity`)
- **When did it happen, and who triggered it?** (`createdAt`,
  `triggeredByStaffUserId`, `triggeredByDisplayName`)
- **How many rows were created / updated / skipped / rejected?**
  (`createdRows`, `updatedRows`, `skippedRows`, `rejectedRows`,
  `warningRows`, `totalRows`)
- **Did the batch finish cleanly, partially, or does it need attention?**
  (`status`: `success | partial | needs_attention`)

A short `summary` JSON blob retains up to ~6 hint lines from the
validation pass. The raw uploaded payload is **never** stored.

Trust constraints we hold on purpose:

- Tenant-scoped at the column level with `ON DELETE CASCADE`; reads and
  writes go through `ImportsService` / `OnboardingService` which only
  touch rows where `tenantId === req.tenantId`.
- Display name of the staff user is cached at write time so leavers don't
  cause "(unknown)" rows in history.
- History writes are wrapped in a try/catch and logged to stderr — an
  incidental DB hiccup never rolls back an otherwise successful import.

## Go-live readiness

`OnboardingStateReport.readiness` is a small, honest summary of how
confident the club should feel right now. The tone is computed from:

| Tone | When |
|------|------|
| `fresh` | No required steps complete yet. |
| `in_progress` | Some required steps still outstanding. |
| `almost_ready` | Required steps done, but soft warning signals raised attention-worthy concerns. |
| `ready` | Required steps done and no warning signals raised. |

Soft signals (calm, never alarming) currently include:

- `brand_missing` — branding never configured.
- `athletes_without_groups` — athletes loaded but zero training groups.
- `links_missing` — athletes + guardians loaded but zero athlete↔guardian
  links (so families wouldn't see anything in the parent portal).
- `low_athlete_count` — fewer than 4 athletes on file (likely incomplete
  import).
- `rejected_rows_<step>` — most recent batch for a step landed with
  rejected rows the operator hasn't revisited.

Each signal carries an optional `stepKey` so the UI can deep-link back
into the relevant step.

We deliberately do **not** invent fake certainty. "Ready" means
"required steps done and no concerning soft signals" — it is not a legal
guarantee that everything is perfect.

## Dependency / relationship diagnostics

Row-level errors are written in human language and point back to the
responsible step. Examples:

- "We couldn't find a sport branch called 'Volleyball'. Open the Sport
  branches step and add it first, then re-import this row."
- "We couldn't find a guardian called 'Murat Aksoy' yet. Finish the
  Guardians step (or check the spelling) before linking this athlete."
- "We couldn't find a coach called 'Selin Demir' in this sport branch.
  The team will be created without a head coach — add the coach from the
  Coaches step to assign one later."

The wizard surfaces these as `error` (blocks the row) or `warning` (the
row will still be created but something supportive is missing) without
ever speaking parser / schema language at the operator.

## UX & language

The wizard is built on the same UI primitives as the rest of the product
(`PageHeader`, `Button`, `InlineAlert`, `StatCard`). Intentional choices:

- **Calm copy.** Warning lines say "We found 4 rows that need attention
  before import" rather than "Validation failed with 4 row-level schema
  errors."
- **Honest progress.** The banner only counts required steps in the
  ratio; optional steps still update their own card status but never
  delay readiness.
- **Step rail, not a task dump.** The rail uses subtle status dots, a
  short uppercase status pill, and (when present) a relative
  "Last imported {{when}}" reminder.
- **Confidence-first review.** The go-live step opens with a readiness
  summary, then a required-vs-optional checklist, then the recent
  imports strip, then quick links into the operational surfaces.
- **Desktop-first, responsive-safe.** The two-column rail collapses to a
  stacked layout on small screens. Tables inside the preview panel
  scroll horizontally when needed. Status rails and history strips
  remain readable at narrower widths.
- **No double-import confusion.** Every committed batch lands in
  `import_batches` so staff can see "we already did this" without
  re-parsing files locally.

## Validation matrix

- `npm run lint` — ESLint, must pass with `--max-warnings 0`.
- `npm run build` — TypeScript + Nest + Vite.
- `npm run i18n:check` — locale parity, covers the whole `pages.onboarding`
  tree (including the new `readiness`, `history`, `lastImport`, and
  `relative` keys) and `app.nav.onboarding`.
- `npm run frontend:smoke` — Vitest + Testing Library, includes the
  `OnboardingPage` rail rendering and the new go-live readiness +
  recent-imports panels.
- `npm run onboarding:imports:test` — pure-Node sanity check that every
  declared importable entity has the right amount of i18n copy and at
  least the expected number of required fields, plus the v1.1
  readiness / history / last-import locale keys.
- `npm run onboarding:readiness:test` — pure-Node decision-table check
  for the readiness tone mapping plus a guard that
  `OnboardingService.getHistory` and `ImportsService.recordBatch` keep
  existing.
- Existing checks (`npm run reporting:starter-views:test`,
  `npm run reporting:filter-tree:test`, `npm run repo:guard`,
  `npm run club:updates:test`, etc.) remain green.

## Intentionally still deferred

- A true rollback / undo for committed imports. The Confidence Pack
  gives staff supportive memory and a calm "open the step again"
  affordance, but it does not pretend to safely reverse mutations.
  Replaying an upload through the same step is the v1.1 contract.
- Update / merge semantics for create-only imports
  (`sport_branches`, `coaches`, `teams`, `charge_items`,
  `inventory_items`). v1 stays honest: existing rows are skipped.
- Excel `.xlsx` templates (CSV with UTF-8 BOM is the contract; Excel
  reads them cleanly).
- Arbitrary column-mapping UI beyond the existing alias-aware
  auto-mapper.
- Multi-step bulk delete from inside the wizard. Use the per-entity
  surfaces.
- Cross-tenant analytics over `import_batches`. The table is per-tenant
  by design and not surfaced to platform admins.
