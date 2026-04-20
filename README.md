# Fesa — Amateur platform

**Amateur** is the codename for a new multilingual club operating platform for amateur sports organizations. This repository is a **monorepo** with a React frontend, NestJS API, and shared packages.

## What’s inside

| Path | Description |
|------|-------------|
| `apps/web` | React + TypeScript + Vite + Tailwind — club ops UX, TR/EN i18n, domain starter screens |
| `apps/api` | NestJS + TypeORM + PostgreSQL — athletes, guardians, training, attendance, finance primitives |
| `packages/shared-types` | Shared TypeScript contracts |
| `packages/shared-config` | Shared configuration helpers |
| `docs/` | Architecture, domain, i18n, reporting, inventory notes |

## Prerequisites

- **Node.js** 20+ (npm 10+)
- **PostgreSQL** 14+ (local or Docker)

## Quick start

Install dependencies from the repository root:

```bash
npm install
```

### Environment

Copy the API example env and adjust `DATABASE_URL`:

```bash
cp apps/api/.env.example apps/api/.env
```

Create a database the URL points to, then:

### Run the API

```bash
npm run start:dev -w @amateur/api
```

Apply database migrations (recommended before first run against a real database, and required when `DB_SYNCHRONIZE=false`):

```bash
npm run migration:run -w @amateur/api
```

### Demo seed (recommended for local / staging)

Populate the database with a realistic amateur club tenant, athletes, training, attendance, and finance examples:

```bash
npm run seed:demo
```

Details, idempotency, demo tenant ids, and seeded staff/admin credentials are documented in [docs/bootstrap.md](docs/bootstrap.md). After seeding, you can set `DEV_TENANT_ID` in `apps/api/.env` to the documented UUID so local development can still fall back to the demo tenant when needed.

API defaults:

- Base URL: `http://localhost:3000`
- Global prefix: `api` → health: `http://localhost:3000/api/health`
- **Staff/admin auth:** the internal app now uses a secure staff session cookie with explicit tenant memberships. Staff log in through `/login`, then the web app loads only the clubs that account can access.
- **Tenant context:** authenticated staff requests still resolve an active tenant, but the allowed tenant list now comes from real memberships instead of an unrestricted public tenant directory.
- **Guardian auth remains separate:** guardian portal access continues to use its own invitation + activation + guardian session cookie flow under `/portal/*`.

### Run the web app

In another terminal:

```bash
npm run dev -w @amateur/web
```

Open `http://localhost:5173`. The dev server proxies `/api` to the API.

### Login flows

- **Staff/admin app:** open `http://localhost:5173/login`
- **Guardian portal:** open `http://localhost:5173/portal/login`

The demo seed now creates:

- one **global admin** account for platform-level administration and cross-tenant context switching
- one **club admin** account bound to the demo club tenant

### Build everything

```bash
npm run build
```

### Lint

```bash
npm run lint
```

### Reporting validation

The reporting and Report Builder backbone is documented in
[docs/reporting.md](docs/reporting.md). After `npm run build`, you can run
the compiled, no-database checks:

```bash
npm run reporting:filter-tree:test
npm run reporting:starter-views:test
```

Both checks load the compiled API reporting modules from `apps/api/dist`, so
they fail fast with a clear "run npm run build" message if the build output is
missing.

With the API running, exercise catalog / run / export / saved views end to end:

```bash
npm run reporting:smoke
```

`reporting:smoke` is a live API check. It expects a reachable API, working
staff login, seeded/demo-accessible tenants, and a real database behind that
runtime. If the API is not running, the script now fails with an explicit hint
instead of a vague fetch error.

For lightweight frontend coverage of the reporting journeys themselves:

```bash
npm run frontend:smoke
```

## Continuous integration (GitHub Actions)

CI validates the monorepo on **pull requests** and **pushes to `main`**. There is no deployment or artifact publish in CI, but the reusable validation now includes a disposable PostgreSQL-backed migration check, repeatable demo-seed validation, and an API boot smoke before staging.

