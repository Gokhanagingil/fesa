# Staging deployment (Hetzner Ubuntu, manual GitHub Actions)

This wave delivers a **transparent, manual-trigger** path from GitHub Actions to a single staging server: **SSH → git sync → install → build → migrations → demo seed → PM2 reload → health check**. Docker, SSL automation, and blue/green deploys are intentionally out of scope.

## Overview

| Piece | Role |
|-------|------|
| [`.github/workflows/staging-deploy.yml`](../.github/workflows/staging-deploy.yml) | `workflow_dispatch` job using the **staging** GitHub Environment |
| [`deploy/staging/deploy.sh`](../deploy/staging/deploy.sh) | Server-side sequence (run via SSH stdin from CI or manually) |
| [`deploy/staging/health-check.sh`](../deploy/staging/health-check.sh) | Local HTTP + PM2 checks after deploy |
| [`deploy/staging/ecosystem.config.cjs`](../deploy/staging/ecosystem.config.cjs) | PM2 config for the Nest API |
| [`deploy/staging/nginx/fesa-staging.conf.template`](../deploy/staging/nginx/fesa-staging.conf.template) | Example Nginx: static `apps/web/dist` + `/api` → Node |

**Process model:** PM2 runs **only the API**. The browser-facing site is **static files** from `apps/web/dist` served by Nginx (recommended). Same-origin `/api` avoids CORS configuration for typical staging.

## GitHub: required secrets and variables

Configure under **Settings → Environments → staging** (or repository variables if you prefer — the workflow reads from the `staging` environment).

| Kind | Name | Purpose |
|------|------|---------|
| Secret | `STAGING_SSH_KEY` | Private key for SSH (PEM/OpenSSH); **never** commit |
| Variable | `STAGING_HOST` | Server hostname or IP |
| Variable | `STAGING_USER` | SSH user (e.g. `deploy`) |
| Variable | `STAGING_PORT` | SSH port (often `22`) |
| Variable | `STAGING_APP_DIR` | Absolute path to the git checkout on the server (e.g. `/opt/fesa`) |

The workflow also validates that these are present before connecting.

## Server prerequisites (one-time)

Install on the Ubuntu host:

- **Node.js 20+** and npm 10+ (e.g. via NodeSource or `nvm`)
- **Git**
- **PostgreSQL** reachable from the server (local or managed) with a database for staging
- **PM2** globally: `sudo npm install -g pm2` (optional but required for the provided automation)
- **Nginx** (recommended) to serve the web build and reverse-proxy `/api` to the API port

Optional: `pm2 startup` so processes survive reboot (documented in PM2 docs).

### First-time app directory and secrets

1. Create the app root directory (must match `STAGING_APP_DIR`), owned by the deploy user.
2. **Do not** commit secrets. On the server, create `apps/api/.env` with at least `DATABASE_URL` and staging-oriented settings:

   ```bash
   cp apps/api/.env.staging.example apps/api/.env
   chmod 600 apps/api/.env
   # edit DATABASE_URL, NODE_ENV=staging, CORS_ORIGIN if needed
   ```

3. If the repo is **private**, the bootstrap `git clone` in `deploy.sh` will fail unless the server has credentials (HTTPS token in git credential helper, or SSH remote). Easiest: **clone once manually** with a deploy key, then future runs only need `git fetch` (already authenticated).

4. Copy and adjust the [Nginx template](../deploy/staging/nginx/fesa-staging.conf.template): set `root` to `$STAGING_APP_DIR/apps/web/dist`, confirm `proxy_pass` matches `API_PORT` in `apps/api/.env`.

## Environment strategy

| Location | What belongs there |
|----------|---------------------|
| **Server** `apps/api/.env` | `DATABASE_URL`, `NODE_ENV`, `API_*`, `DB_*`, `CORS_ORIGIN`, optional `DEV_TENANT_ID` — **secrets stay on the server** |
| **GitHub staging env** | SSH + path variables above; optional future: non-secret staging URLs for notifications |
| **Repo** | Only **examples**: `apps/api/.env.example`, `apps/api/.env.staging.example`, `apps/web/.env.staging.example` |

The deploy workflow does **not** write database passwords into the repo; it assumes `apps/api/.env` already exists or is created once from `.env.example` with manual editing.

**`NODE_ENV=staging`:** Supported by API env validation. TypeORM `synchronize` defaults to **false** unless `DB_SYNCHRONIZE=true` is set (safe for staging when migrations are used).

## How to run a deploy

1. GitHub → **Actions** → **Staging deploy** → **Run workflow**
2. Set **git ref** (default `main` or a branch/tag/SHA)
3. Watch the job: **remote deploy** → **health check**

Failure messages are split by step: SSH/setup, remote script errors, or health check.

## Deploy flow (exact order)

1. Validate GitHub env vars + `STAGING_SSH_KEY`
2. Checkout workflow repo (audit trail only; server pulls its own git ref)
3. SSH: run `deploy/staging/deploy.sh` with `FESA_REPO_ROOT` + `DEPLOY_GIT_REF`
4. On server: ensure repo exists → fetch/checkout ref → `npm ci` → `npm run build` (root) → `migration:run` → `seed:demo` → `pm2 startOrReload` API
5. SSH: run `health-check.sh` (`/api/health/live`, `/api/health`, PM2 describe)

## Rollback / recovery

- **Redeploy an older ref:** Run the workflow again with a previous **commit SHA** or branch name.
- **Broken deploy:** SSH in, `cd $STAGING_APP_DIR`, `git log`, `git checkout` a known-good SHA, run `bash deploy/staging/deploy.sh` manually with `DEPLOY_GIT_REF` unset (script uses current checkout after manual checkout — for simplicity, prefer re-running the workflow with the good SHA).
- **Database:** Migrations are forward-only in this pack; use DB backups for destructive mistakes (not automated here).

## What stays manual in this wave

- OS packages (Node, Nginx, PostgreSQL) and firewall
- TLS certificates and DNS
- Creating and securing `apps/api/.env`
- Nginx site enablement and `server_name`

## Related docs

- [bootstrap.md](./bootstrap.md) — demo seed semantics
- [migrations.md](./migrations.md) — migration policy
