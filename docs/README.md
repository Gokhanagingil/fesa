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
| [communication.md](./communication.md) | Communication & Follow-up Pack v1 — WhatsApp-first follow-up surface |
| [inventory.md](./inventory.md) | Inventory & Assignment Pack v1 — stock visibility, athlete assignments, movement history |
| [import-export.md](./import-export.md) | Import / Export & Bulk Operations Foundation v1 — guided imports, bulk actions, CSV exports |
| [media.md](./media.md) | Athlete Photo & Media Foundation v1 — profile photo upload / replace / remove, tenant-isolated storage |
| [bootstrap.md](./bootstrap.md) | Demo seed, idempotency, demo tenant id, staff login fixtures |
| [staging-deploy.md](./staging-deploy.md) | Manual GitHub Actions deploy to Ubuntu staging (SSH troubleshooting, PM2, Nginx) |
| [release-operations.md](./release-operations.md) | Pre-deploy gates, troubleshooting flow, and branch/hotfix discipline |

## Product direction

- **Who**: club admins and coaches; low-friction, mobile-friendly UX.
- **What**: operations beyond CRUD — schedules, attendance, fixtures, finance, reporting — introduced in later waves.
- **Wave one (done)**: scaffolding, health/config, minimal domain model, UX shell, i18n, conventions.
- **Wave two (done)**: athlete/guardian/training/attendance/finance primitives plus recurring scheduling, collections tracking, and command-center reporting.
- **Wave seven (done)**: Guardian Portal MVP with controlled guardian access, linked-athlete visibility, family-action completion, and staff review/apply controls inside the same operational system.
- **Wave eight (current)**: release-quality hardening plus staff/admin login, explicit tenant membership, global vs club admin semantics, and a lightweight admin/settings console.
- **Wave eleven (current)**: post-login bootstrap recovery, reliable tenant-context restoration, athlete lifecycle controls, and safer bulk club operations across roster, finance, and communications surfaces.

## Repository map

- `apps/web` — React + Vite + Tailwind frontend
- `apps/api` — NestJS API
- `packages/shared-types` — shared TypeScript contracts
- `packages/shared-config` — shared config keys/helpers
- `docs/` — this documentation set

## Running locally

See the root [README.md](../README.md) for install and start commands.

## CI

GitHub Actions runs lint, i18n parity, build, migration readiness, repeat-seed validation, and backend boot smoke on PRs and on pushes to `main`; optional manual runs are available. Details: [Continuous integration in the root README](../README.md#continuous-integration-github-actions).

## Staging

Manual staging deploy (SSH, PM2, Nginx template): [staging-deploy.md](./staging-deploy.md).
Release and hotfix workflow guidance: [release-operations.md](./release-operations.md).

## Deferred (intentionally)

- Fine-grained internal staff RBAC beyond the current global-admin / club-admin / membership foundation
- Tournament engine, statistics ingestion
- Inventory finance linkage (charge auto-creation from inventory) is intentionally out of v1 scope
- Payment capture, recommendations
- Advanced reporting execution and exports
- Accounting ledger, automated billing runs

These areas stay out of scope until dedicated waves; the current schema avoids dead-end shortcuts (indexed tenant keys, explicit membership rows).
