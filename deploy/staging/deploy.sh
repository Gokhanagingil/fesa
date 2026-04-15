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

set -Eeuo pipefail

DEPLOY_GIT_REF="${DEPLOY_GIT_REF:-main}"
NPM_CI="${NPM_CI:-1}"
CURRENT_STAGE="initialization"

log() {
  printf '\n[%s] %s\n' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" "$*"
}

die() {
  printf '\n[ERROR] %s\n' "$*" >&2
  exit 1
}

on_error() {
  local exit_code="$1"
  local line_no="$2"
  printf '\n[ERROR] Stage failed: %s (exit=%s, line=%s)\n' "${CURRENT_STAGE}" "${exit_code}" "${line_no}" >&2
  exit "${exit_code}"
}

trap 'on_error $? $LINENO' ERR

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
    local staging_ex
    staging_ex="$(dirname "$api_env")/.env.staging.example"
    if [[ -f "$staging_ex" ]]; then
      log "Creating apps/api/.env from .env.staging.example — YOU MUST EDIT DATABASE_URL and secrets on the server"
      cp "$staging_ex" "$api_env"
    else
      log "Creating apps/api/.env from .env.example — YOU MUST EDIT DATABASE_URL and secrets on the server"
      cp "$example" "$api_env"
    fi
    chmod 600 "$api_env" || true
  fi
  # shellcheck disable=SC1090
  set +u
  source "$api_env" 2>/dev/null || true
  set -u
  [[ -n "${DATABASE_URL:-}" ]] || die "DATABASE_URL must be set in apps/api/.env on the server"
}

run_stage() {
  local stage_name="$1"
  shift
  CURRENT_STAGE="$stage_name"
  log "==> ${stage_name}"
  "$@"
  log "<== ${stage_name} OK"
}

install_dependencies() {
  local root="$1"
  if [[ "$NPM_CI" == "1" ]]; then
    (cd "$root" && npm ci)
  else
    (cd "$root" && npm install)
  fi
}

build_monorepo() {
  local root="$1"
  (cd "$root" && npm run build)
}

run_database_migrations() {
  local root="$1"
  (cd "$root" && npm run migration:run -w @amateur/api)
}

run_demo_seed() {
  local root="$1"
  (cd "$root" && npm run seed:demo)
}

reload_pm2_api() {
  local root="$1"
  if command -v pm2 >/dev/null 2>&1; then
    export FESA_REPO_ROOT="$root"
    pm2 startOrReload "$root/deploy/staging/ecosystem.config.cjs" --only fesa-api-staging
    pm2 save || true
  else
    die "pm2 not found — install with: sudo npm install -g pm2"
  fi
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
  log "Node $(node -v 2>/dev/null || echo '?') / npm $(npm -v 2>/dev/null || echo '?')"

  mkdir -p "$root"
  run_stage "Git sync" sync_repo "$root"

  export FESA_GIT_SHA
  FESA_GIT_SHA="$(git -C "$root" rev-parse HEAD)"
  export FESA_BUILD_TIME_UTC
  FESA_BUILD_TIME_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  log "Runtime build stamp: commit=${FESA_GIT_SHA} built_at=${FESA_BUILD_TIME_UTC}"

  local api_dir="$root/apps/api"
  local web_dir="$root/apps/web"
  [[ -f "$root/package.json" ]] || die "Invalid repo: missing package.json"
  [[ -f "$api_dir/package.json" ]] || die "Invalid repo: missing apps/api"
  [[ -f "$web_dir/package.json" ]] || die "Invalid repo: missing apps/web"

  run_stage "API environment validation" ensure_api_env "$api_dir/.env" "$api_dir/.env.example"

  run_stage "Install dependencies (root)" install_dependencies "$root"
  run_stage "Build monorepo" build_monorepo "$root"
  run_stage "Run database migrations" run_database_migrations "$root"
  run_stage "Run demo seed (idempotent)" run_demo_seed "$root"
  run_stage "Reload PM2 API process" reload_pm2_api "$root"

  CURRENT_STAGE="completed"

  log "Deploy script finished OK"
}

main "$@"
