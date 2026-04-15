#!/usr/bin/env bash
# Quick post-deploy checks on the server (HTTP + PM2). No secrets printed.
set -euo pipefail

API_PORT="${API_PORT:-3000}"
PM2_APP_NAME="${PM2_APP_NAME:-fesa-api-staging}"

resolve_api_port() {
  if [[ -n "${FESA_REPO_ROOT:-}" && -f "${FESA_REPO_ROOT}/apps/api/.env" ]]; then
    local line
    line="$(grep -E '^[[:space:]]*(export[[:space:]]+)?API_PORT=' "${FESA_REPO_ROOT}/apps/api/.env" | tail -1 || true)"
    if [[ -n "${line}" ]]; then
      local value="${line#*=}"
      value="${value#\"}"
      value="${value%\"}"
      value="${value#\'}"
      value="${value%\'}"
      [[ -n "${value}" ]] && API_PORT="${value}"
    fi
  fi
}

locate_diagnostics_script() {
  if [[ -n "${FESA_REPO_ROOT:-}" && -f "${FESA_REPO_ROOT}/deploy/staging/diagnostics.sh" ]]; then
    printf '%s\n' "${FESA_REPO_ROOT}/deploy/staging/diagnostics.sh"
    return 0
  fi

  if [[ -n "${BASH_SOURCE[0]:-}" ]]; then
    local script_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    if [[ -f "${script_dir}/diagnostics.sh" ]]; then
      printf '%s\n' "${script_dir}/diagnostics.sh"
      return 0
    fi
  fi

  return 1
}

print_failure_diagnostics() {
  local label="$1"
  local diagnostics_script

  echo ""
  echo "FAILED: ${label}" >&2

  diagnostics_script="$(locate_diagnostics_script || true)"
  if [[ -n "${diagnostics_script:-}" ]]; then
    bash "${diagnostics_script}" full || true
  else
    echo "Diagnostics script not found; skipping extended diagnostics." >&2
  fi
}

try_curl() {
  local url="$1"
  local label="$2"
  local attempt=1
  local max=15
  local response

  while [[ "${attempt}" -le "${max}" ]]; do
    if response="$(curl -fsS "${url}" 2>/dev/null)"; then
      printf '%s\n' "${response}"
      return 0
    fi

    echo "  (attempt ${attempt}/${max}, waiting for API...)"
    sleep 2
    attempt=$((attempt + 1))
  done

  print_failure_diagnostics "${label}"
  return 1
}

resolve_api_port
BASE="http://127.0.0.1:${API_PORT}"

echo "==> GET ${BASE}/api/health/live"
try_curl "${BASE}/api/health/live" "live health (process did not become responsive)"
echo ""

echo "==> GET ${BASE}/api/health (includes DB)"
try_curl "${BASE}/api/health" "full health (app responded but dependency or DB health failed)"

echo ""
echo "health-check.sh: OK"
