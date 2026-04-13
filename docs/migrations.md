# Database migrations

## Current setup

- **TypeORM** loads entity metadata from `apps/api/src/database/entities`.
- **SQL migrations** live in `apps/api/src/database/migrations` and compile to `dist/database/migrations/*.js`.
- **Order:** `Wave1TenantCatalogFoundation` creates `tenants` and catalog tables (`sport_branches`, `age_groups`, `club_groups`, `teams`, …). `Wave2DomainFoundation` adds operational tables that reference those. Run all pending migrations in timestamp order.
- **`AppDataSource`** (`apps/api/src/database/data-source.ts`) is used by the TypeORM CLI for `migration:run` / `migration:revert`.

## Environment flags

| Variable | Purpose |
|----------|---------|
| `DB_SYNCHRONIZE` | When `true`, TypeORM may auto-alter schema in dev. When `false`, schema changes must go through migrations. Default if unset: `true` in non-production, aligned with historical dev convenience. |
| `DB_RUN_MIGRATIONS` | When `true`, the API runs pending migrations on startup (useful for staging/production). Default: `false`. |

## Commands

From the repository root:

```bash
npm run migration:run -w @amateur/api
```

Revert the last applied migration:

```bash
npm run migration:revert -w @amateur/api
```

Requires `DATABASE_URL` to point at a reachable PostgreSQL instance.

## Recommended workflow

1. Develop entities in TypeORM as usual.
2. Add or update a migration file (see existing `Wave2DomainFoundation` migration as a template).
3. Run `migration:run` against local DB.
4. Set `DB_SYNCHRONIZE=false` in shared environments once the team agrees; keep `true` locally only if you accept drift risk.

## Next concrete step (if not done yet)

- Add a CI job that runs `npm run migration:run -w @amateur/api` against a disposable Postgres container to verify migrations apply cleanly.
