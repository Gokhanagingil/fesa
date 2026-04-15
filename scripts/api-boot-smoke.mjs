import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');
const apiDir = path.join(workspaceRoot, 'apps', 'api');
const entrypoint = path.join(apiDir, 'dist', 'main.js');
const apiPort = Number(process.env.API_PORT ?? '3101');
const startupTimeoutMs = Number(process.env.API_BOOT_SMOKE_TIMEOUT_MS ?? '45000');
const baseUrl = `http://127.0.0.1:${apiPort}`;

if (!process.env.DATABASE_URL) {
  console.error('api:boot:smoke requires DATABASE_URL to point at a reachable PostgreSQL instance.');
  process.exit(1);
}

function trimLogs(output) {
  return output.trim().split('\n').slice(-120).join('\n');
}

async function fetchJson(url) {
  const response = await fetch(url);
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}: ${body || '<empty body>'}`);
  }

  return body;
}

async function waitForHealth(url, label, child, logs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < startupTimeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`${label} check failed because the API process exited with code ${child.exitCode}.`);
    }

    try {
      const body = await fetchJson(url);
      console.log(`api:boot:smoke ${label} OK -> ${body}`);
      return;
    } catch (error) {
      logs.lastError = error instanceof Error ? error.message : String(error);
      await sleep(1000);
    }
  }

  throw new Error(`${label} did not become healthy within ${startupTimeoutMs}ms. Last error: ${logs.lastError ?? 'unknown error'}`);
}

async function stopChild(child) {
  if (child.exitCode !== null) return;

  child.kill('SIGTERM');
  const timeout = sleep(5000).then(() => {
    if (child.exitCode === null) {
      child.kill('SIGKILL');
    }
  });

  await Promise.race([once(child, 'exit').catch(() => undefined), timeout]);
}

async function main() {
  const logs = { stdout: '', stderr: '', lastError: '' };

  const child = spawn('node', [entrypoint], {
    cwd: apiDir,
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV ?? 'staging',
      API_PORT: String(apiPort),
      DB_SYNCHRONIZE: 'false',
      DB_RUN_MIGRATIONS: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => {
    logs.stdout += chunk.toString();
  });

  child.stderr.on('data', (chunk) => {
    logs.stderr += chunk.toString();
  });

  try {
    await waitForHealth(`${baseUrl}/api/health/live`, 'live health', child, logs);
    await waitForHealth(`${baseUrl}/api/health`, 'full health', child, logs);
    console.log('api:boot:smoke completed successfully.');
  } catch (error) {
    await stopChild(child);
    console.error('');
    console.error('api:boot:smoke failed.');
    console.error(error instanceof Error ? error.message : String(error));

    if (logs.stdout.trim()) {
      console.error('');
      console.error('--- api stdout (last 120 lines) ---');
      console.error(trimLogs(logs.stdout));
    }

    if (logs.stderr.trim()) {
      console.error('');
      console.error('--- api stderr (last 120 lines) ---');
      console.error(trimLogs(logs.stderr));
    }

    process.exit(1);
  }

  await stopChild(child);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
