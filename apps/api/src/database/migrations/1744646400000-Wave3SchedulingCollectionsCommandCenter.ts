import { MigrationInterface, QueryRunner } from 'typeorm';

export class Wave3SchedulingCollectionsCommandCenter1744646400000 implements MigrationInterface {
  name = 'Wave3SchedulingCollectionsCommandCenter1744646400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "training_session_series" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "title" character varying(200) NOT NULL,
        "sportBranchId" uuid NOT NULL,
        "groupId" uuid NOT NULL,
        "teamId" uuid,
        "startsOn" date NOT NULL,
        "endsOn" date NOT NULL,
        "weekdays" integer array NOT NULL DEFAULT '{}',
        "sessionStartTime" time NOT NULL,
        "sessionEndTime" time NOT NULL,
        "location" character varying(200),
        "status" "training_session_status" NOT NULL DEFAULT 'planned',
        "notes" character varying(1000),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_training_session_series" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_training_session_series_tenant_group" ON "training_session_series" ("tenantId", "groupId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_training_session_series_tenant_team" ON "training_session_series" ("tenantId", "teamId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_training_session_series_tenant_starts_on" ON "training_session_series" ("tenantId", "startsOn")`,
    );
    await queryRunner.query(`
      ALTER TABLE "training_session_series"
      ADD CONSTRAINT "FK_training_session_series_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "training_session_series"
      ADD CONSTRAINT "FK_training_session_series_branch" FOREIGN KEY ("sportBranchId") REFERENCES "sport_branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "training_session_series"
      ADD CONSTRAINT "FK_training_session_series_group" FOREIGN KEY ("groupId") REFERENCES "club_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "training_session_series"
      ADD CONSTRAINT "FK_training_session_series_team" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`ALTER TABLE "training_sessions" ADD "seriesId" uuid`);
    await queryRunner.query(
      `CREATE INDEX "IDX_training_sessions_tenant_series" ON "training_sessions" ("tenantId", "seriesId")`,
    );
    await queryRunner.query(`
      ALTER TABLE "training_sessions"
      ADD CONSTRAINT "FK_training_sessions_series" FOREIGN KEY ("seriesId") REFERENCES "training_session_series"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "payments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "athleteId" uuid NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "currency" character varying(3) NOT NULL,
        "paidAt" TIMESTAMPTZ NOT NULL,
        "method" character varying(64),
        "reference" character varying(120),
        "notes" character varying(500),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payments" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_payments_tenant_athlete" ON "payments" ("tenantId", "athleteId")`);
    await queryRunner.query(`CREATE INDEX "IDX_payments_tenant_paid_at" ON "payments" ("tenantId", "paidAt")`);
    await queryRunner.query(`
      ALTER TABLE "payments"
      ADD CONSTRAINT "FK_payments_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "payments"
      ADD CONSTRAINT "FK_payments_athlete" FOREIGN KEY ("athleteId") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "payment_allocations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "paymentId" uuid NOT NULL,
        "athleteChargeId" uuid NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_allocations" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payment_allocations_payment_charge" UNIQUE ("paymentId", "athleteChargeId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_payment_allocations_tenant_payment" ON "payment_allocations" ("tenantId", "paymentId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_payment_allocations_tenant_charge" ON "payment_allocations" ("tenantId", "athleteChargeId")`,
    );
    await queryRunner.query(`
      ALTER TABLE "payment_allocations"
      ADD CONSTRAINT "FK_payment_allocations_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_allocations"
      ADD CONSTRAINT "FK_payment_allocations_payment" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "payment_allocations"
      ADD CONSTRAINT "FK_payment_allocations_charge" FOREIGN KEY ("athleteChargeId") REFERENCES "athlete_charges"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payment_allocations" DROP CONSTRAINT "FK_payment_allocations_charge"`);
    await queryRunner.query(`ALTER TABLE "payment_allocations" DROP CONSTRAINT "FK_payment_allocations_payment"`);
    await queryRunner.query(`ALTER TABLE "payment_allocations" DROP CONSTRAINT "FK_payment_allocations_tenant"`);
    await queryRunner.query(`DROP TABLE "payment_allocations"`);

    await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_athlete"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_payments_tenant"`);
    await queryRunner.query(`DROP TABLE "payments"`);

    await queryRunner.query(`ALTER TABLE "training_sessions" DROP CONSTRAINT "FK_training_sessions_series"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_training_sessions_tenant_series"`);
    await queryRunner.query(`ALTER TABLE "training_sessions" DROP COLUMN "seriesId"`);

    await queryRunner.query(`ALTER TABLE "training_session_series" DROP CONSTRAINT "FK_training_session_series_team"`);
    await queryRunner.query(`ALTER TABLE "training_session_series" DROP CONSTRAINT "FK_training_session_series_group"`);
    await queryRunner.query(`ALTER TABLE "training_session_series" DROP CONSTRAINT "FK_training_session_series_branch"`);
    await queryRunner.query(`ALTER TABLE "training_session_series" DROP CONSTRAINT "FK_training_session_series_tenant"`);
    await queryRunner.query(`DROP TABLE "training_session_series"`);
  }
}
