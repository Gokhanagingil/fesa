# Architecture

## Monorepo

npm workspaces unite `apps/*` and `packages/*`. Shared code lives in packages; applications consume them via workspace dependencies.

## Frontend (`apps/web`)

- **Stack**: React 19, TypeScript, Vite 6, Tailwind CSS 4, React Router 7.
- **i18n**: `i18next` + `react-i18next`; locale files under `src/i18n/locales/{lng}/`.
- **UX**: App shell (sidebar + header), page headers, list toolbar pattern for export/bulk readiness, empty states.
- **API access**: Development uses Vite proxy (`/api` → `http://localhost:3000`). Production can use same-origin `/api` behind a reverse proxy or `VITE_API_BASE_URL` when introduced.

## Backend (`apps/api`)

- **Stack**: NestJS 11, TypeORM, PostgreSQL driver, `@nestjs/config` with Joi validation.
- **Config**: Environment variables validated at bootstrap; see `apps/api/.env.example`.
- **Health**: `GET /api/health` checks DB connectivity; `GET /api/health/live` for process liveness.
- **Modules**: Feature folders under `src/modules/*` (`auth`, `tenant`, `athlete`, `guardian`, `group`, `team`, `coach`, `sport-branch`, `training`, `private-lesson`, `communication`, `finance`, `reporting`). Domain APIs remain tenant-aware, but internal staff endpoints now rely on authenticated staff sessions plus explicit tenant membership.
- **Migrations**: SQL migrations under `src/database/migrations`; see [migrations.md](./migrations.md).

## Multi-tenant direction

- Data is modeled with `tenantId` on tenant-scoped entities.
- `Tenant` is a first-class entity to avoid retrofitting boundaries later.
- Internal staff access now has a lean but real identity foundation:
  - `staff_users`
  - `tenant_memberships`
  - `staff_sessions`
- The backend still resolves an active tenant per request, but authenticated staff users are now constrained to:
  - their explicit memberships for tenant-scoped work, or
  - platform-level access when their platform role is `global_admin`.
- Guardian portal authentication stays separate from staff/admin authentication on purpose:
  - guardian sessions remain limited and family-facing
  - staff sessions power the internal operational shell

## Auth/session model

- **Staff/admin**: httpOnly session cookie backed by hashed session tokens in the database.
- **Guardian portal**: separate httpOnly session cookie and session table, already scoped to guardian + tenant.
- **Frontend shell**:
  - `AuthProvider` loads the current staff session
  - `TenantProvider` loads the authenticated user’s available tenant memberships
  - route protection sends unauthenticated staff users to `/login`

## Release-quality hardening

- Dashboard, reports, communications, and action-center summaries now degrade gracefully when optional/supporting reporting tables are unavailable during a partial staging migration state.
- This keeps critical overview pages available instead of allowing one missing support relation to crash the whole command-center surface.

## Billing & Licensing Foundation v1 (Wave 22)

The platform now has a serious internal commercial backbone:

- `license_plans` (Starter / Operations / Growth) and per-plan
  `license_plan_entitlements` rows centralize feature gating.
- `tenant_subscriptions` carry one row per tenant with an explicit
  lifecycle (`trial / active / suspended / expired / cancelled`),
  start / renewal / trial-end dates, an `onboardingServiceIncluded`
  seam, internal notes, and lightweight actor traceability.
- `license_usage_bands` are stored in the database (not hardcoded)
  so platform admins can tune athlete-band ranges without a code
  change.
- `tenant_usage_snapshots` is append-only and captures
  `(tenantId, measuredAt, activeAthleteCount, bandCode)` for honest
  history.
- `LicensingService.isFeatureEnabled(tenantId, featureKey)` is the
  single read-shape every gate routes through, and
  `getTenantEntitlements(tenantId)` produces the full snapshot for
  internal admin tooling. Suspended / expired / cancelled
  subscriptions evaluate every gate to `false` at the engine
  boundary so commercial state stays honest.
- `PlatformAdminGuard` seals the entire `/api/admin/licensing/*`
  surface to `global_admin` staff users; tenant admins only see a
  calm read-only summary at `/api/licensing/me` and inside
  `/app/settings`.
- The `/app/billing` console is platform-admin-only and is filtered
  out of the staff sidebar for everyone else.

See [`billing-licensing.md`](./billing-licensing.md) for the full
domain, lifecycle, gating, seeding, and validation contract.

## Reporting Foundation v1 (Wave 11)

The reporting subsystem now exposes a reusable, metadata-driven filtering layer
that can be reused across list pages, the report builder, and CSV export
without duplicating per-page logic. See [reporting.md](./reporting.md) for the
field catalog, filter tree grammar, and saved-view persistence model.

Key invariants:

- Tenant isolation is enforced inside the query compiler (and inside every
  relation subquery), never as part of the user-supplied filter tree.
- Relation traversal is **explicit**: only joins declared in the catalog can be
  reached, no arbitrary path traversal.
- Saved views live in the existing `saved_filter_presets` table to avoid
  duplicate persistence.

## Docker / deployment

- Not required in wave one; PostgreSQL is expected locally or via Docker.
- The API listens on `API_PORT` (default `3000`) with global prefix `API_GLOBAL_PREFIX` (default `api`).
- Future: single `Dockerfile` per app or multi-stage image; reverse proxy TLS termination on Hetzner or similar.

## Code quality

- Root ESLint flat config for API and web TypeScript.
- Prettier at repository root for consistent formatting.

## CI (GitHub Actions)

Pull requests and pushes to `main` run install, a lightweight repo guard (`npm run repo:guard`), lint, and build. There is no deployment in CI yet; see the root [README.md](../README.md#continuous-integration-github-actions) for workflow names and triggers. Future waves can add staging deploy, database-backed tests, or scheduled jobs as separate workflows without replacing this foundation.
