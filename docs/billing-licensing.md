# Billing & Licensing Foundation v1

This wave introduces the technical and operational backbone for the
amateur platform's commercial model. It is intentionally a control
plane, **not** an invoicing or accounting system.

## What it is

- A first-class **Plan** model (`Starter`, `Operations`, `Growth`).
- A **Plan ↔ Entitlement** mapping for centralized feature gating.
- A **Tenant Subscription** row per club with an explicit lifecycle.
- A **Usage Band** model evaluated against active-athlete count.
- An **append-only Tenant Usage Snapshot** log for honest history.
- A **platform-admin-only** internal control surface at
  `/app/billing` and a **calm read-only summary card** for tenant
  admins inside `/app/settings`.

## What it is **not**

- Not a billing processor or pricing book.
- Not parent-paid usage billing.
- Not an ad system or sponsor engine.
- Not a finance / accounting ledger.
- Not a tenant-admin-managed surface — tenant admins cannot change
  plans, entitlements, lifecycle states, usage bands, or add-ons.

## Domain model

| Entity | Purpose |
|--------|---------|
| `license_plans` | Starter / Operations / Growth, plus `isDefaultTrial` and `displayOrder` for stable presentation. |
| `license_plan_entitlements` | One `(planId, featureKey)` row per mapped capability with `enabled` + optional `limitValue`. |
| `license_usage_bands` | Config-driven athlete bands `[minAthletes, maxAthletes)`. |
| `tenant_subscriptions` | One row per tenant — plan, lifecycle status, dates, optional onboarding-service flag, internal notes, actor columns. |
| `tenant_usage_snapshots` | Append-only history of `(tenantId, measuredAt, activeAthleteCount, bandCode)`. |

Migration: `1746800000000-Wave22BillingLicensingFoundation.ts`.

### Lifecycle states

`trial → active → suspended → expired → cancelled` (in any sensible
direction). `trial` and `active` are the only "license active" states;
`suspended`, `expired`, and `cancelled` collapse every entitlement to
`false` at the engine boundary so commercial state stays honest.

### Feature key catalog

Canonical feature keys live in
`apps/api/src/modules/licensing/license.constants.ts`
(`LICENSE_FEATURE_KEYS`). Adding a new key is cheap (one entry there,
optional plan rows in `license_plan_entitlements`, callers opt in via
the engine helper). Today's catalog:

- `onboarding.assisted_import`
- `reporting.advanced_builder`
- `communications.follow_up`
- `parent_portal.branding`
- `parent_portal.targeted_updates`
- `inventory.management`
- `private_lessons.module`

## Entitlement engine

`LicensingService.getTenantEntitlements(tenantId)` is the single
read-shape every gate routes through. Helpers:

- `isFeatureEnabled(tenantId, featureKey): Promise<boolean>` — the
  primary backend gate.
- `getTenantEntitlementsPublicSummary(tenantId)` — the calmer, much
  smaller payload exposed to tenant admins via `/api/licensing/me`.
- `evaluateUsage(tenantId)` and `recordUsageSnapshot(tenantId)` —
  live evaluation + append-only snapshot.

The engine evaluates exactly one band per tenant per snapshot. The
band tells the platform "where does this tenant sit right now?" — it
does **not** directly cap functionality. Capping is the entitlement
engine's job.

## Usage band evaluation

The default seeded bands are:

| Code | Range | Label |
|------|-------|-------|
| `community` | 0 – 75 | Community |
| `club` | 76 – 200 | Club |
| `academy` | 201 – 500 | Academy |
| `federation` | 500+ | Federation |

Bands are stored in the database (not hardcoded) so platform admins
can tune them without a code change. Snapshots can be on-demand or
periodic; the engine returns the same shape from a live count.

## API surface

**Platform-admin only** (`/api/admin/licensing/*`, gated by
`PlatformAdminGuard`):

- `GET  /admin/licensing/plans` — plans + entitlements.
- `GET  /admin/licensing/feature-keys` — canonical catalog.
- `GET  /admin/licensing/bands` — usage bands.
- `GET  /admin/licensing/subscriptions` — every tenant's commercial state.
- `GET  /admin/licensing/subscriptions/:tenantId` — single tenant.
- `PUT  /admin/licensing/subscriptions/:tenantId` — assign / update.
- `GET  /admin/licensing/usage/:tenantId/snapshots` — recent snapshots.
- `POST /admin/licensing/usage/:tenantId/snapshots` — record one now.
- `GET  /admin/licensing/usage/:tenantId/evaluation` — live evaluation.
- `GET  /admin/licensing/entitlements/:tenantId` — full entitlement snapshot.

**Tenant-readable summary**:

- `GET /api/licensing/me` — calm read-only summary, gated by
  `TenantGuard`. Tenant admins can see their plan, lifecycle, trial
  / renewal dates, active-athlete count, and evaluated band — and
  nothing else.

## Frontend

- **`/app/billing`** — Billing & Licensing console. Three tabs:
  *Tenant subscriptions* (default), *Plans & entitlements*, and
  *Usage & evaluation*. Visible only when
  `staffUser.platformRole === 'global_admin'`. Tenant admins are
  redirected to `/app/dashboard`.
- **Sidebar** — the `Billing & Licensing` entry is filtered out of
  the navigation for non-platform-admins so commercial controls
  cannot leak into a club's day-to-day workflow.
- **Settings** — `TenantLicenseSummary` renders a calm read-only
  card on every tenant admin's settings page so they can inspect
  their own license without exposing internal control complexity.

## Seed

`apps/api/src/database/seed/licensing-seed.ts` is idempotent and:

1. Upserts the three plans + their entitlement matrix.
2. Upserts the four usage bands.
3. Upserts one tenant subscription per demo club so the platform-
   admin console always has realistic lifecycle examples on first
   login (Operations active, Growth active, Starter trial,
   Operations suspended).

## Validation

- `npm run lint` and `npm run repo:guard` keep structural integrity.
- `npm run i18n:check` enforces EN + TR parity for every new copy
  block (`app.nav.billing`, `pages.billing`, `pages.settings.licensing`).
- `npm run billing:licensing:test` is a pure-Node validator that
  asserts the entity layout, migration FKs, controller boundaries,
  guard application, seed coverage, and frontend gating contract.
- `npm run frontend:smoke` continues to pass.

## Intentionally deferred

- Pricing storage, invoicing, and payment processor integration.
- A full add-on catalog (the current model carries one
  `onboardingServiceIncluded` boolean as a small, justified seam).
- A subscription history / audit log beyond the lightweight
  `lastChangedByStaffUserId` actor column.
- Tenant-admin-facing self-service plan changes.
- Automated band transitions or scheduled snapshots (the manual
  snapshot button is enough for v1; the table is shaped to support
  scheduled writes when they arrive).
