import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { StaffUser, Tenant, TenantMembership } from '../entities';
import { DEMO_TENANT_SLUG } from './constants';
import { runDemoSeed } from './demo-seed';

const GLOBAL_ADMIN_EMAIL = 'platform.admin@amateur.local';
const CLUB_ADMIN_EMAIL = 'club.admin@amateur.local';

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. Copy apps/api/.env.example to apps/api/.env or export DATABASE_URL before verifying the demo seed.',
    );
  }

  await AppDataSource.initialize();

  try {
    console.log('Demo seed verification: pass 1');
    await runDemoSeed(AppDataSource);

    console.log('Demo seed verification: pass 2');
    await runDemoSeed(AppDataSource);

    const tenants = AppDataSource.getRepository(Tenant);
    const staffUsers = AppDataSource.getRepository(StaffUser);
    const memberships = AppDataSource.getRepository(TenantMembership);

    const demoTenant = await tenants.findOneBy({ slug: DEMO_TENANT_SLUG });
    if (!demoTenant) {
      throw new Error(`Expected demo tenant ${DEMO_TENANT_SLUG} to exist after repeat seed validation.`);
    }

    const tenantCount = await tenants.countBy({ slug: DEMO_TENANT_SLUG });
    if (tenantCount !== 1) {
      throw new Error(`Expected exactly 1 demo tenant row for slug ${DEMO_TENANT_SLUG}; found ${tenantCount}.`);
    }

    for (const email of [GLOBAL_ADMIN_EMAIL, CLUB_ADMIN_EMAIL]) {
      const userCount = await staffUsers.countBy({ email });
      if (userCount !== 1) {
        throw new Error(`Expected exactly 1 staff user row for ${email}; found ${userCount}.`);
      }
    }

    const clubAdmin = await staffUsers.findOneBy({ email: CLUB_ADMIN_EMAIL });
    if (!clubAdmin) {
      throw new Error(`Expected seeded club admin ${CLUB_ADMIN_EMAIL} to exist.`);
    }

    const membershipCount = await memberships.countBy({
      tenantId: demoTenant.id,
      staffUserId: clubAdmin.id,
    });
    if (membershipCount !== 1) {
      throw new Error(
        `Expected exactly 1 tenant membership for ${CLUB_ADMIN_EMAIL} in ${DEMO_TENANT_SLUG}; found ${membershipCount}.`,
      );
    }

    console.log('Demo seed repeatability verified successfully.');
    console.log(`Tenant id in use: ${demoTenant.id}`);
    console.log(`Validated staff users: ${GLOBAL_ADMIN_EMAIL}, ${CLUB_ADMIN_EMAIL}`);
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
