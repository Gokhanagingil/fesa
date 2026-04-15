import { MigrationInterface, QueryRunner } from 'typeorm';

export class Wave5FamilyPortalReadiness1744909200000 implements MigrationInterface {
  name = 'Wave5FamilyPortalReadiness1744909200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "family_action_request_type" AS ENUM(
        'guardian_profile_update',
        'contact_details_completion',
        'consent_acknowledgement',
        'enrollment_readiness',
        'profile_correction'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "family_action_request_status" AS ENUM(
        'open',
        'pending_family_action',
        'submitted',
        'under_review',
        'approved',
        'rejected',
        'completed',
        'closed'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "family_action_actor" AS ENUM('club', 'family', 'system')
    `);
    await queryRunner.query(`
      CREATE TABLE "family_action_requests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "athleteId" uuid NOT NULL,
        "guardianId" uuid,
        "type" "family_action_request_type" NOT NULL,
        "status" "family_action_request_status" NOT NULL DEFAULT 'pending_family_action',
        "title" character varying(200) NOT NULL,
        "description" character varying(1000),
        "dueDate" date,
        "payload" jsonb NOT NULL DEFAULT '{}',
        "latestResponseText" character varying(1000),
        "decisionNote" character varying(1000),
        "submittedAt" TIMESTAMPTZ,
        "reviewedAt" TIMESTAMPTZ,
        "resolvedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_family_action_requests" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_family_action_requests_tenant_status" ON "family_action_requests" ("tenantId", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_family_action_requests_tenant_athlete_status" ON "family_action_requests" ("tenantId", "athleteId", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_family_action_requests_tenant_guardian_status" ON "family_action_requests" ("tenantId", "guardianId", "status")`,
    );
    await queryRunner.query(`
      ALTER TABLE "family_action_requests"
      ADD CONSTRAINT "FK_family_action_requests_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "family_action_requests"
      ADD CONSTRAINT "FK_family_action_requests_athlete" FOREIGN KEY ("athleteId") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "family_action_requests"
      ADD CONSTRAINT "FK_family_action_requests_guardian" FOREIGN KEY ("guardianId") REFERENCES "guardians"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "family_action_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "familyActionRequestId" uuid NOT NULL,
        "actor" "family_action_actor" NOT NULL,
        "eventType" character varying(64) NOT NULL,
        "fromStatus" "family_action_request_status",
        "toStatus" "family_action_request_status",
        "note" character varying(1000),
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_family_action_events" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_family_action_events_tenant_request" ON "family_action_events" ("tenantId", "familyActionRequestId")`,
    );
    await queryRunner.query(`
      ALTER TABLE "family_action_events"
      ADD CONSTRAINT "FK_family_action_events_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "family_action_events"
      ADD CONSTRAINT "FK_family_action_events_request" FOREIGN KEY ("familyActionRequestId") REFERENCES "family_action_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "family_action_events" DROP CONSTRAINT "FK_family_action_events_request"`);
    await queryRunner.query(`ALTER TABLE "family_action_events" DROP CONSTRAINT "FK_family_action_events_tenant"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_family_action_events_tenant_request"`);
    await queryRunner.query(`DROP TABLE "family_action_events"`);

    await queryRunner.query(`ALTER TABLE "family_action_requests" DROP CONSTRAINT "FK_family_action_requests_guardian"`);
    await queryRunner.query(`ALTER TABLE "family_action_requests" DROP CONSTRAINT "FK_family_action_requests_athlete"`);
    await queryRunner.query(`ALTER TABLE "family_action_requests" DROP CONSTRAINT "FK_family_action_requests_tenant"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_family_action_requests_tenant_guardian_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_family_action_requests_tenant_athlete_status"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_family_action_requests_tenant_status"`);
    await queryRunner.query(`DROP TABLE "family_action_requests"`);

    await queryRunner.query(`DROP TYPE "family_action_actor"`);
    await queryRunner.query(`DROP TYPE "family_action_request_status"`);
    await queryRunner.query(`DROP TYPE "family_action_request_type"`);
  }
}
