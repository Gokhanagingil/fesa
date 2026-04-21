import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Wave 23 — Billing & Licensing Operationalization Pack v1.
 *
 * Extends Wave 22 with the operational backbone the licensing layer
 * needs to actually run a commercial control plane:
 *
 *   - `tenant_subscription_history` — append-only commercial change ledger
 *     so every plan / lifecycle / dates change is historically traceable
 *     without bolting a giant audit subsystem onto the product.
 *
 * We deliberately do NOT alter the Wave 22 tables here. The original
 * commercial backbone stays exactly as designed; this migration only
 * adds the new history surface and a small `notes` column nothing else
 * touches yet.
 */
export class Wave23BillingLicensingOperationalization1746900000000
  implements MigrationInterface
{
  name = 'Wave23BillingLicensingOperationalization1746900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenant_subscription_history" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "subscriptionId" uuid,
        "previousPlanId" uuid,
        "nextPlanId" uuid,
        "previousPlanCode" varchar(120),
        "nextPlanCode" varchar(120),
        "previousStatus" varchar(32),
        "nextStatus" varchar(32),
        "changeKind" varchar(32) NOT NULL,
        "changedFields" jsonb,
        "statusReason" varchar(240),
        "internalNote" varchar(240),
        "actorStaffUserId" uuid,
        "actorDisplayName" varchar(240),
        "changedAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tenant_subscription_history" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tenant_subscription_history_tenant" FOREIGN KEY ("tenantId")
          REFERENCES "tenants" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tenant_subscription_history_previous_plan" FOREIGN KEY ("previousPlanId")
          REFERENCES "license_plans" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_tenant_subscription_history_next_plan" FOREIGN KEY ("nextPlanId")
          REFERENCES "license_plans" ("id") ON DELETE SET NULL,
        CONSTRAINT "FK_tenant_subscription_history_actor" FOREIGN KEY ("actorStaffUserId")
          REFERENCES "staff_users" ("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_subscription_history_tenant_changed" ON "tenant_subscription_history" ("tenantId", "changedAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_subscription_history_changed" ON "tenant_subscription_history" ("changedAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tenant_subscription_history_changed"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tenant_subscription_history_tenant_changed"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_subscription_history"`);
  }
}
