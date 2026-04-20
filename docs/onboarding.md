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
- **v1.2 — Onboarding Completion Pack** (Wave 21, this sprint): result
  recall via a calm batch detail drawer, per-step history, safer replay
  / retry affordances, an honest "completion" panel on the go-live step,
  a recommended-actions list, and a first-30-days companion strip.

## What ships in v1.2

| Area | Shape |
|------|-------|
| **Step rail** | Eleven calm steps in dependency order; each tile shows status (`not_started · in_progress · completed · needs_attention`) and the relative time of the last server-recorded import for that step. The rail is now sticky on desktop so it stays oriented while reviewing the right pane. |
| **Per-step import flow** | Reuses `ImportFlow` (the same preview / validate / commit pipeline used by `/app/imports`). No duplicate import system. |
| **Downloadable templates** | One CSV template per importable step. UTF-8 BOM so Excel handles Turkish characters cleanly. |
| **Live progress banner** | "Welcome, {{name}}", `requiredCompleted / requiredTotal`, and a calm `fresh / in_progress / ready` state pill. |
| **Per-step "last import" card** | Inside the step panel, just above the upload card: a calm summary of when the step was last imported, by whom, the source filename, and the create/update/skip counts. |
| **Result recall (v1.2)** | Each "last import" card now exposes three calm affordances: **Open result summary** (drawer), **See all imports for this step** (per-step history drawer), and a **Try again with a corrected file** button when the step needs attention. |
| **Per-step history (v1.2)** | A drawer powered by `GET /api/onboarding/history?step=<key>` that lists every recorded batch for the current step, newest first, with a single tap into the result drawer. |
| **Batch detail drawer (v1.2)** | A small, calm side drawer powered by `GET /api/onboarding/batches/:id`. Shows the same supportive notes the wizard captured at preview time so staff can answer "what did this batch actually do?" without re-running validation. |
| **Replay / retry affordances (v1.2)** | Each history entry carries an honest replay hint key. We never claim "undo" — we explain what the next safe move is, and only highlight the **Try again** affordance when the batch genuinely needs attention. |
| **Server-side history** | Every commit appends a single, deliberately small row to `import_batches` with the per-step counts, status, source label, and the staff member who triggered it. |
| **Recent imports strip** | The go-live review surfaces the most recent batches across the club so staff can answer "what did we last import, and did it land cleanly?". Each row links into its own batch drawer. |
| **Honest completion panel (v1.2)** | The go-live step now opens with a single **completion panel** that resolves to one of `needs_attention / almost_ready / ready`, plus a short, honest sentence explaining what each tone means. |
| **Go-live readiness summary** | Honest tone (`fresh / in_progress / almost_ready / ready`), required + optional step checklists, and soft warning signals (e.g. "athletes are loaded but no groups exist yet"). |
| **Recommended actions (v1.2)** | A short list (max 5) of supportive nudges built from the current state: revisit a step that needs attention, configure missing brand, link athletes to families, etc. Each entry deep-links into the relevant step or in-product surface. |
| **First-30-days companion (v1.2)** | A calm strip on the go-live step with five practical next moves for the first month after onboarding. Stays in `dormant` mode until required steps are done; once active, it becomes the post-onboarding companion. |
| **Dependency hints** | Each step explains which prior steps it assumes. Steps blocked by missing prerequisites render a calm warning. Row-level dependency errors point back to the responsible step in human language. The skip hint now reminds staff that re-running a step is safe and won't create duplicates. |
| **Tenant isolation** | Reuses `TenantGuard`. Both `OnboardingService` and `ImportsService` only ever read / write inside `req.tenantId`, including the `import_batches` table and the new batch detail / per-step history reads. |

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
11. **Review & go live** — completion panel + readiness summary +
    recommended actions + required/optional checklists + recent imports
    + first-30-days companion + quick links.

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
| `GET` | `/api/onboarding/state` | Per-step status, counts, prerequisites, last-import per step, readiness signals, the most recent import batches, **the calm `recommendedActions` list**, and the **`firstThirtyDays` companion** for the current tenant. Read-only. |
| `GET` | `/api/onboarding/history?limit=N&step=<key>` | Most recent N (default 25, max 100) server-recorded import batches for the current tenant, newest first. Pass `step=<key>` to scope to a single onboarding step (per-step history drawer). |
| `GET` | `/api/onboarding/batches/:id` | Calm result recall for a single recorded batch (counts, source, replay hint, supportive notes captured at preview). 404 when the batch doesn't belong to the current tenant. |
| `GET` | `/api/imports/definitions` | Per-entity column contracts the wizard renders against. |
| `GET` | `/api/imports/template?entity=<key>` | CSV template for one importable entity (UTF-8 BOM). |
| `POST` | `/api/imports/preview` | Dry-run validation. Returns per-row outcomes, missing columns, and friendly hints. |
| `POST` | `/api/imports/commit` | Commits a previously-validated batch in a transaction and records a row in `import_batches`. |

