/**
 * PM2 ecosystem for FESA staging (API only).
 * Static web assets are served by Nginx from apps/web/dist — not via PM2.
 *
 * Usage (from repo root, after build):
 *   FESA_REPO_ROOT=/path/to/fesa pm2 start deploy/staging/ecosystem.config.cjs
 *   FESA_REPO_ROOT=/path/to/fesa pm2 reload deploy/staging/ecosystem.config.cjs
 */
const path = require('path');

const repoRoot = process.env.FESA_REPO_ROOT || path.join(__dirname, '../..');
const apiCwd = path.join(repoRoot, 'apps', 'api');

module.exports = {
  apps: [
    {
      name: 'fesa-api-staging',
      cwd: apiCwd,
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 15,
      min_uptime: '10s',
      // Nest loads apps/api/.env from cwd
      env: {
        NODE_ENV: process.env.NODE_ENV || 'staging',
        FESA_REPO_ROOT: repoRoot,
        FESA_GIT_SHA: process.env.FESA_GIT_SHA || 'unknown',
        FESA_BUILD_TIME_UTC: process.env.FESA_BUILD_TIME_UTC || '',
      },
    },
  ],
};
