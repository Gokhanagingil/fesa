#!/usr/bin/env bash
#
# FESA staging deploy — run on the Ubuntu server (invoked over SSH by CI or manually).
#
# Required environment:
#   FESA_REPO_ROOT  Absolute path to the git checkout (same as GitHub STAGING_APP_DIR).
#
# Optional:
#   DEPLOY_GIT_REF    Git ref to deploy (branch, tag, or SHA). Default: main
#   NPM_CI            Set to "0" to use `npm install` instead of `npm ci` (not recommended).
#
# Prerequisites: Node 20+, npm, git, PostgreSQL reachable via DATABASE_URL in apps/api/.env
#

set -euo pipefail

DEPLOY_GIT_REF="${DEPLOY_GIT_REF:-main}"
NPM_CI="${NPM_CI:-1}"

log() {
  printf '\n[%s] %s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$*"
}

die() {
  printf '\n[ERROR] %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

guard_repo_root() {
  local root="${FESA_REPO_ROOT:-}"
  [[ -n "$root" ]] || die "FESA_REPO_ROOT is not set"
  [[ "$root" != "/" ]] || die "Refusing to use FESA_REPO_ROOT=/"
  [[ "$root" =~ ^/ ]] || die "FESA_REPO_ROOT must be an absolute path"
}

sync_repo() {
  local root="$1"
  if [[ -d "$root/.git" ]]; then
    log "Fetching and checking out ${DEPLOY_GIT_REF}"
    git -C "$root" fetch origin
    if git -C "$root" rev-parse --verify "origin/${DEPLOY_GIT_REF}" >/dev/null 2>&1; then
      git -C "$root" checkout -B staging-deploy "origin/${DEPLOY_GIT_REF}"
    else
      git -C "$root" fetch origin "${DEPLOY_GIT_REF}:${DEPLOY_GIT_REF}" 2>/dev/null || git -C "$root" fetch origin "${DEPLOY_GIT_REF}"
      git -C "$root" checkout -B staging-deploy "${DEPLOY_GIT_REF}"
    fi
  else
    if [[ -n "$(ls -A "$root" 2>/dev/null)" ]]; then
      die "Directory $root is not empty and not a git repo — clone manually or use an empty path"
    fi
    log "Cloning repository into $root"
    git clone https://github.com/Gokhanagingil/fesa.git "$root"
    git -C "$root" fetch origin
    if git -C "$root" rev-parse --verify "origin/${DEPLOY_GIT_REF}" >/dev/null 2>&1; then
      git -C "$root" checkout -B staging-deploy "origin/${DEPLOY_GIT_REF}"
    else
      git -C "$root" fetch origin "${DEPLOY_GIT_REF}:${DEPLOY_GIT_REF}" 2>/dev/null || git -C "$root" fetch origin "${DEPLOY_GIT_REF}"
      git -C "$root" checkout -B staging-deploy "${DEPLOY_GIT_REF}"
    fi
  fi
}

ensure_api_env() {
  local api_env="$1"
  local example="$2"
  if [[ ! -f "$api_env" ]]; then
    log "Creating apps/api/.env from .env.example — YOU MUST EDIT DATABASE_URL and secrets on the server"
    cp "$example" "$api_env"
    chmod 600 "$api_env" || true
  fi
  # shellcheck disable=SC1090
  set +u
  source "$api_env" 2>/dev/null || true
  set -u
  [[ -n "${DATABASE_URL:-}" ]] || die "DATABASE_URL must be set in apps/api/.env on the server"
}

main() {
  guard_repo_root
  require_cmd git
  require_cmd npm
  require_cmd node

  local root
  root="$(cd "${FESA_REPO_ROOT}" && pwd)"
  export FESA_REPO_ROOT="$root"

  log "Deploy root: $root"
  log "Target ref: $DEPLOY_GIT_REF"

  mkdir -p "$root"
  sync_repo "$root"

  local api_dir="$root/apps/api"
  local web_dir="$root/apps/web"
  [[ -f "$root/package.json" ]] || die "Invalid repo: missing package.json"
  [[ -f "$api_dir/package.json" ]] || die "Invalid repo: missing apps/api"

  ensure_api_env "$api_dir/.env" "$api_dir/.env.example"

  log "Installing dependencies (root)"
  if [[ "$NPM_CI" == "1" ]]; then
    (cd "$root" && npm ci)
  else
    (cd "$root" && npm install)
  fi

  log "Building monorepo"
  (cd "$root" && npm run build)

  log "Running database migrations"
  (cd "$root" && npm run migration:run -w @amateur/api)

  log "Running demo seed (idempotent)"
  (cd "$root" && npm run seed:demo)

  log "Reloading PM2 API process"
  if command -v pm2 >/dev/null 2>&1; then
    export FESA_REPO_ROOT="$root"
    pm2 startOrReload "$root/deploy/staging/ecosystem.config.cjs" --only fesa-api-staging
    pm2 save || true
  else
    die "pm2 not found — install with: sudo npm install -g pm2"
  fi

  log "Deploy script finished OK"
}

main "$@"
