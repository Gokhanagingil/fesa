# Bootstrap and demo seed

The amateur platform ships a **single, repeatable demo seed** for local development and future staging smoke tests. It loads the same domain entities the product uses (no parallel “fixture” system).

## What it does

- **Creates or updates** one demo tenant (`kadikoy-genc-spor`) with a **fixed UUID** so runs are repeatable.
- Inserts **sport branches**, **age groups**, **groups (cohorts)**, **teams**, **coaches**, **athletes**, **guardians**, **links**, **team memberships**, **training sessions**, **private lessons**, **attendance**, **charge items**, and **athlete charges**.
- Is **idempotent**: safe to run multiple times. Rows are keyed by deterministic UUIDs; `save()` upserts by primary key.

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

## Demo tenant reference

| Field | Value |
|-------|--------|
| Name | Kadıköy Gençlik Spor Kulübü |
| Slug | `kadikoy-genc-spor` |
| Id | `a0000001-0000-4000-8000-000000000001` |

Set `DEV_TENANT_ID` in `apps/api/.env` to that UUID so API calls without `X-Tenant-Id` resolve to the demo tenant. The web app prefers this tenant by **slug** when no valid `localStorage` tenant is stored.

## Data highlights (UX)

- **Group-only athlete**: cohort training, no open `athlete_team_memberships` (e.g. Deniz in U12 basketball).
- **Group + team athlete**: primary group + active team membership (e.g. Efe on U12 A; Zeynep on U14 A).
- **Training**: mix of group sessions and team-targeted sessions; **attendance** uses present / absent / excused / late.
- **Coaching**: branch-scoped coaches are seeded and assigned to groups, teams, standard sessions, and private lessons.
- **Private lessons**: includes 1-to-1 lessons with coach, schedule, status, and linked finance examples.
- **Finance**: catalog items (dues, camp, merchandise, tournament) and athlete charges with **mixed statuses** (pending, partially paid, paid, cancelled).

## Staging

Use the same command in a staging job after migrations. Keep `DATABASE_URL` scoped to the staging database. The seed is not tied to `NODE_ENV`; avoid running it against production unless you explicitly want this demo tenant there.

## Extending

- Add more deterministic UUIDs in `apps/api/src/database/seed/constants.ts` and rows in `demo-seed.ts`.
- Additional tenants or “demo packs” can follow the same pattern (separate constant namespaces per pack).
