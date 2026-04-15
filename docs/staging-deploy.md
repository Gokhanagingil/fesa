# Staging deployment (Hetzner Ubuntu, manual GitHub Actions)

This wave delivers a **transparent, manual-trigger** path from GitHub Actions to a single staging server: **SSH → git sync → install → build → migrations → demo seed → PM2 reload → health check**. Docker, SSL automation, and blue/green deploys are intentionally out of scope.

This repo now also treats staging deploys as the end of a validation chain, not the first time runtime safety is exercised:

- CI validates **lint**, **build**, **i18n parity**, **migration execution**, **repeatable demo seed**, and an **API boot smoke** against disposable Postgres.
- The server deploy script logs each major stage separately so failures are easier to localize.
- Shared diagnostics distinguish **process missing/crashing**, **app listening but health failing**, and **DB-backed health failures**.
- Branch hygiene matters: deploying a non-`main` ref is acceptable for investigation, but it is **not evidence that `main` is safe**.

## Overview

| Piece | Role |
|-------|------|
| [`.github/workflows/staging-deploy.yml`](../.github/workflows/staging-deploy.yml) | `workflow_dispatch` job using the **staging** GitHub Environment |
| [`.github/workflows/staging-ssh-check.yml`](../.github/workflows/staging-ssh-check.yml) | Optional **SSH-only** check (no deploy) — use when debugging auth |
| [`deploy/staging/deploy.sh`](../deploy/staging/deploy.sh) | Server-side sequence (run via SSH by CI or manually) |
| [`deploy/staging/health-check.sh`](../deploy/staging/health-check.sh) | Local HTTP + PM2 checks after deploy, including runtime commit / DB alignment |
| [`deploy/staging/server-validate.sh`](../deploy/staging/server-validate.sh) | **Run on the server** — manual validation checklist (read-only) |
| [`deploy/staging/ecosystem.config.cjs`](../deploy/staging/ecosystem.config.cjs) | PM2 config for the Nest API |
| [`deploy/staging/nginx/fesa-staging.conf.template`](../deploy/staging/nginx/fesa-staging.conf.template) | Example Nginx: static `apps/web/dist` + `/api` → Node |

**Process model:** PM2 runs **only the API**. The browser-facing site is **static files** from `apps/web/dist` served by Nginx (recommended). Same-origin `/api` avoids CORS configuration for typical staging. The web build now emits **`/build-info.json`** so staging can prove which frontend bundle Nginx is serving.

## GitHub: required secrets and variables

Configure under **Settings → Environments → staging** (repository variables are also supported; the workflow reads from the `staging` environment when the job uses `environment: staging`).

| Kind | Name | Purpose |
|------|------|---------|
| Secret | `STAGING_SSH_KEY` | **Private** key for SSH (full PEM/OpenSSH block, including `-----BEGIN … PRIVATE KEY-----` / `-----END …-----`); never commit |
| Variable | `STAGING_HOST` | Server hostname or IP |
| Variable | `STAGING_USER` | SSH login user on the server (must match `~/.ssh/authorized_keys` for the key you install) |
| Variable | `STAGING_PORT` | SSH port (often `22`) |
| Variable | `STAGING_APP_DIR` | Absolute path to the git checkout on the server (e.g. `/opt/fesa`) |

The workflow validates that these are present before connecting. `STAGING_APP_DIR` must start with `/`; `STAGING_PORT` must be numeric.

### Secret format (`STAGING_SSH_KEY`)

- Paste the **entire** private key into the GitHub secret (multi-line is normal).
- The **public** key derived from this secret must appear in **`/home/<STAGING_USER>/.ssh/authorized_keys`** on the server (one line per key).
- If your laptop uses a *different* key than the one in `STAGING_SSH_KEY`, your laptop can work while Actions fails — **compare fingerprints**:

  On your laptop (local key):

  ```bash
  ssh-keygen -lf ~/.ssh/id_ed25519.pub
  ```

  From the private key you put in GitHub (paste into a temp file locally, never commit):

  ```bash
  ssh-keygen -lf /path/to/staging-private-key
  ```

  The fingerprints must match the **same** `.pub` line you added to the server’s `authorized_keys`.

## How SSH works in Actions (and a common failure mode)

