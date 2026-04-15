import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { StaffUser, Tenant, TenantMembership } from '../entities';
import {
  DEMO_CLUB_ADMINS,
  DEMO_TENANTS,
  GLOBAL_ADMIN_EMAIL,
} from './constants';
import { runDemoSeed } from './demo-seed';

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

    for (const tenantSeed of DEMO_TENANTS) {
      const tenant = await tenants.findOneBy({ slug: tenantSeed.slug });
      if (!tenant) {
        throw new Error(`Expected demo tenant ${tenantSeed.slug} to exist after repeat seed validation.`);
      }

      const tenantCount = await tenants.countBy({ slug: tenantSeed.slug });
      if (tenantCount !== 1) {
        throw new Error(`Expected exactly 1 demo tenant row for slug ${tenantSeed.slug}; found ${tenantCount}.`);
      }
    }

    const seededStaffEmails = [GLOBAL_ADMIN_EMAIL, ...DEMO_CLUB_ADMINS.map((admin) => admin.email)];
    for (const email of seededStaffEmails) {
      const userCount = await staffUsers.countBy({ email });
      if (userCount !== 1) {
        throw new Error(`Expected exactly 1 staff user row for ${email}; found ${userCount}.`);
      }
    }

    for (const seededAdmin of DEMO_CLUB_ADMINS) {
      const clubAdmin = await staffUsers.findOneBy({ email: seededAdmin.email });
      if (!clubAdmin) {
        throw new Error(`Expected seeded club admin ${seededAdmin.email} to exist.`);
      }

      const tenant = await tenants.findOneBy({ slug: seededAdmin.tenantSlug });
      if (!tenant) {
        throw new Error(`Expected tenant ${seededAdmin.tenantSlug} to exist for ${seededAdmin.email}.`);
      }

      const membershipCount = await memberships.countBy({
        tenantId: tenant.id,
        staffUserId: clubAdmin.id,
      });
      if (membershipCount !== 1) {
        throw new Error(
          `Expected exactly 1 tenant membership for ${seededAdmin.email} in ${seededAdmin.tenantSlug}; found ${membershipCount}.`,
        );
      }
    }

    console.log('Demo seed repeatability verified successfully.');
    console.log(`Validated demo tenants: ${DEMO_TENANTS.map((tenant) => tenant.slug).join(', ')}`);
    console.log(`Validated staff users: ${seededStaffEmails.join(', ')}`);
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
