import { MigrationInterface, QueryRunner } from 'typeorm';

export class Wave8IdentityAdminConsole1745200000000 implements MigrationInterface {
  name = 'Wave8IdentityAdminConsole1745200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "report_definitions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "key" character varying(64) NOT NULL,
        "titleKey" character varying(128) NOT NULL,
        "domains" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_report_definitions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_report_definitions_key" ON "report_definitions" ("key")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "saved_filter_presets" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "name" character varying(200) NOT NULL,
        "surface" character varying(64) NOT NULL,
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_saved_filter_presets" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_saved_filter_presets_tenant_surface" ON "saved_filter_presets" ("tenantId", "surface")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "action_center_item_states" (
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
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_action_center_item_states" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_action_center_item_states_tenant_item" ON "action_center_item_states" ("tenantId", "itemKey")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_action_center_item_states_tenant_read" ON "action_center_item_states" ("tenantId", "readAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_action_center_item_states_tenant_dismissed" ON "action_center_item_states" ("tenantId", "dismissedAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_action_center_item_states_tenant_completed" ON "action_center_item_states" ("tenantId", "completedAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_action_center_item_states_tenant_snoozed" ON "action_center_item_states" ("tenantId", "snoozedUntil")`,
    );

    await queryRunner.query(`
      CREATE TABLE "staff_users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying(320) NOT NULL,
        "firstName" character varying(120) NOT NULL,
        "lastName" character varying(120) NOT NULL,
        "preferredName" character varying(160),
        "platformRole" character varying(32) NOT NULL DEFAULT 'standard',
        "status" character varying(32) NOT NULL DEFAULT 'active',
        "passwordHash" character varying(128) NOT NULL,
        "passwordSalt" character varying(64) NOT NULL,
        "lastLoginAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_staff_users" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_staff_users_email" ON "staff_users" ("email")`);
    await queryRunner.query(`CREATE INDEX "IDX_staff_users_status" ON "staff_users" ("status")`);

    await queryRunner.query(`
      CREATE TABLE "tenant_memberships" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "staffUserId" uuid NOT NULL,
        "role" character varying(32) NOT NULL,
        "isDefault" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tenant_memberships" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_tenant_memberships_tenant_staff" ON "tenant_memberships" ("tenantId", "staffUserId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tenant_memberships_tenant_role" ON "tenant_memberships" ("tenantId", "role")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tenant_memberships_staff_user" ON "tenant_memberships" ("staffUserId")`,
    );
    await queryRunner.query(`
      ALTER TABLE "tenant_memberships"
      ADD CONSTRAINT "FK_tenant_memberships_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "tenant_memberships"
      ADD CONSTRAINT "FK_tenant_memberships_staff_user" FOREIGN KEY ("staffUserId") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "staff_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "staffUserId" uuid NOT NULL,
        "tokenHash" character varying(128) NOT NULL,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "lastSeenAt" TIMESTAMPTZ,
        "revokedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_staff_sessions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_staff_sessions_token_hash" ON "staff_sessions" ("tokenHash")`);
    await queryRunner.query(`CREATE INDEX "IDX_staff_sessions_staff_user" ON "staff_sessions" ("staffUserId")`);
    await queryRunner.query(`CREATE INDEX "IDX_staff_sessions_expires_at" ON "staff_sessions" ("expiresAt")`);
    await queryRunner.query(`
      ALTER TABLE "staff_sessions"
      ADD CONSTRAINT "FK_staff_sessions_staff_user" FOREIGN KEY ("staffUserId") REFERENCES "staff_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "staff_sessions" DROP CONSTRAINT "FK_staff_sessions_staff_user"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_staff_sessions_expires_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_staff_sessions_staff_user"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_staff_sessions_token_hash"`);
    await queryRunner.query(`DROP TABLE "staff_sessions"`);

    await queryRunner.query(`ALTER TABLE "tenant_memberships" DROP CONSTRAINT "FK_tenant_memberships_staff_user"`);
    await queryRunner.query(`ALTER TABLE "tenant_memberships" DROP CONSTRAINT "FK_tenant_memberships_tenant"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_tenant_memberships_staff_user"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_tenant_memberships_tenant_role"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_tenant_memberships_tenant_staff"`);
    await queryRunner.query(`DROP TABLE "tenant_memberships"`);

    await queryRunner.query(`DROP INDEX "public"."IDX_staff_users_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_staff_users_email"`);
    await queryRunner.query(`DROP TABLE "staff_users"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_saved_filter_presets_tenant_surface"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "saved_filter_presets"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_report_definitions_key"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "report_definitions"`);
  }
}
