import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Wave 20 — Parent Portal v1.2 (Targeted Announcements + Family Utility +
 * Parent Recovery UX).
 *
 * Three small, non-breaking schema changes:
 *
 *   1. `club_updates` gains a tiny audience model so staff can target a
 *      single sport branch / group / team without inventing a full
 *      audience builder. Default scope stays `all`, so every existing
 *      card keeps showing to every parent on first run.
 *
 *   2. `guardian_portal_accesses` gains two recovery-tracking columns
 *      so staff can see when a family asked for help and how often.
 *      The actual reset still flows through the existing staff
 *      resend-invite path; these columns are observability only.
 */
export class Wave20ParentPortalV121746600000000 implements MigrationInterface {
  name = 'Wave20ParentPortalV121746600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "club_updates"
      ADD COLUMN IF NOT EXISTS "audienceScope" varchar(32) NOT NULL DEFAULT 'all'
    `);
    await queryRunner.query(`
      ALTER TABLE "club_updates"
      ADD COLUMN IF NOT EXISTS "audienceSportBranchId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "club_updates"
      ADD COLUMN IF NOT EXISTS "audienceGroupId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "club_updates"
      ADD COLUMN IF NOT EXISTS "audienceTeamId" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_club_updates_tenantId_audience"
      ON "club_updates" ("tenantId", "audienceScope")
    `);

    await queryRunner.query(`
      ALTER TABLE "guardian_portal_accesses"
      ADD COLUMN IF NOT EXISTS "recoveryRequestedAt" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "guardian_portal_accesses"
      ADD COLUMN IF NOT EXISTS "recoveryRequestCount" integer NOT NULL DEFAULT 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "guardian_portal_accesses" DROP COLUMN IF EXISTS "recoveryRequestCount"
    `);
    await queryRunner.query(`
      ALTER TABLE "guardian_portal_accesses" DROP COLUMN IF EXISTS "recoveryRequestedAt"
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_club_updates_tenantId_audience"`);
    await queryRunner.query(`ALTER TABLE "club_updates" DROP COLUMN IF EXISTS "audienceTeamId"`);
    await queryRunner.query(`ALTER TABLE "club_updates" DROP COLUMN IF EXISTS "audienceGroupId"`);
    await queryRunner.query(`ALTER TABLE "club_updates" DROP COLUMN IF EXISTS "audienceSportBranchId"`);
    await queryRunner.query(`ALTER TABLE "club_updates" DROP COLUMN IF EXISTS "audienceScope"`);
  }
}
