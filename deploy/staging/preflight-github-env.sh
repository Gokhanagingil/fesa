#!/usr/bin/env bash
#
# Optional local preflight: validate the same STAGING_* names the GitHub workflow expects.
# Export variables in your shell (or source a non-committed file), then:
#   bash deploy/staging/preflight-github-env.sh
#
# Does not read GitHub; does not print secret values.
#
set -euo pipefail

missing=0
for name in STAGING_HOST STAGING_USER STAGING_PORT STAGING_APP_DIR; do
  eval "val=\${$name:-}"
  if [[ -z "$val" ]]; then
    echo "MISSING: $name"
    missing=1
  fi
done

if [[ -n "${STAGING_APP_DIR:-}" ]]; then
  case "${STAGING_APP_DIR}" in
    /*) ;;
    *)
      echo "INVALID: STAGING_APP_DIR must be absolute (start with /)."
      missing=1
      ;;
  esac
fi

if [[ -n "${STAGING_PORT:-}" ]]; then
  case "${STAGING_PORT}" in
    ''|*[!0-9]*)
      echo "INVALID: STAGING_PORT must be numeric."
      missing=1
      ;;
  esac
fi

if [[ "${STAGING_SSH_KEY+x}" != "x" ]]; then
  echo "NOTE: STAGING_SSH_KEY not set in this shell (expected only in GitHub Actions secret)."
fi

if [[ "$missing" -ne 0 ]]; then
  echo "Preflight failed."
  exit 1
fi

echo "Preflight OK: STAGING_HOST STAGING_USER STAGING_PORT STAGING_APP_DIR are set and look sane."
