import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Wave 15 — WhatsApp Integration Readiness / Cloud API Pack.
 *
 * Two coordinated changes:
 *
 * 1. Extends `outreach_activities` with a small, honest delivery model
 *    (`deliveryMode`, `deliveryState`, `deliveryProvider`,
 *    `deliveryProviderMessageId`, `deliveryDetail`,
 *    `deliveryAttemptedAt`, `deliveryCompletedAt`).  Existing rows are
 *    backfilled to `assisted` / `prepared` so the v1.x history view
 *    keeps reading as "we prepared a follow-up".
 *
 * 2. Introduces `tenant_communication_configs` — a per-tenant readiness
 *    record for direct WhatsApp Cloud API delivery.  No row → tenant is
 *    `assisted_only`.  No secrets are stored; `whatsappAccessTokenRef`
 *    only holds an opaque reference (eg. `env:WHATSAPP_CLOUD_API_TOKEN`).
 */
export class Wave15WhatsAppIntegrationReadiness1746100000000 implements MigrationInterface {
  name = 'Wave15WhatsAppIntegrationReadiness1746100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "outreach_activities"
      ADD COLUMN IF NOT EXISTS "deliveryMode" varchar(16) NOT NULL DEFAULT 'assisted'
    `);
    await queryRunner.query(`
      ALTER TABLE "outreach_activities"
      ADD COLUMN IF NOT EXISTS "deliveryState" varchar(16) NOT NULL DEFAULT 'prepared'
    `);
    await queryRunner.query(`
      ALTER TABLE "outreach_activities"
      ADD COLUMN IF NOT EXISTS "deliveryProvider" varchar(32)
    `);
    await queryRunner.query(`
      ALTER TABLE "outreach_activities"
      ADD COLUMN IF NOT EXISTS "deliveryProviderMessageId" varchar(200)
    `);
    await queryRunner.query(`
      ALTER TABLE "outreach_activities"
      ADD COLUMN IF NOT EXISTS "deliveryDetail" varchar(500)
    `);
    await queryRunner.query(`
      ALTER TABLE "outreach_activities"
      ADD COLUMN IF NOT EXISTS "deliveryAttemptedAt" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "outreach_activities"
      ADD COLUMN IF NOT EXISTS "deliveryCompletedAt" timestamptz
    `);

    await queryRunner.query(`
      UPDATE "outreach_activities"
      SET "deliveryMode" = 'assisted'
      WHERE "deliveryMode" IS NULL OR "deliveryMode" = ''
    `);
    await queryRunner.query(`
      UPDATE "outreach_activities"
      SET "deliveryState" = 'prepared'
      WHERE "deliveryState" IS NULL OR "deliveryState" = ''
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_outreach_activities_tenant_delivery_state"
      ON "outreach_activities" ("tenantId", "deliveryState")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenant_communication_configs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "whatsappCloudApiEnabled" boolean NOT NULL DEFAULT false,
        "whatsappPhoneNumberId" varchar(64),
        "whatsappBusinessAccountId" varchar(64),
        "whatsappAccessTokenRef" varchar(200),
        "whatsappDisplayPhoneNumber" varchar(32),
        "whatsappValidationState" varchar(32),
        "whatsappValidationMessage" varchar(500),
        "whatsappValidatedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_tenant_communication_configs_tenant"
          FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tenant_communication_configs_tenant"
      ON "tenant_communication_configs" ("tenantId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."UQ_tenant_communication_configs_tenant"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tenant_communication_configs"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_outreach_activities_tenant_delivery_state"`);

    await queryRunner.query(`ALTER TABLE "outreach_activities" DROP COLUMN IF EXISTS "deliveryCompletedAt"`);
    await queryRunner.query(`ALTER TABLE "outreach_activities" DROP COLUMN IF EXISTS "deliveryAttemptedAt"`);
    await queryRunner.query(`ALTER TABLE "outreach_activities" DROP COLUMN IF EXISTS "deliveryDetail"`);
    await queryRunner.query(`ALTER TABLE "outreach_activities" DROP COLUMN IF EXISTS "deliveryProviderMessageId"`);
    await queryRunner.query(`ALTER TABLE "outreach_activities" DROP COLUMN IF EXISTS "deliveryProvider"`);
    await queryRunner.query(`ALTER TABLE "outreach_activities" DROP COLUMN IF EXISTS "deliveryState"`);
    await queryRunner.query(`ALTER TABLE "outreach_activities" DROP COLUMN IF EXISTS "deliveryMode"`);
  }
}
