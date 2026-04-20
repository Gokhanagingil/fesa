# Bootstrap and demo seed

The amateur platform ships a **single, repeatable demo seed** for local development and future staging smoke tests. It loads the same domain entities the product uses (no parallel “fixture” system).

## What it does

- **Creates or updates** four demo clubs with **fixed UUIDs** so runs stay repeatable:
  - `kadikoy-genc-spor` — Kadıköy Gençlik Spor Kulübü
  - `fesa-basketbol` — Fesa Basketbol
  - `moda-voleybol-akademi` — Moda Voleybol Akademi
  - `marmara-futbol-okulu` — Marmara Futbol Okulu
- Inserts **sport branches**, **age groups**, **groups (cohorts)**, **teams**, **coaches**, **athletes**, **guardians**, **links**, **team memberships**, **training sessions**, **private lessons**, **attendance**, **charge items**, **athlete charges**, **staff users**, **tenant memberships**, and **staff sessions**.
- After the expansion seed, also runs an **inventory seed** that adds a small
  but believable inventory footprint per club (numbered match jerseys, sized
  sweatshirts, training balls, cones with a deliberately low stock signal,
  and a few open athlete assignments). The inventory seed is idempotent and
  reuses the demo athlete cohort as assignment recipients.
- After the base seed completes, runs an **expansion seed** that grows each
  demo club into a believable staging-walkthrough footprint (≈22-29 athletes,
  ≈12-21 guardians, 4-6 coaches, several groups and teams, weekly recurring
  training sessions with attendance, a few private lessons, three months of
  monthly dues with payments, and a sprinkle of merchandise / tournament /
  camp charges). The expansion can be skipped with
  `SKIP_DEMO_SEED_EXPANSION=true` if you only want the original smoke seed.
- Is **idempotent**: safe to run multiple times. Rows are keyed by deterministic UUIDs (base seed) or `stableId(slug, kind, key, …)` SHA-256 hashes (expansion seed), and the demo tenant/admin identities also reconcile on their natural unique keys (`tenants.slug`, `staff_users.email`) so repeat runs do not fail on those collisions.

## What it does *not* do

- Does **not** wipe the database or delete other tenants.
- Does **not** replace migrations — apply migrations first so the schema exists.
- Does **not** require secrets or external services.
- Does **not** require an SMTP provider to be configured. Parent
  invite delivery is honestly reported as `unavailable` until you set
  `SMTP_HOST` + `SMTP_FROM`; staff can still issue, copy, and
  manually share invite links from the staff UI in that mode. See the
  *Parent Invite Delivery & Access Reliability Pack* section in
  [`parent-portal.md`](./parent-portal.md) for the full env contract.

## Prerequisites

1. PostgreSQL reachable via `DATABASE_URL` (see `apps/api/.env.example`).
2. Schema up to date:

```bash
npm run migration:run -w @amateur/api
```

## Run

From the repository root:

```bash
npm run seed:demo
```

Or from the API workspace:

```bash
npm run seed:demo -w @amateur/api
```

The script loads `DATABASE_URL` from `apps/api/.env` (or `.env` in the current working directory when run from `apps/api`).

## Demo club reference

| Club | Slug | Id |
|------|------|----|
| Kadıköy Gençlik Spor Kulübü | `kadikoy-genc-spor` | `a0000001-0000-4000-8000-000000000001` |
| Fesa Basketbol | `fesa-basketbol` | `a0000001-0000-4000-8000-000000000010` |
| Moda Voleybol Akademi | `moda-voleybol-akademi` | `a0000001-0000-4000-8000-000000000020` |
| Marmara Futbol Okulu | `marmara-futbol-okulu` | `a0000001-0000-4000-8000-000000000030` |

Set `DEV_TENANT_ID` in `apps/api/.env` to Kadıköy’s UUID if you want API calls without `X-Tenant-Id` to resolve there by default. The web app also prefers Kadıköy by **slug** when no valid `localStorage` tenant is stored yet.

## Seeded staff login fixtures

The demo seed now also creates internal staff/admin fixtures so the authenticated app shell can be exercised end to end:

| Account | Email | Password | Access |
|---------|-------|----------|--------|
| Global admin | `platform.admin@amateur.local` | `Admin123!` | Platform-wide administration + cross-tenant switching |
| Club admin | `club.admin@amateur.local` | `Admin123!` | Kadıköy Gençlik Spor Kulübü |
| Club admin | `admin@fesabasketbol.local` | `Admin123!` | Fesa Basketbol |
| Club admin | `admin@modavoleybol.local` | `Admin123!` | Moda Voleybol Akademi |
| Club admin | `admin@marmarafutbol.local` | `Admin123!` | Marmara Futbol Okulu |

Use these at `http://localhost:5173/login` after running `npm run seed:demo`.

## Data highlights (UX)