| Workflow | Purpose |
|----------|---------|
| [CI](.github/workflows/ci.yml) | Installs with `npm ci`, runs a small [repo guard](scripts/repo-guard.mjs), then `npm run lint`, `npm run frontend:smoke`, `npm run i18n:check`, `npm run build`, `npm run reporting:filter-tree:test`, `npm run reporting:starter-views:test`, `npm run media:isolation:test`, `npm run whatsapp:delivery:test`, `npm run tenant:branding:test`, `npm run migration:check -w @amateur/api`, `npm run seed:demo:verify`, and `npm run api:boot:smoke`. |
| [Manual validation](.github/workflows/manual-validate.yml) | Same checks on demand via **Actions → Manual validation → Run workflow** (useful when you are not opening a PR). |
| [Staging SSH check](.github/workflows/staging-ssh-check.yml) | Optional: verify GitHub → server SSH only (no deploy). Use when fixing `Permission denied (publickey)`. |

Reusable steps live in [.github/workflows/ci-reusable.yml](.github/workflows/ci-reusable.yml) so primary CI and manual runs stay in sync.

**Locally:** `npm run repo:guard` runs the structure/workspace checks only; fuller parity with CI is `npm ci`, `npm run repo:guard`, `npm run lint`, `npm run frontend:smoke`, `npm run i18n:check`, `npm run build`, `npm run reporting:filter-tree:test`, `npm run reporting:starter-views:test`, `npm run media:isolation:test`, `npm run whatsapp:delivery:test`, `npm run tenant:branding:test`, `npm run migration:check -w @amateur/api`, `npm run seed:demo:verify`, and `npm run api:boot:smoke` with `DATABASE_URL` pointed at a local PostgreSQL instance.

**Limitations:** CI still uses a lightweight disposable PostgreSQL service rather than a full end-to-end environment. It now validates frontend reporting smoke, migration execution, repeatable seed behavior, and runtime boot, but it does not yet cover full browser E2E or staging infrastructure such as Nginx.

## Staging deployment (Hetzner / manual Actions)

A first-wave **staging** path uses GitHub Actions (`workflow_dispatch`) to SSH into the server, sync the repo, install, build, run migrations and demo seed, and reload the API under **PM2**. Nginx serves the static web build and proxies `/api` to Nest.

- **Deploy workflow:** [.github/workflows/staging-deploy.yml](.github/workflows/staging-deploy.yml)
- **SSH-only debug workflow:** [.github/workflows/staging-ssh-check.yml](.github/workflows/staging-ssh-check.yml)
- **Full guide:** [docs/staging-deploy.md](docs/staging-deploy.md) (secrets, variables, SSH troubleshooting, server prep, Nginx template, rollback hints)
- **On-server validation:** [deploy/staging/server-validate.sh](deploy/staging/server-validate.sh) (run on Hetzner as the deploy user)

## Multilingual UX

Turkish and English are wired via `i18next` in `apps/web`. Locale files live under `apps/web/src/i18n/locales/`. See [docs/i18n.md](docs/i18n.md).

This wave also adds a locale parity guard (`npm run i18n:check`) so missing TR/EN keys are caught before raw keys or mixed-language drift reach staging.

## Club operations core workflows

The current product wave extends the existing command center into a more complete daily operating system without introducing parallel modules:

