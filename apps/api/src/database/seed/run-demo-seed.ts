import 'reflect-metadata';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';
import { AppDataSource } from '../data-source';
import { runDemoSeed } from './demo-seed';
import { DEMO_TENANT_ID, DEMO_TENANT_SLUG } from './constants';

for (const envPath of [resolve(process.cwd(), '.env'), resolve(process.cwd(), 'apps/api/.env')]) {
  if (existsSync(envPath)) {
    config({ path: envPath });
    break;
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Copy apps/api/.env.example to apps/api/.env or export DATABASE_URL.');
    process.exit(1);
  }

  await AppDataSource.initialize();
  try {
    await runDemoSeed(AppDataSource);
    console.log('Demo seed completed (idempotent upsert).');
    console.log(`Demo tenant slug: ${DEMO_TENANT_SLUG}`);
    console.log(`Demo tenant id (DEV_TENANT_ID / X-Tenant-Id): ${DEMO_TENANT_ID}`);
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
