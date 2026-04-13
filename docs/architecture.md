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
- **Modules**: Feature folders under `src/modules/*` for future domains (`tenant`, `athlete`, `group`, `team`, `finance`, `reporting`). Only safe scaffolding is implemented now.

## Multi-tenant direction

- Data is modeled with `tenantId` on tenant-scoped entities.
- No fake auth: tenant resolution from JWT/subdomain belongs in a later wave.
- `Tenant` is a first-class entity to avoid retrofitting boundaries later.

## Docker / deployment

- Not required in wave one; PostgreSQL is expected locally or via Docker.
- The API listens on `API_PORT` (default `3000`) with global prefix `API_GLOBAL_PREFIX` (default `api`).
- Future: single `Dockerfile` per app or multi-stage image; reverse proxy TLS termination on Hetzner or similar.

## Code quality

- Root ESLint flat config for API and web TypeScript.
- Prettier at repository root for consistent formatting.
