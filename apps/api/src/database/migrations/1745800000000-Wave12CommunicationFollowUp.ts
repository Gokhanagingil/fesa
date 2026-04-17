import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Wave 12 — Communication & Follow-up Pack v1.
 *
 * Introduces an `outreach_activities` table to log assisted follow-up
 * actions taken from the Communication surface.  Channel is stored as a
 * compact varchar (whatsapp | phone | email | manual) so we can extend
 * later without dropping a Postgres enum.
 */
export class Wave12CommunicationFollowUp1745800000000 implements MigrationInterface {
  name = 'Wave12CommunicationFollowUp1745800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "outreach_activities" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "channel" varchar(32) NOT NULL,
        "sourceSurface" varchar(64) NOT NULL,
        "sourceKey" varchar(128),
        "templateKey" varchar(64),
        "topic" varchar(200) NOT NULL,
        "messagePreview" text,
        "recipientCount" int NOT NULL DEFAULT 0,
        "reachableGuardianCount" int NOT NULL DEFAULT 0,
        "audienceSnapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "note" varchar(500),
        "createdByStaffUserId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'outreach_activities'
            AND constraint_name = 'FK_outreach_activities_tenant'
        ) THEN
          ALTER TABLE "outreach_activities"
          ADD CONSTRAINT "FK_outreach_activities_tenant"
          FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'outreach_activities'
            AND constraint_name = 'FK_outreach_activities_staff_user'
        ) THEN
          ALTER TABLE "outreach_activities"
          ADD CONSTRAINT "FK_outreach_activities_staff_user"
          FOREIGN KEY ("createdByStaffUserId") REFERENCES "staff_users"("id") ON DELETE SET NULL;
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_outreach_activities_tenant_created"
      ON "outreach_activities" ("tenantId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_outreach_activities_tenant_channel"
      ON "outreach_activities" ("tenantId", "channel")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_outreach_activities_tenant_channel"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_outreach_activities_tenant_created"`);
    await queryRunner.query(
      `ALTER TABLE "outreach_activities" DROP CONSTRAINT IF EXISTS "FK_outreach_activities_staff_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "outreach_activities" DROP CONSTRAINT IF EXISTS "FK_outreach_activities_tenant"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "outreach_activities"`);
  }
}
