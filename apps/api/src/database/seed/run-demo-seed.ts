import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { runDemoSeed } from './demo-seed';
import { runDemoSeedExpansion } from './demo-seed-expansion';
import { runInventoryDemoSeed } from './inventory-seed';
import { runLicensingSeed } from './licensing-seed';
import { DEMO_TENANT_ID, DEMO_TENANT_SLUG } from './constants';

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Copy apps/api/.env.example to apps/api/.env or export DATABASE_URL.');
    process.exit(1);
  }

  await AppDataSource.initialize();
  try {
    await runDemoSeed(AppDataSource);
    console.log('Demo seed (base) completed (idempotent upsert).');

    if (process.env.SKIP_DEMO_SEED_EXPANSION === 'true') {
      console.log('Skipping demo seed expansion (SKIP_DEMO_SEED_EXPANSION=true).');
    } else {
      await runDemoSeedExpansion(AppDataSource);
      console.log('Demo seed (expansion) completed (idempotent upsert).');
    }

    await runInventoryDemoSeed(AppDataSource);
    console.log('Demo seed (inventory) completed (idempotent upsert).');

    await runLicensingSeed(AppDataSource);
    console.log('Demo seed (licensing) completed (idempotent upsert).');

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
