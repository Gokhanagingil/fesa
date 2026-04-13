import { parseCorsOrigins } from '@amateur/shared-config';

export const configuration = () => ({
  app: {
    port: parseInt(process.env.API_PORT ?? '3000', 10),
    globalPrefix: process.env.API_GLOBAL_PREFIX ?? 'api',
    corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),
  },
  database: {
    url: process.env.DATABASE_URL ?? '',
  },
});
