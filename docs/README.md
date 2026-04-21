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
| [onboarding.md](./onboarding.md) | Club Onboarding Wizard + Import Templates Foundation v1 — guided club setup with templated imports per step |
| [media.md](./media.md) | Athlete Photo & Media Foundation v1 — profile photo upload / replace / remove, tenant-isolated storage |
| [parent-portal.md](./parent-portal.md) | Parent Access & Portal Foundation + Tenant Branding Foundation v1 — invitation-based guardian access, calm mobile-first parent home, controlled tenant branding |
| [stabilization-gate.md](./stabilization-gate.md) | FESA Stabilization & Productization Gate — cross-module hardening pass between feature waves (action-center reliability, portal trust, settings deep-links, mobile polish, validator) |
| [finance-clarity-pack.md](./finance-clarity-pack.md) | Athlete Charges Flow Flattening & Collections Clarity Pack — depth-first staff finance simplification (single action drawer, attention strip, calmer finance hub, validator) |
| [trust-calm-pass.md](./trust-calm-pass.md) | FESA Stabilization & Productization Gate — Trust & Calm Pass — second hardening sweep (landing locale parity, localized API error fallback, parent action page id-guard + mobile primary, portal sign-out tap target, communications error surfacing, validator + smoke) |
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
- **Wave seventeen (current)**: Parent Access & Portal Foundation + Tenant Branding Foundation v1 — invitation-based guardian access, a calm mobile-first parent home distinct from admin surfaces, and a controlled per-tenant brand surface (logo, display name, primary/accent color, welcome copy) under the "branded shell, controlled product core" model.
- **Stabilization & Productization Gate (current)**: explicit hardening sprint between feature waves — cross-module friction removed, action-center reliability strengthened, parent-portal trust improved (refetch-on-focus, calm past-requests archive, no dead bottom-nav anchors, recovery escape from dead invites), settings deep-links honoured, mobile polish on the highest-traffic surfaces, plus a pure-Node `stabilization:gate:test` validator that protects every contract this sprint introduced. Details: [stabilization-gate.md](./stabilization-gate.md).
- **Athlete Charges Flow Flattening & Collections Clarity Pack (current)**: depth-first, mobile-first simplification of the staff-side finance surfaces. The athlete charges page becomes one calm operational journey (single action drawer for record-collection / bulk-assign / periodic-generation, an in-page "who needs attention" strip, advanced fields demoted), and the finance hub leads with summary → primary action surface → priority collections → demoted "more tools" strip with reporting and the advanced explorer. Backend behavior is unchanged; a new pure-Node `finance:clarity:test` validator protects every contract this sprint introduced. Details: [finance-clarity-pack.md](./finance-clarity-pack.md).
- **Trust & Calm Pass (current)**: second hardening sweep on top of the stabilization gate and the clarity pack. Closes a small set of cross-module trust regressions discovery surfaced — the public landing page no longer renders raw i18n keys for English visitors, the shared API client falls back through a localized error message instead of hardcoded English, the parent action page is no longer infinite-spinner-able and now ships a mobile-first primary submit with parent-tone copy, the portal sign-out chip is a real thumb target on a phone, and the staff communications page surfaces backend failures instead of silently emptying every dropdown. A new pure-Node `trust:calm:test` validator and a new `GuardianPortalActionPage.smoke.test.tsx` protect every contract this pass introduced. Details: [trust-calm-pass.md](./trust-calm-pass.md).

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