Response shapes live in `apps/api/src/modules/imports/onboarding.service.ts`
(`OnboardingStateReport`, `OnboardingHistoryEntry`, `OnboardingBatchDetail`,
`OnboardingReadiness`, `OnboardingRecommendedAction`,
`OnboardingFirstThirtyDays`) and are mirrored on the web side in
`apps/web/src/lib/imports.ts`.

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
  touch rows where `tenantId === req.tenantId`. The new
  `getBatch` and per-step `getHistory` reads enforce the same scope.
- Display name of the staff user is cached at write time so leavers don't
  cause "(unknown)" rows in history.
- History writes are wrapped in a try/catch and logged to stderr — an
  incidental DB hiccup never rolls back an otherwise successful import.

## Replay / retry / recovery

The Onboarding Completion Pack adds calm, supportive replay semantics
without ever pretending to be a rollback engine.

- Each `OnboardingHistoryEntry` carries a `replayHintKey` that resolves
  to one of four short, honest lines:
  - `success` — "Everything in this file landed cleanly. You can safely
    re-run with a new file when you have more rows."
  - `partial` — "Most rows were already on file and skipped — your prior
    data was preserved."
  - `warnings` — "A few rows came in with gentle warnings. Re-run with a
    corrected file when you've fixed them."
  - `needsAttention` — "Some rows were rejected. Fix them in the file
    and re-run this step — we won't import the same row twice."
- The per-step "last import" card surfaces a **Try again with a
  corrected file** button only when the step or its last batch genuinely
  needs attention. Tapping it scrolls the user to the upload card on the
  same step.
- Re-running a step is safe by design: each entity already either skips
  or updates in place when the row matches an existing record (see the
  Commit Semantics matrix). The wizard repeats this reassurance both at
  preview time and on the history card so staff aren't afraid to retry.
- We deliberately do **not** offer:
  - Cross-batch undo or rollback. The data model isn't designed for it,
    and pretending otherwise would be dishonest.
  - "Replay this exact file" automation. The user always re-uploads the
    corrected file themselves so they stay in control.

## Go-live readiness

`OnboardingStateReport.readiness` is a small, honest summary of how
confident the club should feel right now. The tone is computed from:

| Tone | When |
|------|------|
| `fresh` | No required steps complete yet. |
| `in_progress` | Some required steps still outstanding. |
| `almost_ready` | Required steps done, but soft warning signals raised attention-worthy concerns. |
| `ready` | Required steps done and no warning signals raised. |

The Completion Pack adds a sibling **completion panel** on the go-live
step, computed from the same step + readiness state and resolved into
one of three honest tones (`needs_attention`, `almost_ready`, `ready`)
plus a single sentence explaining what each tone means. We deliberately
do **not** invent fake certainty. "Ready" means "required steps done and
no concerning soft signals" — it is **not** a legal guarantee that
everything is perfect.

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

## Recommended actions

`OnboardingStateReport.recommendedActions` is a short, honest list (max 5)
of supportive nudges surfaced inside the go-live review. Examples:

- Revisit a step flagged as `needs_attention`.
- Add club brand details when branding is missing.
- Link athletes to their families when `links_missing` is raised.
- Create at least one training group when athletes are loaded but no
  cohort exists.
