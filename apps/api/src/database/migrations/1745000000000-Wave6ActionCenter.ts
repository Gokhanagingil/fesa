import { MigrationInterface, QueryRunner } from 'typeorm';

export class Wave6ActionCenter1745000000000 implements MigrationInterface {
  name = 'Wave6ActionCenter1745000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "action_center_item_states" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "itemKey" character varying(160) NOT NULL,
        "snapshotToken" character varying(64) NOT NULL,
        "category" character varying(32) NOT NULL,
        "type" character varying(48) NOT NULL,
        "readAt" TIMESTAMPTZ,
        "dismissedAt" TIMESTAMPTZ,
        "completedAt" TIMESTAMPTZ,
        "snoozedUntil" TIMESTAMPTZ,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_action_center_item_states" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_action_center_item_states_tenant_item" ON "action_center_item_states" ("tenantId", "itemKey")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_action_center_item_states_tenant_read" ON "action_center_item_states" ("tenantId", "readAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_action_center_item_states_tenant_dismissed" ON "action_center_item_states" ("tenantId", "dismissedAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_action_center_item_states_tenant_completed" ON "action_center_item_states" ("tenantId", "completedAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_action_center_item_states_tenant_snoozed" ON "action_center_item_states" ("tenantId", "snoozedUntil")`,
    );
    await queryRunner.query(`
      ALTER TABLE "action_center_item_states"
      ADD CONSTRAINT "FK_action_center_item_states_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "action_center_item_states" DROP CONSTRAINT "FK_action_center_item_states_tenant"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_action_center_item_states_tenant_snoozed"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_action_center_item_states_tenant_completed"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_action_center_item_states_tenant_dismissed"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_action_center_item_states_tenant_read"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_action_center_item_states_tenant_item"`);
    await queryRunner.query(`DROP TABLE "action_center_item_states"`);
  }
}
