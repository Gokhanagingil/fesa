# Bootstrap and demo seed

The amateur platform ships a **single, repeatable demo seed** for local development and future staging smoke tests. It loads the same domain entities the product uses (no parallel “fixture” system).

## What it does

- **Creates or updates** four demo clubs with **fixed UUIDs** so runs stay repeatable:
  - `kadikoy-genc-spor` — Kadıköy Gençlik Spor Kulübü
  - `fesa-basketbol` — Fesa Basketbol
  - `moda-voleybol-akademi` — Moda Voleybol Akademi
  - `marmara-futbol-okulu` — Marmara Futbol Okulu
- Inserts **sport branches**, **age groups**, **groups (cohorts)**, **teams**, **coaches**, **athletes**, **guardians**, **links**, **team memberships**, **training sessions**, **private lessons**, **attendance**, **charge items**, **athlete charges**, **staff users**, **tenant memberships**, and **staff sessions**.
- Is **idempotent**: safe to run multiple times. Rows are keyed by deterministic UUIDs, and the demo tenant/admin identities also reconcile on their natural unique keys (`tenants.slug`, `staff_users.email`) so repeat runs do not fail on those collisions.

## What it does *not* do

- Does **not** wipe the database or delete other tenants.
- Does **not** replace migrations — apply migrations first so the schema exists.
- Does **not** require secrets or external services.

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

## Staging

Use the same command in a staging job after migrations. Keep `DATABASE_URL` scoped to the staging database. The seed is not tied to `NODE_ENV`; avoid running it against production unless you explicitly want this demo tenant there.

CI also validates repeatability with:

```bash
npm run seed:demo:verify
```

That command runs the demo seed twice against the same database and confirms the seeded clubs, staff identities, memberships, and minimum demo-data density still resolve correctly without duplication.

## Extending

- Add more deterministic UUIDs in `apps/api/src/database/seed/constants.ts` and rows in `demo-seed.ts`.
- Additional tenants or “demo packs” can follow the same pattern (separate constant namespaces per pack).
