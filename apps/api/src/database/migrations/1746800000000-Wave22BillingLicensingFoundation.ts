import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Wave 22 — Billing & Licensing Foundation v1.
 *
 * Introduces the small, disciplined commercial backbone:
 *
 *   - `license_plans`             — first-class plan rows
 *   - `license_plan_entitlements` — feature mapping per plan
 *   - `license_usage_bands`       — config-driven athlete bands
 *   - `tenant_subscriptions`      — one license row per tenant
 *   - `tenant_usage_snapshots`    — append-only usage history
 *
 * Tenant isolation:
 *   - `tenant_subscriptions.tenantId` is unique (one license per tenant);
 *   - `tenant_usage_snapshots.tenantId` is indexed with `measuredAt`;
 *   - both tables CASCADE on tenant delete so retiring a club leaves no
 *     orphan commercial state behind.
 *
 * Pricing, invoicing, payment processors, and per-parent billing are
 * intentionally NOT modelled in v1.
 */
export class Wave22BillingLicensingFoundation1746800000000
  implements MigrationInterface
{
  name = 'Wave22BillingLicensingFoundation1746800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "license_plans" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" varchar(64) NOT NULL,
        "name" varchar(120) NOT NULL,
        "description" varchar(400),
        "isActive" boolean NOT NULL DEFAULT true,
        "displayOrder" integer NOT NULL DEFAULT 0,
        "isDefaultTrial" boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_license_plans" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_license_plans_code" ON "license_plans" ("code")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_license_plans_displayOrder" ON "license_plans" ("displayOrder")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "license_plan_entitlements" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "planId" uuid NOT NULL,
        "featureKey" varchar(96) NOT NULL,
        "enabled" boolean NOT NULL DEFAULT false,
        "limitValue" integer,
        "notes" varchar(240),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_license_plan_entitlements" PRIMARY KEY ("id"),
        CONSTRAINT "FK_license_plan_entitlements_plan" FOREIGN KEY ("planId")
          REFERENCES "license_plans" ("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_license_plan_entitlements_plan_feature" ON "license_plan_entitlements" ("planId", "featureKey")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_license_plan_entitlements_feature" ON "license_plan_entitlements" ("featureKey")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "license_usage_bands" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" varchar(64) NOT NULL,
        "label" varchar(120) NOT NULL,
        "minAthletes" integer NOT NULL,
        "maxAthletes" integer,
        "displayOrder" integer NOT NULL DEFAULT 0,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_license_usage_bands" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_license_usage_bands_code" ON "license_usage_bands" ("code")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_license_usage_bands_displayOrder" ON "license_usage_bands" ("displayOrder")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenant_subscriptions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "planId" uuid NOT NULL,
        "status" varchar(32) NOT NULL DEFAULT 'trial',
        "startDate" timestamptz,
        "renewalDate" timestamptz,
        "trialEndsAt" timestamptz,
        "onboardingServiceIncluded" boolean NOT NULL DEFAULT false,
        "internalNotes" varchar(240),
        "statusReason" varchar(240),
        "assignedByStaffUserId" uuid,
        "lastChangedByStaffUserId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tenant_subscriptions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tenant_subscriptions_tenant" FOREIGN KEY ("tenantId")
          REFERENCES "tenants" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tenant_subscriptions_plan" FOREIGN KEY ("planId")
          REFERENCES "license_plans" ("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_tenant_subscriptions_assigned_by" FOREIGN KEY ("assignedByStaffUserId")
          REFERENCES "staff_users" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_tenant_subscriptions_changed_by" FOREIGN KEY ("lastChangedByStaffUserId")
          REFERENCES "staff_users" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_tenant_subscriptions_tenant" ON "tenant_subscriptions" ("tenantId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_subscriptions_plan" ON "tenant_subscriptions" ("planId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_subscriptions_status" ON "tenant_subscriptions" ("status")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenant_usage_snapshots" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "measuredAt" timestamptz NOT NULL,
        "activeAthleteCount" integer NOT NULL,
        "bandId" uuid,
        "bandCode" varchar(64),
        "source" varchar(32) NOT NULL DEFAULT 'manual',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tenant_usage_snapshots" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tenant_usage_snapshots_tenant" FOREIGN KEY ("tenantId")
          REFERENCES "tenants" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tenant_usage_snapshots_band" FOREIGN KEY ("bandId")
          REFERENCES "license_usage_bands" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_usage_snapshots_tenant_measured" ON "tenant_usage_snapshots" ("tenantId", "measuredAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tenant_usage_snapshots_tenant_measured"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_usage_snapshots"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tenant_subscriptions_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tenant_subscriptions_plan"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tenant_subscriptions_tenant"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_subscriptions"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_license_usage_bands_displayOrder"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_license_usage_bands_code"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "license_usage_bands"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_license_plan_entitlements_feature"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_license_plan_entitlements_plan_feature"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "license_plan_entitlements"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_license_plans_displayOrder"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_license_plans_code"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "license_plans"`);
  }
}
