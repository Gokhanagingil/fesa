# Fesa — Amateur platform

**Amateur** is the codename for a new multilingual club operating platform for amateur sports organizations. This repository is a **monorepo** with a React frontend, NestJS API, and shared packages.

## What’s inside

| Path | Description |
|------|-------------|
| `apps/web` | React + TypeScript + Vite + Tailwind — UX shell, TR/EN i18n, starter pages |
| `apps/api` | NestJS + TypeORM + PostgreSQL — config, health checks, domain scaffolding |
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

API defaults:

- Base URL: `http://localhost:3000`
- Global prefix: `api` → health: `http://localhost:3000/api/health`

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

## Multilingual UX

Turkish and English are wired via `i18next` in `apps/web`. Locale files live under `apps/web/src/i18n/locales/`. See [docs/i18n.md](docs/i18n.md).

## Domain: Group vs Team

**Groups** (table `club_groups`) are training cohorts / age buckets. **Teams** are squads; they may optionally link to a group (`teams.group_id` nullable). See [docs/domain.md](docs/domain.md).

## Documentation

- [docs/README.md](docs/README.md) — index
- [docs/architecture.md](docs/architecture.md) — structure and principles
- [docs/domain.md](docs/domain.md) — modeling notes
- [docs/i18n.md](docs/i18n.md) — localization
- [docs/reporting.md](docs/reporting.md) — reporting and bulk placeholders

## Security

Do not commit `.env` files or secrets. Use `.env.example` files as templates only.
