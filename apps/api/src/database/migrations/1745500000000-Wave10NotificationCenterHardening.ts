import { MigrationInterface, QueryRunner } from 'typeorm';

export class Wave10NotificationCenterHardening1745500000000 implements MigrationInterface {
  name = 'Wave10NotificationCenterHardening1745500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "action_center_item_states"
      ADD COLUMN IF NOT EXISTS "staffUserId" uuid
    `);

    await queryRunner.query(`
      UPDATE "action_center_item_states"
      SET "staffUserId" = NULL
      WHERE "staffUserId" IS DISTINCT FROM NULL
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_action_center_item_states_tenant_snoozed"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_action_center_item_states_tenant_completed"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_action_center_item_states_tenant_dismissed"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_action_center_item_states_tenant_read"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_action_center_item_states_tenant_item"`);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_action_center_item_states_tenant_staff_item"
      ON "action_center_item_states" ("tenantId", "staffUserId", "itemKey")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_action_center_item_states_tenant_staff_read"
      ON "action_center_item_states" ("tenantId", "staffUserId", "readAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_action_center_item_states_tenant_staff_dismissed"
      ON "action_center_item_states" ("tenantId", "staffUserId", "dismissedAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_action_center_item_states_tenant_staff_completed"
      ON "action_center_item_states" ("tenantId", "staffUserId", "completedAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_action_center_item_states_tenant_staff_snoozed"
      ON "action_center_item_states" ("tenantId", "staffUserId", "snoozedUntil")
    `);

    await queryRunner.query(`
      ALTER TABLE "action_center_item_states"
      ADD CONSTRAINT "FK_action_center_item_states_staff_user"
      FOREIGN KEY ("staffUserId") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "action_center_item_states" DROP CONSTRAINT IF EXISTS "FK_action_center_item_states_staff_user"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_action_center_item_states_tenant_staff_snoozed"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_action_center_item_states_tenant_staff_completed"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_action_center_item_states_tenant_staff_dismissed"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_action_center_item_states_tenant_staff_read"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_action_center_item_states_tenant_staff_item"`);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_action_center_item_states_tenant_item"
      ON "action_center_item_states" ("tenantId", "itemKey")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_action_center_item_states_tenant_read"
      ON "action_center_item_states" ("tenantId", "readAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_action_center_item_states_tenant_dismissed"
      ON "action_center_item_states" ("tenantId", "dismissedAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_action_center_item_states_tenant_completed"
      ON "action_center_item_states" ("tenantId", "completedAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_action_center_item_states_tenant_snoozed"
      ON "action_center_item_states" ("tenantId", "snoozedUntil")
    `);

    await queryRunner.query(`
      ALTER TABLE "action_center_item_states"
      DROP COLUMN IF EXISTS "staffUserId"
    `);
  }
}
