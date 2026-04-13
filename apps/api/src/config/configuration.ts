import { parseCorsOrigins } from '@amateur/shared-config';

function envBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue;
  return value === 'true' || value === '1';
}

export const configuration = () => ({
  app: {
    port: parseInt(process.env.API_PORT ?? '3000', 10),
    globalPrefix: process.env.API_GLOBAL_PREFIX ?? 'api',
    corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),
  },
  database: {
    url: process.env.DATABASE_URL ?? '',
    /**
     * When true, TypeORM may auto-alter schema (dev convenience). Prefer false once migration workflow is in use.
     * Default: true in non-production if unset; never defaults to true in production.
     */
    synchronize: envBool(
      process.env.DB_SYNCHRONIZE,
      (process.env.NODE_ENV ?? 'development') === 'development',
    ),
    /** Run pending migrations on API startup (typical for production/staging). */
    runMigrations: envBool(process.env.DB_RUN_MIGRATIONS, false),
  },
});