- Once required steps are done, gentle reminders to invite the rest of
  the staff and post a first welcome announcement.

Each entry deep-links into either an onboarding step (`stepKey`) or an
in-product surface (`to`), so the user always has a single, obvious
next move.

## First-30-days companion

`OnboardingStateReport.firstThirtyDays` is a calm strip rendered on the
go-live step. It has two modes:

- `dormant` — required steps not done yet. The strip stays gentle and
  uses a "when you're ready, here's what tends to come next" framing.
- `active`  — required steps done. The strip flips to "welcome to your
  first 30 days" and becomes the post-onboarding companion.

The five items are deliberately small, supportive, and map to existing
in-product surfaces (dashboard, guardians, finance, club updates,
training). They are **not** tracked checklist items — the platform does
not store completion. The goal is to reduce fear after onboarding, not
create a new admin workload.

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
- "Some rows match an existing record and will be skipped — re-running
  this step is safe and won't create duplicates."

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
  "Last imported {{when}}" reminder. It is sticky on desktop so it stays
  oriented while reviewing the right pane.
- **Confidence-first review.** The go-live step opens with the
  completion panel, then the readiness summary, then recommended
  actions, then the required-vs-optional checklists, then the recent
  imports strip, then the first-30-days companion, then quick links into
  the operational surfaces.
- **Calm replay.** Each history card resolves a single supportive
  replay hint. The "try again" affordance only appears when the step
  truly needs attention.
- **Desktop-first, responsive-safe.** The two-column rail collapses to a
  stacked layout on small screens. Drawers (batch detail, step history)
  occupy a stacked panel on small screens and a side panel on desktop.
  Tables inside the preview panel scroll horizontally when needed.
- **No double-import confusion.** Every committed batch lands in
  `import_batches` so staff can see "we already did this" without
  re-parsing files locally. The skip-row hint reminds users that
  re-running a step is safe and never creates duplicates.

## Validation matrix

- `npm run lint` — ESLint, must pass with `--max-warnings 0`.
- `npm run build` — TypeScript + Nest + Vite.
- `npm run i18n:check` — locale parity, covers the whole `pages.onboarding`
  tree (including v1.2 keys: `history.replay.*`, `history.drawer*`,
  `history.openBatch`, `history.tryAgain`, `history.stepHistory*`,
  `lastImport.openResult`, `lastImport.viewAll`, `lastImport.tryAgain*`,
  `recommendations.*`, `firstThirtyDays.*`, `goLive.completionState.*`,
  `goLive.completionHint.*`).
- `npm run frontend:smoke` — Vitest + Testing Library, includes the
  `OnboardingPage` rail rendering, the go-live readiness + recent-imports
  panels, the new completion panel, the recommended-actions list, the
  first-30-days strip, and the per-step "Try again with a corrected file"
  affordance.
- `npm run onboarding:imports:test` — pure-Node sanity check that every
  declared importable entity has the right amount of i18n copy and at
  least the expected number of required fields, plus the v1.2
  recommendations / first-30-days / completion / replay locale keys.
- `npm run onboarding:readiness:test` — pure-Node decision-table check
  for the readiness tone mapping plus a guard that
  `OnboardingService.getHistory`, `getBatch`, `buildRecommendedActions`,
  `buildFirstThirtyDays`, `buildReplayHint`, and
  `ImportsService.recordBatch` keep existing alongside the
  `GET /onboarding/batches/:id` and `?step=` history controller routes.
- Existing checks (`npm run reporting:starter-views:test`,
  `npm run reporting:filter-tree:test`, `npm run repo:guard`,
  `npm run club:updates:test`, etc.) remain green.

## Intentionally still deferred

- A true rollback / undo for committed imports. The Completion Pack
  gives staff supportive memory, calm replay hints, and a clear "open
  the step again and re-run with a corrected file" affordance, but it
  does not pretend to safely reverse mutations.
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
- A persistent "first 30 days" checklist with completion tracking. The
  companion strip is supportive only — the platform does not store
  whether each item has been done. This is on purpose: we do not want
  to create new admin workload after onboarding.
