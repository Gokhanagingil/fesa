/**
 * Shared configuration keys and helpers. Runtime values come from environment.
 */

export const ENV_KEYS = {
  NODE_ENV: 'NODE_ENV',
  API_PORT: 'API_PORT',
  API_GLOBAL_PREFIX: 'API_GLOBAL_PREFIX',
  DATABASE_URL: 'DATABASE_URL',
  CORS_ORIGIN: 'CORS_ORIGIN',
} as const;

export type NodeEnv = 'development' | 'production' | 'test';

export function parseCorsOrigins(raw: string | undefined): string[] {
  if (!raw || raw.trim() === '') return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
