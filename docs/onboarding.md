# Club Onboarding Wizard + Import Templates Foundation v1

This page describes the **Club Onboarding Wizard + Import Templates
Foundation v1**. It is the platform's adoption engine: a calm, guided way
for a club to move from spreadsheet-driven operations into the system
without fear of doing something irreversible.

It is intentionally **not** a generic ETL platform or an admin-style
"upload-and-pray" form. The wizard reuses the existing
`apps/api/src/modules/imports/*` foundation (column contracts, preview /
validate / commit pipeline) and adds a guided step rail on top.

## What ships in v1

| Area | Shape |
|------|-------|
| **Step rail** | Eleven calm steps, in dependency order, each with `not_started · in_progress · completed · needs_attention` status pulled live from the database. |
| **Per-step import flow** | Reuses `ImportFlow` (the same preview / validate / commit pipeline used by `/app/imports`). No duplicate import system. |
| **Downloadable templates** | One CSV template per importable step. UTF-8 BOM so Excel handles Turkish characters cleanly. |
| **Live progress banner** | "Welcome, {{name}}", `requiredCompleted / requiredTotal`, and a calm `fresh / in_progress / ready` state pill. |
| **Dependency hints** | Each step explains which prior steps it assumes. Steps blocked by missing prerequisites render with a warning instead of failing silently. |
| **Go-live panel** | The final step is review-only with quick links into the operational surfaces (dashboard, athletes, groups, finance, settings). |
| **Tenant isolation** | Reuses `TenantGuard`. The new `OnboardingService` only ever counts records inside `req.tenantId`. |

The wizard sits at `/app/onboarding`. The classic `/app/imports` view is
still available for users who want a flat per-entity import surface.

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
11. **Review & go live** — checklist + quick links into the product.

A step marked `optional` does not block `progress.state === 'ready'`.

## Importable entities and templates

`/api/imports/template?entity=<key>` now returns CSV templates for **nine**
importable entities (the four pre-existing ones plus five new ones):

| Step / entity | Required fields | New in v1? |
|---------------|-----------------|------------|
| `sport_branches` | `name`, `code` | ✓ |
| `coaches` | `firstName`, `lastName`, `sportBranch` | ✓ |
| `groups` | `name`, `sportBranch` |  |
| `teams` | `name`, `sportBranch` | ✓ |
| `athletes` | `firstName`, `lastName`, `sportBranch` (or default) |  |
| `guardians` | `firstName`, `lastName` |  |
| `athlete_guardians` | athlete name × guardian name + `relationshipType` |  |
| `charge_items` | `name`, `category`, `defaultAmount`, `currency` | ✓ |
| `inventory_items` | `name`, `category` | ✓ |

Every template ships with two filled sample rows so staff can see the
expected shape before filling it in.

### Field types added in v1

- `integer` — for inventory `initialStock` / `lowStockThreshold`.
- `decimal` — for `charge_items.defaultAmount`. Accepts both
  `1250.50` and `1250,50` (Turkish locale comma).
- Existing types (`string`, `enum`, `date`, `email`, `phone`, `boolean`)
  are unchanged.

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
write inside `ImportsService`.

## State endpoint

The wizard pulls its rail from a dedicated read-only endpoint:

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/onboarding/state` | Returns the per-step status, counts, and prerequisites for the current tenant. Read-only, never mutates anything. |

The response shape lives in `apps/api/src/modules/imports/onboarding.service.ts`
(`OnboardingStateReport`) and is mirrored on the web side in
`apps/web/src/lib/imports.ts`.

## UX & language

The wizard is built on the same UI primitives as the rest of the product
(`PageHeader`, `Button`, `InlineAlert`, `StatCard`). A few intentional
choices:

- **Calm copy.** Warning lines say "We found 4 rows that need attention
  before import" rather than "Validation failed with 4 row-level schema
  errors."
- **Honest progress.** The banner only counts required steps in the
  ratio; optional steps still update their own card status but never
  delay readiness.
- **Step rail, not a task dump.** The rail uses subtle status dots and a
  short uppercase status pill so you can scan it without anxiety.
- **Mobile-aware.** The layout collapses from a two-column rail on
  desktop to a stacked rail on small screens. Tables inside the preview
  panel scroll horizontally when needed.

## Validation matrix

- `npm run lint` — ESLint, must pass with `--max-warnings 0`.
- `npm run build` — TypeScript + Nest + Vite.
- `npm run i18n:check` — locale parity, now also covers
  `pages.onboarding` and `app.nav.onboarding`.
- `npm run frontend:smoke` — Vitest + Testing Library, now includes the
  `OnboardingPage` rail rendering.
- `npm run onboarding:imports:test` — pure-Node sanity check that every
  declared importable entity has the right amount of i18n copy and at
  least the expected number of required fields.
- Existing checks (`npm run reporting:starter-views:test`,
  `npm run reporting:filter-tree:test`, `npm run repo:guard`, etc.) remain
  green.

## Intentionally still deferred

- Server-side onboarding history / audit log (the existing on-device
  import history still works for both the wizard and the classic page).
- Update / merge semantics for create-only imports
  (`sport_branches`, `coaches`, `teams`, `charge_items`,
  `inventory_items`). v1 is honest: existing rows are skipped.
- Excel `.xlsx` templates (CSV with UTF-8 BOM is the v1 contract; Excel
  reads them cleanly).
- Arbitrary column-mapping UI beyond the existing alias-aware
  auto-mapper.
- Multi-step bulk delete / undo from inside the wizard. Use the
  per-entity surfaces.
