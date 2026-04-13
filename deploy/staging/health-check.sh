#!/usr/bin/env bash
# Quick post-deploy checks on the server (HTTP + PM2). No secrets printed.
set -euo pipefail

API_PORT="${API_PORT:-3000}"
BASE="http://127.0.0.1:${API_PORT}"

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
  echo "FAILED: $label" >&2
  return 1
}

echo "==> GET ${BASE}/api/health/live"
try_curl "${BASE}/api/health/live" "live health"
echo ""

echo "==> GET ${BASE}/api/health (includes DB)"
try_curl "${BASE}/api/health" "full health (check DATABASE_URL and PostgreSQL)"
echo ""

if command -v pm2 >/dev/null 2>&1; then
  echo "==> PM2 status"
  pm2 describe fesa-api-staging --no-color || pm2 list
else
  echo "(pm2 not in PATH — skipped)"
fi

echo ""
echo "health-check.sh: OK"
