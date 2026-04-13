#!/usr/bin/env bash
#
# Manual staging server validation (run ON the Hetzner host as the deploy user, e.g. gokhan).
# Read-only checks — safe to paste into an SSH session. Does not print secret values.
#
# Usage:
#   bash deploy/staging/server-validate.sh
#   APP_ROOT=/opt/fesa bash deploy/staging/server-validate.sh
#
set -euo pipefail

APP_ROOT="${APP_ROOT:-${FESA_REPO_ROOT:-}}"

echo "=========================================="
echo "FESA staging — server validation ($(date -u +%Y-%m-%dT%H:%M:%SZ) UTC)"
echo "=========================================="

echo ""
echo "== Identity & host =="
echo "whoami: $(whoami)"
echo "hostname: $(hostname -f 2>/dev/null || hostname)"
echo "pwd: $(pwd)"

echo ""
echo "== SSH client key files (local user) =="
if [[ -d "${HOME}/.ssh" ]]; then
  ls -la "${HOME}/.ssh" 2>/dev/null || true
else
  echo "(no ~/.ssh directory)"
fi

echo ""
echo "== authorized_keys (metadata only) =="
ak="${HOME}/.ssh/authorized_keys"
if [[ -f "$ak" ]]; then
  echo "file: $ak"
  ls -la "$ak"
  echo "line count: $(wc -l < "$ak")"
  echo "key types (first token of each line):"
  awk '{print $1}' "$ak" | sort | uniq -c || true
else
  echo "MISSING: $ak — pubkey login will fail until a public key is installed."
fi

echo ""
echo "== sshd (relevant — may need sudo) =="
if command -v sshd >/dev/null 2>&1; then
  if sudo -n true 2>/dev/null; then
    sudo sshd -T 2>/dev/null | grep -E '^(pubkeyauthentication|passwordauthentication|authorizedkeysfile|permitrootlogin)\b' || true
  else
    echo "(skipped: run with sudo for sshd -T, e.g. sudo sshd -T | grep -E pubkey)"
  fi
else
  echo "(sshd not in PATH)"
fi

echo ""
echo "== Tooling =="
command -v git >/dev/null && echo "git: $(git --version)" || echo "git: MISSING"
command -v node >/dev/null && echo "node: $(node -v)" || echo "node: MISSING"
command -v npm >/dev/null && echo "npm: $(npm -v)" || echo "npm: MISSING"
command -v pm2 >/dev/null && echo "pm2: $(pm2 -v 2>/dev/null | head -1)" || echo "pm2: MISSING"
command -v psql >/dev/null && echo "psql: $(psql --version)" || echo "psql: not in PATH (optional)"

echo ""
echo "== App directory (STAGING_APP_DIR / APP_ROOT) =="
if [[ -z "$APP_ROOT" ]]; then
  echo "APP_ROOT/FESA_REPO_ROOT not set — pass APP_ROOT=/path/to/repo or export FESA_REPO_ROOT."
else
  echo "APP_ROOT=$APP_ROOT"
  if [[ -d "$APP_ROOT" ]]; then
    ls -la "$APP_ROOT" | head -20
    if [[ -d "$APP_ROOT/.git" ]]; then
      echo "git remote:"
      git -C "$APP_ROOT" remote -v 2>/dev/null || true
      echo "HEAD: $(git -C "$APP_ROOT" rev-parse --short HEAD 2>/dev/null || echo '?')"
    else
      echo "WARN: not a git checkout (.git missing)"
    fi
  else
    echo "MISSING or not a directory: $APP_ROOT"
  fi
fi

echo ""
echo "== API env file (presence + non-secret keys) =="
api_env=""
[[ -n "${APP_ROOT:-}" ]] && api_env="${APP_ROOT}/apps/api/.env"
if [[ -n "$api_env" && -f "$api_env" ]]; then
  ls -la "$api_env"
  echo "keys defined (names only):"
  grep -E '^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*=' "$api_env" | sed 's/=.*//' | sed 's/^[[:space:]]*//' | sort -u || true
  if grep -q '^DATABASE_URL=' "$api_env" 2>/dev/null; then
    echo "DATABASE_URL: present"
  else
    echo "DATABASE_URL: MISSING"
  fi
else
  echo "Expected at: ${api_env:-<set APP_ROOT>}"
  echo "MISSING — create from apps/api/.env.example before first deploy."
fi

echo ""
echo "== PostgreSQL (local socket / peer — quick probe) =="
if command -v psql >/dev/null 2>&1; then
  if psql -d postgres -c 'select 1' >/dev/null 2>&1; then
    echo "psql to 'postgres' db: OK"
  else
    echo "psql to 'postgres' db: failed (check role, peer auth, or use DATABASE_URL from apps/api/.env)"
  fi
else
  echo "(skipped — install postgresql-client or rely on API health check)"
fi

echo ""
echo "== PM2 (if installed) =="
if command -v pm2 >/dev/null 2>&1; then
  pm2 list 2>/dev/null || true
else
  echo "(pm2 not installed)"
fi

echo ""
echo "== Nginx (optional) =="
if command -v nginx >/dev/null 2>&1; then
  nginx -v 2>&1 || true
  if [[ -d /etc/nginx/sites-enabled ]]; then
    echo "sites-enabled:"
    ls -la /etc/nginx/sites-enabled 2>/dev/null || true
  fi
else
  echo "(nginx not in PATH)"
fi

echo ""
echo "=========================================="
echo "Validation script finished."
echo "=========================================="
