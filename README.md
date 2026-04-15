# Fesa — Amateur platform

**Amateur** is the codename for a new multilingual club operating platform for amateur sports organizations. This repository is a **monorepo** with a React frontend, NestJS API, and shared packages.

## What’s inside

| Path | Description |
|------|-------------|
| `apps/web` | React + TypeScript + Vite + Tailwind — club ops UX, TR/EN i18n, domain starter screens |
| `apps/api` | NestJS + TypeORM + PostgreSQL — athletes, guardians, training, attendance, finance primitives |
| `packages/shared-types` | Shared TypeScript contracts |
| `packages/shared-config` | Shared configuration helpers |
| `docs/` | Architecture, domain, i18n, reporting notes |

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

Details, idempotency, and the demo tenant id are documented in [docs/bootstrap.md](docs/bootstrap.md). After seeding, you can set `DEV_TENANT_ID` in `apps/api/.env` to the documented UUID so the API defaults to the demo tenant without `X-Tenant-Id`.

API defaults:

- Base URL: `http://localhost:3000`
- Global prefix: `api` → health: `http://localhost:3000/api/health`
- **Tenant context (pre-auth):** send `X-Tenant-Id` with requests, or set `DEV_TENANT_ID` in `apps/api/.env`, or rely on the first tenant returned by `GET /api/tenants`. The web app stores the choice in `localStorage` and sends `X-Tenant-Id` automatically.

### Run the web app

In another terminal:

```bash
npm run dev -w @amateur/web
```

Open `http://localhost:5173`. The dev server proxies `/api` to the API.

### Build everything

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## Continuous integration (GitHub Actions)

CI validates the monorepo on **pull requests** and **pushes to `main`**. There is no deployment, Docker publish, or hosted database in CI yet.

| Workflow | Purpose |
|----------|---------|
| [CI](.github/workflows/ci.yml) | Installs with `npm ci`, runs a small [repo guard](scripts/repo-guard.mjs), then `npm run lint` and `npm run build` (workspace-aware). |
| [Manual validation](.github/workflows/manual-validate.yml) | Same checks on demand via **Actions → Manual validation → Run workflow** (useful when you are not opening a PR). |
| [Staging SSH check](.github/workflows/staging-ssh-check.yml) | Optional: verify GitHub → server SSH only (no deploy). Use when fixing `Permission denied (publickey)`. |

Reusable steps live in [.github/workflows/ci-reusable.yml](.github/workflows/ci-reusable.yml) so primary CI and manual runs stay in sync.

**Locally:** `npm run repo:guard` runs the structure/workspace checks only; full parity with CI is `npm ci`, `npm run repo:guard`, `npm run lint`, `npm run build`.

**Limitations:** API and web builds do not require a running PostgreSQL instance. Integration tests or migrations against a live DB are out of scope for this wave. Future workflows (staging deploy, scheduled hygiene, E2E) can be added alongside these files without changing the core validation pipeline.

## Staging deployment (Hetzner / manual Actions)

A first-wave **staging** path uses GitHub Actions (`workflow_dispatch`) to SSH into the server, sync the repo, install, build, run migrations and demo seed, and reload the API under **PM2**. Nginx serves the static web build and proxies `/api` to Nest.

- **Deploy workflow:** [.github/workflows/staging-deploy.yml](.github/workflows/staging-deploy.yml)
- **SSH-only debug workflow:** [.github/workflows/staging-ssh-check.yml](.github/workflows/staging-ssh-check.yml)
- **Full guide:** [docs/staging-deploy.md](docs/staging-deploy.md) (secrets, variables, SSH troubleshooting, server prep, Nginx template, rollback hints)
- **On-server validation:** [deploy/staging/server-validate.sh](deploy/staging/server-validate.sh) (run on Hetzner as the deploy user)

## Multilingual UX

Turkish and English are wired via `i18next` in `apps/web`. Locale files live under `apps/web/src/i18n/locales/`. See [docs/i18n.md](docs/i18n.md).

## Club operations core workflows

Wave 2 turns the existing operational core into a more complete command center without introducing parallel modules:

- **Athletes + guardians:** existing athlete and guardian flows remain in place, with finance and roster context now feeding more directly into day-to-day management.
- **Groups + teams:** the group-first / optional-team model remains unchanged and continues to drive scheduling, rosters, and attendance safely.
- **Training + attendance:** training now supports calendar-oriented filtering, recurring session generation, and safe bulk cancellation / rescheduling on top of the existing session and attendance routes.
- **Collections + balances:** charge assignment still starts from reusable charge items, but clubs can now record payments with explicit allocations to athlete charges and see paid / partial / overdue / outstanding state clearly.
- **Dashboard + reporting:** the dashboard and reports pages now surface live operational and collection summaries instead of placeholder counts and disabled report affordances.

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

## Security

Do not commit `.env` files or secrets. Use `.env.example` files as templates only.