- **Group-only athlete**: cohort training, no open `athlete_team_memberships` (e.g. Deniz in U12 basketball).
- **Group + team athlete**: primary group + active team membership (e.g. Efe on U12 A; Zeynep on U14 A).
- **Training**: mix of group sessions and team-targeted sessions; **attendance** uses present / absent / excused / late.
- **Coaching**: branch-scoped coaches are seeded and assigned to groups, teams, standard sessions, and private lessons.
- **Private lessons**: includes 1-to-1 lessons with coach, schedule, status, and linked finance examples.
- **Finance**: catalog items (dues, camp, merchandise, tournament) and athlete charges with **mixed statuses** (pending, partially paid, paid, cancelled).
- **Identity/admin**: includes one global admin plus one club admin per seeded club so role-aware landing, tenant switching, and settings/admin surfaces can be validated against real multi-tenant demo data.
- **Platform visibility**: after sign-in, the dashboard and settings surfaces should show all four seeded clubs for the platform admin and a club-scoped overview for each club admin.
- **Bootstrap recovery**: the login flow now uses the profile returned by `POST /api/auth/login` directly (including `accessibleTenants` and `defaultTenantId`), then verifies via `GET /api/auth/me` in the background. This means a signed-in user always lands in a valid club context immediately — even if the cookie round-trip is delayed or the session verification call fails temporarily.
- **Lifecycle and bulk flows**: the seeded clubs are suitable for trial-to-active conversion, pause/reactivate/withdraw flows, roster bulk status or primary-group updates, scoped finance bulk assignment, and status-aware communication audience follow-up.
- **Tenant branding**: each demo club is also seeded with the Wave 17 brand payload (display name, primary/accent color, welcome copy) so the parent portal renders a club-specific look on first launch without staff having to configure anything. Brand fields are idempotent on the natural `tenants.slug` key.

## Staging

Use the same command in a staging job after migrations. Keep `DATABASE_URL` scoped to the staging database. The seed is not tied to `NODE_ENV`; avoid running it against production unless you explicitly want this demo tenant there.

CI also validates repeatability with:

```bash
npm run seed:demo:verify
```

That command runs the demo seed twice against the same database and confirms the seeded clubs, staff identities, memberships, and minimum demo-data density still resolve correctly without duplication.

## Extending

- Add more deterministic UUIDs in `apps/api/src/database/seed/constants.ts` and rows in `demo-seed.ts`.
- For broad volume changes (more athletes per club, different overdue rates, more recurring sessions, etc.), tune the per-club `profile` knobs in `apps/api/src/database/seed/demo-seed-expansion.ts`. Each knob is documented inline; bumping `extraAthletes`, `recurringSessionWeeks`, or `overdueRate` will be reflected on the next seed run without touching the base seed.
- Additional tenants or “demo packs” can follow the same pattern (separate constant namespaces per pack).

## Smoke test

After seeding, run the dashboard smoke test against a running API to confirm every endpoint that backs the staff sidebar still returns 200 for each accessible tenant:

```bash
npm run dashboard:smoke
```

Override `API_BASE`, `ADMIN_EMAIL`, or `ADMIN_PASSWORD` to point the smoke test at a different environment. The script logs in as the global admin, walks every accessible tenant, and asserts that the `/api/reporting/command-center` payload still has the `stats`, `attendance`, `actionCenter`, and `familyWorkflow` blocks the dashboard expects.

## Reporting Foundation v1 smoke

Wave 11 adds two complementary smoke checks for the new reporting spine, and
Wave 12 adds a starter-catalog integrity check:

```bash
npm run reporting:filter-tree:test   # pure-Node validator unit smoke
npm run reporting:starter-views:test # pure-Node starter catalog / groupBy integrity smoke
npm run reporting:smoke              # live API smoke (catalog, run, export, saved views)
```

`reporting:filter-tree:test` and `reporting:starter-views:test` run in any
environment after `npm run build` and exercise the compiled reporting logic
without a database. `reporting:smoke` requires the API running locally (or
`API_BASE` set) and validates that catalog metadata, filter-tree validation,
tenant-isolated `run`, saved view CRUD, starter views, grouped runs, and CSV
export all behave correctly across every accessible tenant.

## Reporting frontend smoke

Wave 12 closure adds a lightweight frontend smoke layer for the report-builder
experience itself:

```bash
npm run frontend:smoke
```

This covers the club-facing reporting journeys that sit above the API contract:

- report builder landing
- curated starter open/apply
- grouping enable + grouped render
- save / duplicate / delete saved-view flow
- dashboard drill-down into report context

Use this alongside `npm run reporting:smoke` when you want confidence in both
the reporting API contracts and the report-entry UX.

## Demo athlete fields

The expansion seed also fills `Athlete.shirtSize` deterministically per athlete
(based on age + gender). This makes the Reporting Foundation v1 demo
interesting on day one — for example, the catalog instantly supports queries
like _"female athletes with shirt size M, not in Team A, who have guardians,
who take private lessons, and whose related fees are unpaid"_ against the
default seed.