The workflow uses [webfactory/ssh-agent](https://github.com/webfactory/ssh-agent) to load `STAGING_SSH_KEY` into an **ssh-agent** socket (`SSH_AUTH_SOCK`).

The client uses **`IdentitiesOnly=yes`** so only intended keys are tried. On many OpenSSH builds you must also point the client at the agent explicitly; the workflow sets **`IdentityAgent=$SSH_AUTH_SOCK`** when the agent is present. Without that, SSH may not use the agent key and you can see:

`Permission denied (publickey,password).`

That pattern means the server did not accept any public key and (if allowed) could fall back to password — but **BatchMode** in the workflow disables interactive password auth, so the job fails fast.

**Repo-side fix already applied:** preflight SSH step + `IdentityAgent` + `BatchMode` + stricter host key scanning.

**Server-side:** ensure the public key matching `STAGING_SSH_KEY` is in the **correct user’s** `authorized_keys`, with correct permissions (see below).

## SSH troubleshooting (likely causes)

| Symptom / cause | What to check |
|-----------------|---------------|
| **Wrong key in GitHub** | Fingerprint of `STAGING_SSH_KEY` does not match any line in `authorized_keys` on the server. |
| **Wrong user** | `STAGING_USER` is not the account that owns the key (e.g. key is in `gokhan` but variable says `deploy`). |
| **Wrong host/port** | `STAGING_HOST` / `STAGING_PORT` do not match where sshd listens (firewall, NAT, custom port). |
| **authorized_keys permissions** | `~/.ssh` should be `700`; `authorized_keys` should be `600` and owned by the login user. |
| **sshd** | `PubkeyAuthentication yes`; `PasswordAuthentication` may be `no` (normal). Check with `sudo sshd -T \| grep pubkey`. |
| **Key type disabled** | Rare: `sshd_config` `PubkeyAcceptedAlgorithms` / `CASignatureAlgorithms` excluding your key type. |

### Manual checks on the server (as the deploy user)

Run after SSH via your **working** session (laptop), or from the server console:

```bash
whoami
hostname
ls -la ~/.ssh
wc -l ~/.ssh/authorized_keys
# Optional: show key types only (first field of each line)
awk '{print $1}' ~/.ssh/authorized_keys
```

Fix permissions if needed:

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

Add the **public** key that matches `STAGING_SSH_KEY` (get the `.pub` line from the same key pair):

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo 'ssh-ed25519 AAAA...your-public-line... comment' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### Debug from GitHub without full deploy

Use **Actions → Staging SSH check → Run workflow**. It only validates SSH and prints safe metadata (user, hostname, whether `STAGING_APP_DIR` exists).

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

### Full server validation script

On the server, from a clone of the repo (or copy the script):

```bash
export APP_ROOT=/path/to/your/checkout   # same as STAGING_APP_DIR
bash deploy/staging/server-validate.sh
```

This prints identity, SSH file metadata, tooling versions, repo presence, and whether `apps/api/.env` exists — **without** dumping secret values.

## Environment strategy

| Location | What belongs there |
|----------|---------------------|
| **Server** `apps/api/.env` | `DATABASE_URL`, `NODE_ENV`, `API_*`, `DB_*`, `CORS_ORIGIN`, optional `DEV_TENANT_ID` — **secrets stay on the server** |
| **GitHub staging env** | SSH + path variables above; optional future: non-secret staging URLs for notifications |
| **Repo** | Only **examples**: `apps/api/.env.example`, `apps/api/.env.staging.example`, `apps/web/.env.staging.example` |

The deploy workflow does **not** write database passwords into the repo; it assumes `apps/api/.env` already exists or is created once from `.env.staging.example` / `.env.example` with manual editing.

**`NODE_ENV=staging`:** Supported by API env validation. TypeORM `synchronize` defaults to **false** unless `DB_SYNCHRONIZE=true` is set (safe for staging when migrations are used).

## How to run a deploy

1. GitHub → **Actions** → **Staging deploy** → **Run workflow**
2. Set **git ref** (default `main` or a branch/tag/SHA)
3. Watch the job: **Preflight — SSH** → **remote deploy** → **health check**

Failure messages are split by step: validation, SSH preflight, remote script errors, or health check.

### Pre-deploy gates (expected before staging)

Before treating a ref as staging-ready, the following should be green:

```bash
npm run lint
npm run build
npm run i18n:check
npm run migration:check
npm run seed:demo:verify
npm run api:boot:smoke
```

These map directly to the failure classes that previously slipped into deploys:

- `lint` / `build`: syntax, typing, and bundling failures
- `i18n:check`: locale drift reaching staging
- `migration:check`: entity/schema parity or broken migrations
- `seed:demo:verify`: non-idempotent demo seed behavior
- `api:boot:smoke`: Nest runtime wiring/config/database boot regressions that compile successfully

## Deploy flow (exact order)

1. Validate GitHub env vars + `STAGING_SSH_KEY` (and sanity-check path/port)
2. Checkout workflow repo (audit trail; server pulls its own git ref)
3. Load SSH key into ssh-agent; record host keys in `known_hosts`
4. **Preflight:** one SSH command to confirm auth (fails fast with a clear error)
5. SSH: run `deploy/staging/deploy.sh` with `FESA_REPO_ROOT` + `DEPLOY_GIT_REF`
6. On server: ensure repo exists → fetch/checkout ref → `npm ci` → `npm run build` (root) → `migration:run` → `seed:demo` → `pm2 startOrReload` API
7. SSH: run `health-check.sh` (`/api/health/live`, `/api/health`, `/api/health/version`, `/build-info.json`, PM2 describe). Health check reads `API_PORT` from `apps/api/.env` when `FESA_REPO_ROOT` is set and verifies frontend/backend commit parity plus runtime DB name alignment.

The deploy script now prints stage banners in this order:

1. `sync-repo`
2. `ensure-api-env`
3. `install-dependencies`
4. `build-monorepo`
5. `run-migrations`
6. `run-demo-seed`
7. `reload-pm2`

That staging output should let you answer quickly whether the failure was:

- **build failure**
- **migration failure**
- **seed failure**
- **process start / PM2 failure**
- **liveness failure**
- **DB-backed health failure**

## Rollback / recovery

- **Redeploy an older ref:** Run the workflow again with a previous **commit SHA** or branch name.
- **Broken deploy:** Prefer **Run workflow** again with a known-good **git ref** (SHA or branch). If you must fix from SSH: `cd $STAGING_APP_DIR`, `git fetch`, `git checkout <sha>`, then run `DEPLOY_GIT_REF=<sha> bash deploy/staging/deploy.sh` (or check out `staging-deploy` branch after reset — simplest remains the Actions re-run).
- **Database:** Migrations are forward-only in this pack; use DB backups for destructive mistakes (not automated here).

## Failure triage flow

Use the first failing stage as the primary signal:

| Failure point | What it usually means | What to inspect first |
|---------------|------------------------|------------------------|
| CI `build` | code or bundling regression | PR diff, build logs |
| CI `migration:check` | migration chain or schema mismatch | latest migration file, entity changes, `docs/migrations.md` |
| CI `seed:demo:verify` | non-idempotent seed behavior | `apps/api/src/database/seed/demo-seed.ts` |
| CI `api:boot:smoke` | Nest provider wiring, config validation, DB connection, runtime boot path | boot smoke logs, `apps/api/src/main.ts`, module/provider changes |
| Deploy `run-migrations` | server DB/env mismatch or broken migration | `apps/api/.env`, DB connectivity, migration output |
| Deploy `run-demo-seed` | staging DB already conflicts with expected demo natural keys or seed logic regressed | seed logs, demo tenant/admin rows |
| Health `live` fails | process missing, crash loop, wrong port, PM2 issue | PM2 status + PM2 error log |
| Health `live` passes but `/api/health` fails | app is up but DB-backed health is failing | `DATABASE_URL`, DB reachability, latest migration state |

Both the workflow and `health-check.sh` now use the same diagnostics helper (`deploy/staging/diagnostics.sh`) so PM2 log discovery stays consistent. Diagnostics also include `/api/health/version` and `/build-info.json` to make frontend-vs-backend mismatch visible.

## Post-deploy verification (exact runtime identity)

After a successful deploy, these checks prove staging is serving the expected artifacts:

```bash
curl -fsS http://127.0.0.1:3000/api/health/version
curl -fsS http://127.0.0.1/build-info.json
```

What to verify:

- `commit` in `/api/health/version` matches `commit` in `/build-info.json`
- `database.currentName` matches `database.expectedName`
- the short SHA shown in the browser runtime badge matches the merged commit you expected to deploy

If `/build-info.json` is missing or has a different commit than `/api/health/version`, Nginx is not serving the freshly built `apps/web/dist` directory.

## Branch / hotfix discipline

Staging confusion often comes from proving a fix on a branch without proving it landed on `main`.

Rules for follow-up deploy fixes:

1. **Always branch from `origin/main`** for a new fix or hotfix.
2. **Never reuse a merged branch** for additional changes.
3. **Always create a fresh PR** for follow-up fixes.
4. Treat a deploy from a non-`main` ref as a **debugging deploy**, not release proof.
5. Before saying “main is fixed,” verify the exact commit is on `origin/main`.

Practical verification:

```bash
git fetch origin main
git log --oneline origin/main..HEAD
git branch -r --contains <fix-sha>
```

- If `git log origin/main..HEAD` prints commits, your branch still contains work not on `main`.
- `git branch -r --contains <fix-sha>` should include `origin/main` before you rely on that fix as landed.

For a full release/hotfix checklist, see [release-operations.md](./release-operations.md).

## Repo vs server responsibilities

| Responsibility | Where |
|----------------|--------|
| SSH key secret, host/user/port/path variables | GitHub **staging** environment |
| Matching public key in `authorized_keys`, permissions, sshd | **Server** |
| `STAGING_APP_DIR` exists, owned by deploy user, clone or empty dir | **Server** |
| `apps/api/.env` with `DATABASE_URL` | **Server** |
| Workflow YAML, deploy scripts, docs | **Repo** |

## What stays manual in this wave

- OS packages (Node, Nginx, PostgreSQL) and firewall
- TLS certificates and DNS
- Creating and securing `apps/api/.env`
- Nginx site enablement and `server_name`

## Related docs

- [bootstrap.md](./bootstrap.md) — demo seed semantics
- [migrations.md](./migrations.md) — migration policy
