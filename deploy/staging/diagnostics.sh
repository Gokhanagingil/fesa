#!/usr/bin/env bash
# Shared staging diagnostics: API port resolution, HTTP context, and PM2 status/log paths.
set -uo pipefail

MODE="${1:-full}"
API_PORT="${API_PORT:-3000}"
PM2_APP_NAME="${PM2_APP_NAME:-fesa-api-staging}"
PM2_HOME_DIR="${PM2_HOME:-${HOME}/.pm2}"

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

resolve_pm2_metadata() {
  if ! command -v pm2 >/dev/null 2>&1; then
    return 0
  fi

  pm2 jlist 2>/dev/null | node -e "
    let data = '';
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => {
      try {
        const rows = JSON.parse(data);
        const row = rows.find((item) => item.name === process.argv[1]);
        if (!row || !row.pm2_env) return;
        const status = row.pm2_env.status || '';
        const restarts = String(row.pm2_env.restart_time ?? '');
        const out = row.pm2_env.pm_out_log_path || '';
        const err = row.pm2_env.pm_err_log_path || '';
        process.stdout.write([status, restarts, out, err].join('\t'));
      } catch (_error) {
        process.exit(0);
      }
    });
  " "${PM2_APP_NAME}" || true
}

print_http_context() {
  local url="$1"
  local label="$2"
  local headers_file body_file curl_ok
  headers_file="$(mktemp)"
  body_file="$(mktemp)"
  curl_ok=0

  if curl -sS -D "${headers_file}" "${url}" -o "${body_file}"; then
    curl_ok=1
  fi

  echo ""
  echo "==> ${label}: ${url}"
  if [[ "${curl_ok}" -eq 1 ]]; then
    echo "(request completed)"
  else
    echo "(curl could not complete the request cleanly)"
  fi

  if [[ -s "${headers_file}" ]]; then
    echo "-- response headers --"
    sed -n '1,20p' "${headers_file}" || true
  else
    echo "-- response headers --"
    echo "(none captured)"
  fi

  if [[ -s "${body_file}" ]]; then
    echo "-- response body (first 80 lines) --"
    sed -n '1,80p' "${body_file}" || true
  else
    echo "-- response body --"
    echo "(empty or unavailable)"
  fi

  rm -f "${headers_file}" "${body_file}"
}

tail_log_file() {
  local label="$1"
  local file_path="$2"

  echo ""
  echo "==> ${label}: ${file_path}"
  if [[ -n "${file_path}" && -f "${file_path}" ]]; then
    tail -n 100 "${file_path}" || true
  else
    echo "(missing)"
  fi
}

print_pm2_diagnostics() {
  echo ""
  echo "==> PM2 diagnostics"
  if ! command -v pm2 >/dev/null 2>&1; then
    echo "(pm2 not in PATH — skipped)"
    return 0
  fi

  pm2 describe "${PM2_APP_NAME}" --no-color || pm2 list || true

  local metadata pm2_status pm2_restarts pm2_out_log pm2_err_log
  metadata="$(resolve_pm2_metadata)"
  IFS=$'\t' read -r pm2_status pm2_restarts pm2_out_log pm2_err_log <<<"${metadata}"

  pm2_out_log="${pm2_out_log:-${PM2_HOME_DIR}/logs/${PM2_APP_NAME}-out.log}"
  pm2_err_log="${pm2_err_log:-${PM2_HOME_DIR}/logs/${PM2_APP_NAME}-error.log}"

  echo ""
  echo "Process status: ${pm2_status:-not found}"
  echo "Restart count: ${pm2_restarts:-unknown}"

  case "${pm2_status:-}" in
    online)
      echo "Interpretation: PM2 shows the process online; investigate HTTP health output and app dependencies."
      ;;
    errored|stopped|waiting\ restart|launching)
      echo "Interpretation: the process is registered but not healthy; inspect the PM2 error log below."
      ;;
    "")
      echo "Interpretation: PM2 does not currently list ${PM2_APP_NAME}; the process may never have started."
      ;;
    *)
      echo "Interpretation: PM2 reported an unexpected state (${pm2_status}). Inspect logs below."
      ;;
  esac

  tail_log_file "PM2 error log" "${pm2_err_log}"
  tail_log_file "PM2 out log" "${pm2_out_log}"
}

main() {
  resolve_api_port

  local base_url="http://127.0.0.1:${API_PORT}"

  echo "==> Staging diagnostics"
  echo "Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "Repo root: ${FESA_REPO_ROOT:-unknown}"
  echo "API port: ${API_PORT}"
  echo "PM2 app: ${PM2_APP_NAME}"

  if [[ "${MODE}" == "full" ]]; then
    print_http_context "${base_url}/api/health/live" "Live health"
    print_http_context "${base_url}/api/health" "Full health"
  fi

  print_pm2_diagnostics
}

main
exit 0
