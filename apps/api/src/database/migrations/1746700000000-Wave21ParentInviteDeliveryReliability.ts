import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Parent Invite Delivery & Access Reliability Pack — schema additions.
 *
 * Honest invite-delivery state is persisted on `guardian_portal_accesses`
 * so the staff UI can render the truth ("sent" vs. "shared manually"
 * vs. "delivery unavailable") without having to guess. None of the
 * existing access / activation / recovery columns change.
 *
 * Every column is nullable / has a sensible default so the migration is
 * non-breaking on existing rows (their delivery state stays `null`,
 * which the API renders as "no attempt recorded yet").
 */
export class Wave21ParentInviteDeliveryReliability1746700000000
  implements MigrationInterface
{
  name = 'Wave21ParentInviteDeliveryReliability1746700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "guardian_portal_accesses"
      ADD COLUMN IF NOT EXISTS "inviteDeliveryState" varchar(32)
    `);
    await queryRunner.query(`
      ALTER TABLE "guardian_portal_accesses"
      ADD COLUMN IF NOT EXISTS "inviteDeliveryProvider" varchar(64)
    `);
    await queryRunner.query(`
      ALTER TABLE "guardian_portal_accesses"
      ADD COLUMN IF NOT EXISTS "inviteDeliveryDetail" varchar(500)
    `);
    await queryRunner.query(`
      ALTER TABLE "guardian_portal_accesses"
      ADD COLUMN IF NOT EXISTS "inviteDeliveryAttemptedAt" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "guardian_portal_accesses"
      ADD COLUMN IF NOT EXISTS "inviteDeliveredAt" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "guardian_portal_accesses"
      ADD COLUMN IF NOT EXISTS "inviteSharedAt" timestamptz
    `);
    await queryRunner.query(`
      ALTER TABLE "guardian_portal_accesses"
      ADD COLUMN IF NOT EXISTS "inviteAttemptCount" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_guardian_portal_accesses_inviteDeliveryState"
      ON "guardian_portal_accesses" ("tenantId", "inviteDeliveryState")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_guardian_portal_accesses_inviteDeliveryState"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guardian_portal_accesses" DROP COLUMN IF EXISTS "inviteAttemptCount"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guardian_portal_accesses" DROP COLUMN IF EXISTS "inviteSharedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guardian_portal_accesses" DROP COLUMN IF EXISTS "inviteDeliveredAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guardian_portal_accesses" DROP COLUMN IF EXISTS "inviteDeliveryAttemptedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guardian_portal_accesses" DROP COLUMN IF EXISTS "inviteDeliveryDetail"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guardian_portal_accesses" DROP COLUMN IF EXISTS "inviteDeliveryProvider"`,
    );
    await queryRunner.query(
      `ALTER TABLE "guardian_portal_accesses" DROP COLUMN IF EXISTS "inviteDeliveryState"`,
    );
  }
}
