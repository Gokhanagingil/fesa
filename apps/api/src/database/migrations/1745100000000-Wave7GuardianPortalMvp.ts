import { MigrationInterface, QueryRunner } from 'typeorm';

export class Wave7GuardianPortalMvp1745100000000 implements MigrationInterface {
  name = 'Wave7GuardianPortalMvp1745100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "guardian_portal_accesses" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "guardianId" uuid NOT NULL,
        "email" character varying(320) NOT NULL,
        "status" character varying(32) NOT NULL DEFAULT 'invited',
        "passwordHash" character varying(128),
        "passwordSalt" character varying(64),
        "inviteTokenHash" character varying(128),
        "inviteTokenExpiresAt" TIMESTAMPTZ,
        "invitedAt" TIMESTAMPTZ,
        "activatedAt" TIMESTAMPTZ,
        "lastLoginAt" TIMESTAMPTZ,
        "disabledAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_guardian_portal_accesses" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_guardian_portal_accesses_tenant_guardian" UNIQUE ("tenantId", "guardianId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_guardian_portal_accesses_tenant_email" ON "guardian_portal_accesses" ("tenantId", "email")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_guardian_portal_accesses_tenant_status" ON "guardian_portal_accesses" ("tenantId", "status")`,
    );
    await queryRunner.query(`
      ALTER TABLE "guardian_portal_accesses"
      ADD CONSTRAINT "FK_guardian_portal_accesses_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "guardian_portal_accesses"
      ADD CONSTRAINT "FK_guardian_portal_accesses_guardian" FOREIGN KEY ("guardianId") REFERENCES "guardians"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "guardian_portal_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "guardianPortalAccessId" uuid NOT NULL,
        "tokenHash" character varying(128) NOT NULL,
        "expiresAt" TIMESTAMPTZ NOT NULL,
        "lastSeenAt" TIMESTAMPTZ,
        "revokedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_guardian_portal_sessions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_guardian_portal_sessions_tenant_token" ON "guardian_portal_sessions" ("tenantId", "tokenHash")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_guardian_portal_sessions_tenant_access" ON "guardian_portal_sessions" ("tenantId", "guardianPortalAccessId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_guardian_portal_sessions_tenant_expires" ON "guardian_portal_sessions" ("tenantId", "expiresAt")`,
    );
    await queryRunner.query(`
      ALTER TABLE "guardian_portal_sessions"
      ADD CONSTRAINT "FK_guardian_portal_sessions_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "guardian_portal_sessions"
      ADD CONSTRAINT "FK_guardian_portal_sessions_access" FOREIGN KEY ("guardianPortalAccessId") REFERENCES "guardian_portal_accesses"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "guardian_portal_sessions" DROP CONSTRAINT "FK_guardian_portal_sessions_access"`);
    await queryRunner.query(`ALTER TABLE "guardian_portal_sessions" DROP CONSTRAINT "FK_guardian_portal_sessions_tenant"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_guardian_portal_sessions_tenant_expires"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_guardian_portal_sessions_tenant_access"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_guardian_portal_sessions_tenant_token"`);
    await queryRunner.query(`DROP TABLE "guardian_portal_sessions"`);

    await queryRunner.query(`ALTER TABLE "guardian_portal_accesses" DROP CONSTRAINT "FK_guardian_portal_accesses_guardian"`);
    await queryRunner.query(`ALTER TABLE "guardian_portal_accesses" DROP CONSTRAINT "FK_guardian_portal_accesses_tenant"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_guardian_portal_accesses_tenant_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_guardian_portal_accesses_tenant_email"`);
    await queryRunner.query(`DROP TABLE "guardian_portal_accesses"`);
  }
}
