# Release operations and hotfix discipline

This runbook keeps staging deploys aligned with `main`, catches preventable regressions earlier, and reduces branch/PR confusion during follow-up fixes.

## Pre-deploy safety gates

Before deploying `main` to staging, ensure CI has already passed these checks:

1. `npm run lint`
2. `npm run i18n:check`
3. `npm run build`
4. `npm run migration:run -w @amateur/api` against disposable PostgreSQL
5. `npm run seed:demo:verify` (runs the demo seed twice against the same database)
6. `npm run api:boot:smoke` (starts the built API, waits for live + full health, then exits)

These gates separate the most common failure classes before staging:

| Failure class | Where it fails now |
|---------------|--------------------|
| Lint / static correctness | CI lint step |
| Locale / translation drift | `i18n:check` |
| Build / compile failure | CI build step |
| Migration parity / schema readiness | CI migration step |
| Demo seed duplication or repeat-run breakage | CI repeat-seed step |
| Nest wiring / boot / config / DB startup failure | CI boot smoke |
| PM2 process or server-local health failure | Staging deploy + `health-check.sh` |

## Branch and PR hygiene rules

These are operational rules, not suggestions:

1. Always branch from `origin/main`.
2. Never reuse a merged branch.
3. Never reuse a merged PR lineage for follow-up fixes.
4. Every new fix or hotfix gets a fresh branch and a fresh PR.
5. Treat direct branch deploys to staging as debugging only, not release evidence.

### Fresh hotfix flow

```bash
git fetch origin main
git checkout -b <new-branch-name> origin/main
```

After the fix:

```bash
git add <changed-files>
git commit -m "Describe the reliability or hotfix change"
git push -u origin <new-branch-name>
```

Open a new PR. Do **not** reopen or continue an already merged branch.

## How to verify `main` really contains the fix

Use the exact fix commit SHA, not just the branch name.

```bash
git fetch origin main
git merge-base --is-ancestor <fix-sha> origin/main && echo "fix is on origin/main"
git branch -r --contains <fix-sha>
```

What you want to see:

- `git merge-base --is-ancestor` exits successfully
- `origin/main` appears in `git branch -r --contains`

If either check fails, the fix is **not** reliably on `main` yet, even if it exists on some other branch.

## Safe staging deploy choices

Preferred inputs for the staging deploy workflow:

1. `main`
2. A merged commit SHA already contained by `origin/main`

Acceptable only for debugging:

- an unmerged feature branch
- a tag or SHA that is not yet confirmed on `origin/main`

If you deploy a branch for investigation, follow up with a fresh PR from `origin/main` before treating the fix as landed.

## Troubleshooting flow by failure stage

| Stage | Typical meaning | First thing to inspect |
|-------|------------------|------------------------|
| CI lint / i18n | Static repo issue | ESLint or parity output |
| CI build | Compile or type-level breakage | Build logs in CI |
| CI migration | Entity/schema mismatch or bad SQL migration | TypeORM migration output |
| CI repeat-seed | Demo seed lost idempotency | Seed logs and unique-key collisions |
| CI boot smoke | Nest module wiring, env validation, DB connect, runtime boot | Captured API stdout/stderr from `api:boot:smoke` |
| Staging deploy `Git sync` | Wrong ref, server checkout issue, git auth issue | `deploy.sh` stage output |
| Staging deploy `Install dependencies` / `Build monorepo` | Server dependency or build issue | `deploy.sh` stage output |
| Staging deploy `Run database migrations` | Server DB/env/schema issue | migration stage output |
| Staging deploy `Run demo seed` | Staging data/constraint issue | seed stage output |
| Staging deploy health | Process started late, crashed, or health route/DB failed | `deploy/staging/diagnostics.sh` output |

## When a deploy fails after PM2 reload

Use the diagnostics output to classify the failure quickly:

- **PM2 app missing**: process never started or wrong ecosystem target
- **PM2 not online / high restart count**: process is crashing during boot
- **Live health down**: process is not responding on the configured port
- **Live health up but full health down**: app is serving HTTP but DB or downstream health is failing

Those four states should guide whether you inspect PM2 logs, app config, database reachability, or migration/seed output first.
