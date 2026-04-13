# Amateur platform documentation

Codename **amateur**: a multilingual club operating platform for amateur sports organizations.

## Contents

| Document | Purpose |
|----------|---------|
| [architecture.md](./architecture.md) | Monorepo layout, boundaries, principles |
| [domain.md](./domain.md) | Group vs Team and foundational entities |
| [i18n.md](./i18n.md) | Multilingual approach (TR/EN day one) |
| [reporting.md](./reporting.md) | Reporting and bulk-operation placeholders |

## Product direction

- **Who**: club admins and coaches; low-friction, mobile-friendly UX.
- **What**: operations beyond CRUD — schedules, attendance, fixtures, finance, reporting — introduced in later waves.
- **This wave**: scaffolding, health/config, minimal domain model, UX shell, i18n, and conventions only.

## Repository map

- `apps/web` — React + Vite + Tailwind frontend
- `apps/api` — NestJS API
- `packages/shared-types` — shared TypeScript contracts
- `packages/shared-config` — shared config keys/helpers
- `docs/` — this documentation set

## Running locally

See the root [README.md](../README.md) for install and start commands.

## Deferred (intentionally)

- Full authentication and RBAC
- Tournament engine, statistics ingestion, inventory
- Payment workflows, 1-to-1 lessons, recommendations
- Advanced reporting execution and exports

These areas have module or schema hooks where appropriate; they are not implemented in wave one.
