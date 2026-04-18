import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Wave 13 — Communication & Follow-up Pack v1.1.
 *
 * Adds a lightweight lifecycle column to `outreach_activities` so the
 * surface can hold "draft" rows that operators come back to, in addition
 * to the existing "logged" follow-up records.  Stored as varchar (not a
 * Postgres enum) so the lifecycle can grow without a destructive
 * migration.
 *
 * Backfills existing rows as `logged` to preserve the v1 contract.
 */
export class Wave13CommunicationFollowUpV1_11745900000000 implements MigrationInterface {
  name = 'Wave13CommunicationFollowUpV1_11745900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "outreach_activities"
      ADD COLUMN IF NOT EXISTS "status" varchar(16) NOT NULL DEFAULT 'logged'
    `);

    await queryRunner.query(`
      UPDATE "outreach_activities"
      SET "status" = 'logged'
      WHERE "status" IS NULL OR "status" = ''
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_outreach_activities_tenant_status"
      ON "outreach_activities" ("tenantId", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_outreach_activities_tenant_status"`);
    await queryRunner.query(`ALTER TABLE "outreach_activities" DROP COLUMN IF EXISTS "status"`);
  }
}
