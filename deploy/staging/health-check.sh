#!/usr/bin/env bash
# Quick post-deploy checks on the server (HTTP + PM2). No secrets printed.
set -euo pipefail

API_PORT="${API_PORT:-3000}"
# When invoked over SSH with FESA_REPO_ROOT, align with apps/api/.env without sourcing the whole file.
if [[ -n "${FESA_REPO_ROOT:-}" && -f "${FESA_REPO_ROOT}/apps/api/.env" ]]; then
  _line="$(grep -E '^[[:space:]]*(export[[:space:]]+)?API_PORT=' "${FESA_REPO_ROOT}/apps/api/.env" | tail -1 || true)"
  if [[ -n "$_line" ]]; then
    _val="${_line#*=}"
    _val="${_val#\"}"
    _val="${_val%\"}"
    _val="${_val#\'}"
    _val="${_val%\'}"
    [[ -n "$_val" ]] && API_PORT="$_val"
  fi
fi
BASE="http://127.0.0.1:${API_PORT}"
PM2_APP_NAME="${PM2_APP_NAME:-fesa-api-staging}"
PM2_HOME_DIR="${PM2_HOME:-${HOME}/.pm2}"

print_pm2_diagnostics() {
  echo ""
  echo "==> PM2 diagnostics"
  if ! command -v pm2 >/dev/null 2>&1; then
    echo "(pm2 not in PATH — skipped)"
    return 0
  fi

  pm2 describe "${PM2_APP_NAME}" --no-color || pm2 list || true

  local err_log="${PM2_HOME_DIR}/logs/${PM2_APP_NAME}-error.log"
  local out_log="${PM2_HOME_DIR}/logs/${PM2_APP_NAME}-out.log"

  echo ""
  echo "==> PM2 error log (${err_log})"
  if [[ -f "${err_log}" ]]; then
    tail -n 100 "${err_log}" || true
  else
    echo "(missing)"
  fi

  echo ""
  echo "==> PM2 out log (${out_log})"
  if [[ -f "${out_log}" ]]; then
    tail -n 100 "${out_log}" || true
  else
    echo "(missing)"
  fi
}

report_failure() {
  local label="$1"
  echo ""
  echo "FAILED: ${label}" >&2
  echo "==> curl context"
  curl -sS -D - "${BASE}/api/health/live" -o /tmp/fesa-health-live.body || true
  if [[ -f /tmp/fesa-health-live.body ]]; then
    echo "-- live body --"
    sed -n '1,80p' /tmp/fesa-health-live.body || true
  fi
  print_pm2_diagnostics
}

try_curl() {
  local url="$1"
  local label="$2"
  local attempt=1
  local max=12
  while [ "$attempt" -le "$max" ]; do
    if out=$(curl -fsS "$url" 2>/dev/null); then
      printf '%s\n' "$out"
      return 0
    fi
    echo "  (attempt $attempt/$max, waiting for API...)"
    sleep 2
    attempt=$((attempt + 1))
  done
  report_failure "$label"
  return 1
}

echo "==> GET ${BASE}/api/health/live"
try_curl "${BASE}/api/health/live" "live health"
echo ""

echo "==> GET ${BASE}/api/health (includes DB)"
try_curl "${BASE}/api/health" "full health (check DATABASE_URL and PostgreSQL)"
echo ""

print_pm2_diagnostics

echo ""
echo "health-check.sh: OK"
