# AGENTS.md

## Cursor Cloud specific instructions

### Overview

Fesa / Amateur is a TypeScript/Node.js monorepo for a multilingual amateur sports club management platform.

| Package | Path | Purpose |
|---------|------|---------|
| `@amateur/api` | `apps/api` | NestJS API (port 3000, prefix `/api`) |
| `@amateur/web` | `apps/web` | React + Vite SPA (port 5173, proxies `/api` → `:3000`) |
| `@amateur/shared-types` | `packages/shared-types` | Shared TS type contracts |
| `@amateur/shared-config` | `packages/shared-config` | Shared configuration helpers |

### Prerequisites

- **Node.js 20+** (v22 works fine)
- **PostgreSQL 14+** — the only external dependency. No Redis, message queues, or third-party APIs.

### Database setup (one-time)

PostgreSQL must be running with a database and user matching `DATABASE_URL` in `apps/api/.env`. Default: `postgresql://amateur:amateur@localhost:5432/amateur`.

```bash
sudo pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE USER amateur WITH PASSWORD 'amateur' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE amateur OWNER amateur;"
```

After the database exists:

```bash
cp apps/api/.env.example apps/api/.env
npm run migration:run -w @amateur/api
npm run seed:demo
```

The seed creates 4 demo clubs and staff accounts. See `docs/bootstrap.md` for credentials and UUIDs. Uncomment `DEV_TENANT_ID=a0000001-0000-4000-8000-000000000001` in the `.env` for default tenant resolution.

### Running services

Standard commands from README — run from repo root:

- **API (dev):** `npm run start:dev -w @amateur/api` → `http://localhost:3000/api/health`
- **Web (dev):** `npm run dev -w @amateur/web` → `http://localhost:5173`

### Lint / Build / Checks

- `npm run lint` — ESLint across all workspaces (must pass with `--max-warnings 0`)
- `npm run build` — builds shared packages first, then API and web
- `npm run i18n:check` — validates TR/EN locale key parity
- `npm run repo:guard` — structure/workspace checks

### Demo login credentials

| Account | Email | Password |
|---------|-------|----------|
| Global admin | `platform.admin@amateur.local` | `Admin123!` |
| Club admin (Kadıköy) | `club.admin@amateur.local` | `Admin123!` |

Login at `http://localhost:5173/login`. See `docs/bootstrap.md` for full list.

### Gotchas

- PostgreSQL must be started manually on VM boot: `sudo pg_ctlcluster 16 main start`
- The web Vite dev server proxies `/api` to `localhost:3000` — the API must be running first for login and data to work.
- `npm run build` must be run before `npm run migration:run` or `npm run seed:demo` because those commands use compiled JS from `dist/`.
- The API uses `DB_SYNCHRONIZE=true` by default in dev, so schema changes auto-sync. For production-like testing, set `DB_SYNCHRONIZE=false` and use migrations.
