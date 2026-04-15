#!/usr/bin/env bash
# Quick post-deploy checks on the server (HTTP + PM2). No secrets printed.
set -euo pipefail

API_PORT="${API_PORT:-3000}"
PM2_APP_NAME="${PM2_APP_NAME:-fesa-api-staging}"
WEB_BASE_URL="${WEB_BASE_URL:-http://127.0.0.1}"

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

    echo "  (attempt ${attempt}/${max}, waiting for API...)" >&2
    sleep 2
    attempt=$((attempt + 1))
  done

  print_failure_diagnostics "${label}"
  return 1
}

resolve_api_port
BASE="http://127.0.0.1:${API_PORT}"

validate_runtime_alignment() {
  local api_json="$1"
  local web_json="$2"

  node - "${api_json}" "${web_json}" <<'EOF'
const [apiRaw, webRaw] = process.argv.slice(2);
const api = JSON.parse(apiRaw);
const web = JSON.parse(webRaw);

const apiCommit = api.commit || '';
const webCommit = web.commit || '';
if (!apiCommit) {
  throw new Error('API version metadata is missing commit information');
}
if (!webCommit) {
  throw new Error('Frontend build metadata is missing commit information');
}
if (apiCommit !== webCommit) {
  throw new Error(`Frontend/backend commit mismatch: web=${webCommit} api=${apiCommit}`);
}

const expectedDb = api.database?.expectedName || null;
const currentDb = api.database?.currentName || null;
if (expectedDb && currentDb && expectedDb !== currentDb) {
  throw new Error(`Runtime DB mismatch: env=${expectedDb} runtime=${currentDb}`);
}

process.stdout.write(
  `runtime-version-check: OK commit=${apiCommit.slice(0, 12)} db=${currentDb ?? 'unknown'}\n`,
);
EOF
}

echo "==> GET ${BASE}/api/health/live"
try_curl "${BASE}/api/health/live" "live health (process did not become responsive)"
echo ""

echo "==> GET ${BASE}/api/health (includes DB)"
try_curl "${BASE}/api/health" "full health (app responded but dependency or DB health failed)"
echo ""

echo "==> GET ${BASE}/api/health/version"
api_version_json="$(try_curl "${BASE}/api/health/version" "runtime version (backend commit / DB identity missing)")"
printf '%s\n' "${api_version_json}"
echo ""

echo "==> GET ${WEB_BASE_URL}/build-info.json"
web_build_json="$(try_curl "${WEB_BASE_URL}/build-info.json" "frontend build info (nginx/static asset path not serving current dist)")"
printf '%s\n' "${web_build_json}"
echo ""

echo "==> Verify frontend/backend/DB alignment"
validate_runtime_alignment "${api_version_json}" "${web_build_json}"

echo ""
echo "health-check.sh: OK"