- **Athletes + guardians:** athlete profiles now combine guardians, team context, finance state, private lessons, and communication follow-up signals in one place.
- **Membership lifecycle:** athlete onboarding now starts from a lighter intake flow, and staff can track `trial`, `active`, `paused`, `inactive`, and `archived` states with explicit enrollment-readiness cues.
- **Groups + teams:** the group-first / optional-team model remains unchanged and now also supports lightweight coach assignment for operational ownership.
- **Coaches:** clubs can manage a focused coaching roster, then assign coaches to groups, teams, training sessions, and private lessons without turning the product into an HR suite.
- **Training + attendance:** training stays group-first / team-optional, with recurring session generation, safe bulk cancellation / rescheduling, and optional coach visibility in planning and attendance views.
- **Private lessons:** 1-to-1 lessons are now a first-class workflow with athlete, coach, schedule, attendance, notes, and optional linked charge visibility.
- **Collections + balances:** charge assignment still starts from reusable charge items, payments still use explicit allocations, and private-lesson charges now fit inside the same finance model.
- **Periodic collections automation:** finance can now generate period-based athlete charges with duplicate protection using billing period keys, without replacing the existing manual charge workflow.
- **Communication readiness:** the product now helps staff assemble audiences by group, team, session, private-lesson context, and financial follow-up so family outreach can start from clear operational targets.
- **Family action workflows:** athlete and guardian readiness now extend into a controlled family-action queue with request creation, pending family action, staff review, approval/rejection, and closure tracking.
- **Notification center + staff work queue:** the product now surfaces tenant-safe in-app action items for overdue finance follow-up, family review, guardian response, readiness gaps, upcoming training preparation, and private-lesson preparation with read/dismiss/complete controls.
- **Guardian Portal MVP:** the platform now includes a controlled guardian-facing portal with invitation/activation, linked-athlete visibility, pending family requests, and portal submissions that still flow through staff review before authoritative records change.
- **Parent Access & Portal Foundation v1:** the guardian portal is now a calm, mobile-first parent surface distinct from admin pages. Each tenant carries a controlled brand payload (display name, primary/accent color, optional logo, welcome copy) so the portal feels like the family's own club. See [docs/parent-portal.md](docs/parent-portal.md).
- **Dashboard + reporting:** the dashboard and reports pages now surface live operational, coaching, private-lesson, and collection summaries instead of placeholder counts and disabled report affordances.
- **Staff identity + tenant administration:** staff/admin users now have a real login flow, explicit tenant memberships, role-aware entry, and a lightweight admin/settings surface for platform vs club administration.
- **Inventory & Assignment Pack v1:** clubs can manage physical stock (jerseys, sweatshirts, balls, cones, equipment) with optional size / number variants, assign items to athletes, return them, and read low-stock signals — all reusing the same reporting backbone. See [docs/inventory.md](docs/inventory.md).
- **Import / Export & Bulk Operations Foundation v1:** clubs can import athletes, guardians, and athlete↔guardian relationships through a guided wizard with preview / validation / commit, run a small set of high-value bulk actions (lifecycle updates, guardian delete, inventory bulk return), and pull practical CSV exports without leaving the page. See [docs/import-export.md](docs/import-export.md).
- **Club Onboarding Wizard + Import Templates Foundation v1:** new clubs can move from spreadsheet-driven operations into the platform through a guided wizard at `/app/onboarding` that walks a club through sport branches → coaches → groups → teams → athletes → guardians → links → finance starter → inventory → review, each step backed by a downloadable Excel-friendly CSV template and the same calm preview / validate / commit pipeline. See [docs/onboarding.md](docs/onboarding.md).
- **Athlete Photo & Media Foundation v1:** athletes now have a calm profile photo capability — upload, replace, and remove are tenant-isolated and validated server-side, with avatars surfaced wherever recognition matters (athlete detail, athletes list). See [docs/media.md](docs/media.md).

## Domain: Group vs Team vs Athlete

**Groups** (table `club_groups`) are training cohorts / age buckets. **Teams** are squads; they may optionally link to a group (`teams.group_id` nullable). **Athletes** use `primaryGroupId` for their cohort and optional **team memberships** for squads. See [docs/domain.md](docs/domain.md).

## Documentation

- [docs/README.md](docs/README.md) — index
- [docs/bootstrap.md](docs/bootstrap.md) — demo seed and first-run data
- [docs/architecture.md](docs/architecture.md) — structure and principles
- [docs/domain.md](docs/domain.md) — modeling notes (membership, wave-two domains)
- [docs/migrations.md](docs/migrations.md) — database migrations and `synchronize` policy
- [docs/i18n.md](docs/i18n.md) — localization
- [docs/reporting.md](docs/reporting.md) — reporting and bulk placeholders
- [docs/communication.md](docs/communication.md) — Communication & Follow-up Pack v1 (WhatsApp-first follow-up)
- [docs/inventory.md](docs/inventory.md) — Inventory & Assignment Pack v1 (stock, athlete assignments, movements)
- [docs/import-export.md](docs/import-export.md) — Import / Export & Bulk Operations Foundation v1 (athlete / guardian / link imports, shared bulk bar, CSV exports)
- [docs/onboarding.md](docs/onboarding.md) — Club Onboarding Wizard + Import Templates Foundation v1 (guided club setup, per-step templated imports, dependency-aware go-live)
- [docs/media.md](docs/media.md) — Athlete Photo & Media Foundation v1 (profile photo upload / replace / remove, tenant-isolated storage)

## Security

Do not commit `.env` files or secrets. Use `.env.example` files as templates only.
