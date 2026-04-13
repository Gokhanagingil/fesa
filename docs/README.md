# Amateur platform documentation

Codename **amateur**: a multilingual club operating platform for amateur sports organizations.

## Contents

| Document | Purpose |
|----------|---------|
| [architecture.md](./architecture.md) | Monorepo layout, boundaries, principles |
| [domain.md](./domain.md) | Athletes, guardians, membership, training, attendance, finance foundation |
| [migrations.md](./migrations.md) | TypeORM migrations vs synchronize |
| [i18n.md](./i18n.md) | Multilingual approach (TR/EN day one) |
| [reporting.md](./reporting.md) | Reporting and bulk-operation placeholders |
| [bootstrap.md](./bootstrap.md) | Demo seed, idempotency, demo tenant id |
| [staging-deploy.md](./staging-deploy.md) | Manual GitHub Actions deploy to Ubuntu staging (SSH troubleshooting, PM2, Nginx) |

## Product direction

- **Who**: club admins and coaches; low-friction, mobile-friendly UX.
- **What**: operations beyond CRUD — schedules, attendance, fixtures, finance, reporting — introduced in later waves.
- **Wave one (done)**: scaffolding, health/config, minimal domain model, UX shell, i18n, conventions.
- **Wave two (current)**: athlete/guardian/training/attendance/finance primitives, tenant-aware APIs, starter product UX, migration path.

## Repository map

- `apps/web` — React + Vite + Tailwind frontend
- `apps/api` — NestJS API
- `packages/shared-types` — shared TypeScript contracts
- `packages/shared-config` — shared config keys/helpers
- `docs/` — this documentation set

## Running locally

See the root [README.md](../README.md) for install and start commands.

## CI

GitHub Actions runs lint and build on PRs and on pushes to `main`; optional manual runs are available. Details: [Continuous integration in the root README](../README.md#continuous-integration-github-actions).

## Staging

Manual staging deploy (SSH, PM2, Nginx template): [staging-deploy.md](./staging-deploy.md).

## Deferred (intentionally)

- Full authentication and RBAC
- Tournament engine, statistics ingestion, inventory
- Payment capture, 1-to-1 lessons, recommendations
- Advanced reporting execution and exports
- Accounting ledger, automated billing runs

These areas stay out of scope until dedicated waves; the current schema avoids dead-end shortcuts (indexed tenant keys, explicit membership rows).
