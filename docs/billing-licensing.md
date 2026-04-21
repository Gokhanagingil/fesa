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
- Tenant-admin-facing self-service plan changes.
- Automated band transitions.

# Billing & Licensing Operationalization Pack v1 (Wave 23)

Wave 22 modeled the commercial backbone. Wave 23 turns it into an
operational control plane without rewriting any of it.

## What changed

- **Real gating** is now active for three high-value capabilities,
  routed exclusively through `LicensingService`:
  - `parent_portal.branding` — gates staff branding writes (PUT
    `/tenant/branding`, POST/DELETE `/tenant/branding/logo`).
  - `communications.follow_up` — gates direct delivery attempts
    (`POST /communications/outreach/:id/deliver`). Manual logging
    of outreach stays available on every plan.
  - `reporting.advanced_builder` — gates the saved-views CRUD and
    CSV export. Starter views, definitions, and ad-hoc `run` stay
    available on every plan.
- **Subscription history** (`tenant_subscription_history`,
  Wave 23 migration) records every plan / lifecycle / dates change
  with the actor and a compact diff. Read via
  `GET /admin/licensing/subscriptions/:tenantId/history`.
- **Plan entitlement editing** is now controlled-UI-only — no DB
  access required. Endpoints:
  - `GET  /admin/licensing/plans/:planCode/edit`
  - `PUT  /admin/licensing/plans/:planCode/entitlements/:featureKey`
  - `GET  /admin/licensing/feature-catalog`
- **Scheduled usage snapshots** are written by a small in-process
  scheduler (`LicensingSnapshotScheduler`). It runs once shortly
  after API boot and then daily. Append-only and idempotent — the
  writer skips when the active-athlete count and band have not
  changed since the last snapshot in the window. Manual snapshot
  capability is preserved.
  - Disable in any environment with
    `LICENSING_SNAPSHOT_SCHEDULER=disabled`.
  - Tune the cadence with `LICENSING_SNAPSHOT_INTERVAL_MS` (defaults
    to 24h; minimum 60_000ms).
  - Trigger a one-shot manual pass via
    `POST /admin/licensing/usage/snapshots/run` (also wired into the
    Billing & Licensing console).
- **Tenant-side feature availability probe**:
  `GET /api/licensing/me/feature/:featureKey`. Always responds —
  never throws 403 — so the web UI can render calm "Available on
  Operations / Growth" copy instead of dead buttons.

## Engine improvements

`LicensingService` now exposes:

- `requireFeature(tenantId, featureKey)` — strict, throws
  `ForbiddenException` with `{ featureKey, reason }`.
- `getFeatureUnavailableReason(tenantId, featureKey)` — non-throwing,
  returns `null` when allowed, or a structured reason
  (`no_subscription` | `license_inactive` | `plan_excludes_feature`)
  for calm UX.
- `updatePlanEntitlement(planCode, featureKey, input)` — atomic
  per-feature upsert that invalidates the in-process entitlement
  cache.
- `recordUsageSnapshotIfChanged(tenantId, source, options)` — the
  append-aware writer used by the scheduler.
- `runScheduledSnapshotPass()` — full-platform pass.
- `listSubscriptionHistory(tenantId, limit)` — newest-first ledger.

A short-TTL per-tenant entitlement cache prevents the new gates
from hammering the database on hot endpoints. The cache is
invalidated on every commercial mutation we own.

## `FeatureGateGuard` + `@RequireFeature`

Other modules wire gates declaratively:

```ts
@Post('outreach/:id/deliver')
@UseGuards(FeatureGateGuard)
@RequireFeature(LICENSE_FEATURE_KEYS.COMMUNICATIONS_FOLLOW_UP)
attemptDelivery(...) { ... }
```

The guard is applied **after** `TenantGuard` so `req.tenantId` is
populated. Failure mode is `ForbiddenException({ featureKey,
reason })`, which the web client maps to calm copy keys under
`pages.gating.*`.

## Billing & Licensing console UX (post Wave 23)

The internal control surface stays calm and disciplined:

- Tabs: *Tenant subscriptions*, *Plans & entitlements*,
  *Edit entitlements*, *Usage & evaluation*, *Subscription history*.
- The entitlement editor is grouped by capability area (parent
  portal, communications, reporting, operations, onboarding) with a
  per-feature save flow — no giant atomic blob.
- Each feature is labelled "Gated capability" or "Catalog only" so
  platform admins know which toggles change real product behaviour
  today.
- Usage tab now exposes a "Run scheduled pass now" trigger and
  shows a Live / From snapshot badge.
- Subscription history renders one calm card per change with the
  diff chips, the actor (or "Platform admin"), the status reason,
  and the internal note.

## Tenant-side UX

- `parent_portal.branding`, `communications.follow_up`, and
  `reporting.advanced_builder` all surface a calm
  `FeatureAvailabilityNotice` instead of broken affordances when a
  plan does not include the capability.
- Wording distinguishes:
  - **No license assigned yet** (`no_subscription`),
  - **License paused** (`license_inactive`),
  - **Available on a higher plan** (`plan_excludes_feature`).
- Existing data is never described as "lost". Restrictions are
  legible and graceful.

## Validation

- `npm run billing:licensing:ops:test` — Wave 23 pure-Node
  validator. Asserts:
  - subscription history entity + migration shape;
  - LicensingService helpers (`requireFeature`,
    `updatePlanEntitlement`, `runScheduledSnapshotPass`, …);
  - `FeatureGateGuard` + `@RequireFeature` are exported and
    applied on the three gated controllers;
  - new platform-admin endpoints exist;
  - tenant-side feature availability probe exists;
  - new admin tabs and copy keys exist in EN + TR.
- All Wave 22 validators (`billing:licensing:test`, locale parity,
  repo guard, frontend smoke, etc.) continue to pass.

## Module-graph discipline

`LicensingModule` is declared `@Global()` so its providers
(`LicensingService`, `PlatformAdminGuard`, `FeatureGateGuard`) are
injectable from anywhere without forcing the consumer module to add
`LicensingModule` to its own `imports` array.

This is intentional and load-bearing for boot stability. During Wave 23
implementation we briefly added `LicensingModule` to `TenantModule`'s
`imports` so `StaffTenantBrandingController` could pull
`FeatureGateGuard` for `parent_portal.branding`. That introduced the
cycle:

```
TenantModule -> LicensingModule -> AuthModule -> TenantModule
```

Nest reports this exact cycle as
*"The module at index [N] of the AuthModule 'imports' array is
undefined"*, scoped to
`AppModule -> CoreModule -> TenantModule -> LicensingModule`, and the
API fails to boot.

Two rules keep this stable going forward and are enforced by
`scripts/api-module-graph.test.mjs`
(`npm run api:module-graph:test`):

1. `TenantModule` MUST NOT import `LicensingModule`.
2. `AuthModule` MUST NOT import `LicensingModule`.

The validator additionally walks every `*.module.ts` under
`apps/api/src/modules`, resolves all relative `*Module` imports
referenced inside each `@Module({ imports: [...] })` array, and fails
on:

- any unresolved relative module reference (the static equivalent of
  Nest's runtime "module at index [N] is undefined"); and
- any cycle in the module-import graph.

It runs in CI right before `api:boot:smoke`.
