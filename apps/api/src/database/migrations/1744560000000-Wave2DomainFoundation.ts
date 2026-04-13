import { MigrationInterface, QueryRunner } from 'typeorm';

export class Wave2DomainFoundation1744560000000 implements MigrationInterface {
  name = 'Wave2DomainFoundation1744560000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "athlete_status" AS ENUM ('active', 'inactive', 'trial', 'archived')`,
    );
    await queryRunner.query(
      `CREATE TYPE "training_session_status" AS ENUM ('planned', 'completed', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "attendance_status" AS ENUM ('present', 'absent', 'excused', 'late')`,
    );
    await queryRunner.query(
      `CREATE TYPE "athlete_charge_status" AS ENUM ('pending', 'partially_paid', 'paid', 'cancelled')`,
    );

    await queryRunner.query(`
      CREATE TABLE "athletes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "firstName" character varying(120) NOT NULL,
        "lastName" character varying(120) NOT NULL,
        "preferredName" character varying(160),
        "birthDate" date,
        "gender" character varying(32),
        "sportBranchId" uuid NOT NULL,
        "primaryGroupId" uuid,
        "status" "athlete_status" NOT NULL DEFAULT 'active',
        "jerseyNumber" character varying(8),
        "notes" character varying(500),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_athletes" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_athletes_tenant_status" ON "athletes" ("tenantId", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_athletes_tenant_branch" ON "athletes" ("tenantId", "sportBranchId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_athletes_tenant_group" ON "athletes" ("tenantId", "primaryGroupId")`,
    );
    await queryRunner.query(`
      ALTER TABLE "athletes"
      ADD CONSTRAINT "FK_athletes_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "athletes"
      ADD CONSTRAINT "FK_athletes_sport_branch" FOREIGN KEY ("sportBranchId") REFERENCES "sport_branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "athletes"
      ADD CONSTRAINT "FK_athletes_primary_group" FOREIGN KEY ("primaryGroupId") REFERENCES "club_groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "guardians" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "firstName" character varying(120) NOT NULL,
        "lastName" character varying(120) NOT NULL,
        "phone" character varying(32),
        "email" character varying(320),
        "notes" character varying(500),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_guardians" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_guardians_tenant" ON "guardians" ("tenantId")`);
    await queryRunner.query(`
      ALTER TABLE "guardians"
      ADD CONSTRAINT "FK_guardians_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "athlete_guardians" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "athleteId" uuid NOT NULL,
        "guardianId" uuid NOT NULL,
        "relationshipType" character varying(32) NOT NULL,
        "isPrimaryContact" boolean NOT NULL DEFAULT false,
        "notes" character varying(500),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_athlete_guardians" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_athlete_guardians_pair" UNIQUE ("athleteId", "guardianId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_athlete_guardians_tenant_athlete" ON "athlete_guardians" ("tenantId", "athleteId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_athlete_guardians_tenant_guardian" ON "athlete_guardians" ("tenantId", "guardianId")`,
    );
    await queryRunner.query(`
      ALTER TABLE "athlete_guardians"
      ADD CONSTRAINT "FK_athlete_guardians_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "athlete_guardians"
      ADD CONSTRAINT "FK_athlete_guardians_athlete" FOREIGN KEY ("athleteId") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "athlete_guardians"
      ADD CONSTRAINT "FK_athlete_guardians_guardian" FOREIGN KEY ("guardianId") REFERENCES "guardians"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "athlete_team_memberships" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "athleteId" uuid NOT NULL,
        "teamId" uuid NOT NULL,
        "startedAt" TIMESTAMPTZ,
        "endedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_athlete_team_memberships" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_atm_tenant_athlete" ON "athlete_team_memberships" ("tenantId", "athleteId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_atm_tenant_team" ON "athlete_team_memberships" ("tenantId", "teamId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_atm_athlete_team_ended" ON "athlete_team_memberships" ("athleteId", "teamId", "endedAt")`,
    );
    await queryRunner.query(`
      ALTER TABLE "athlete_team_memberships"
      ADD CONSTRAINT "FK_atm_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "athlete_team_memberships"
      ADD CONSTRAINT "FK_atm_athlete" FOREIGN KEY ("athleteId") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "athlete_team_memberships"
      ADD CONSTRAINT "FK_atm_team" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "training_sessions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "title" character varying(200) NOT NULL,
        "sportBranchId" uuid NOT NULL,
        "groupId" uuid NOT NULL,
        "teamId" uuid,
        "scheduledStart" TIMESTAMPTZ NOT NULL,
        "scheduledEnd" TIMESTAMPTZ NOT NULL,
        "location" character varying(200),
        "status" "training_session_status" NOT NULL DEFAULT 'planned',
        "notes" character varying(1000),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_training_sessions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_training_sessions_tenant_start" ON "training_sessions" ("tenantId", "scheduledStart")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_training_sessions_tenant_group" ON "training_sessions" ("tenantId", "groupId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_training_sessions_tenant_team" ON "training_sessions" ("tenantId", "teamId")`,
    );
    await queryRunner.query(`
      ALTER TABLE "training_sessions"
      ADD CONSTRAINT "FK_training_sessions_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "training_sessions"
      ADD CONSTRAINT "FK_training_sessions_branch" FOREIGN KEY ("sportBranchId") REFERENCES "sport_branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "training_sessions"
      ADD CONSTRAINT "FK_training_sessions_group" FOREIGN KEY ("groupId") REFERENCES "club_groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "training_sessions"
      ADD CONSTRAINT "FK_training_sessions_team" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "attendances" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "trainingSessionId" uuid NOT NULL,
        "athleteId" uuid NOT NULL,
        "status" "attendance_status" NOT NULL DEFAULT 'present',
        "note" character varying(500),
        "recordedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_attendances" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_attendances_session_athlete" UNIQUE ("trainingSessionId", "athleteId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_attendances_tenant_session" ON "attendances" ("tenantId", "trainingSessionId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_attendances_tenant_athlete" ON "attendances" ("tenantId", "athleteId")`,
    );
    await queryRunner.query(`
      ALTER TABLE "attendances"
      ADD CONSTRAINT "FK_attendances_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "attendances"
      ADD CONSTRAINT "FK_attendances_session" FOREIGN KEY ("trainingSessionId") REFERENCES "training_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "attendances"
      ADD CONSTRAINT "FK_attendances_athlete" FOREIGN KEY ("athleteId") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "charge_items" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "name" character varying(200) NOT NULL,
        "category" character varying(64) NOT NULL,
        "defaultAmount" numeric(12,2) NOT NULL,
        "currency" character varying(3) NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_charge_items" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_charge_items_tenant_active" ON "charge_items" ("tenantId", "isActive")`,
    );
    await queryRunner.query(`
      ALTER TABLE "charge_items"
      ADD CONSTRAINT "FK_charge_items_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "athlete_charges" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "athleteId" uuid NOT NULL,
        "chargeItemId" uuid NOT NULL,
        "amount" numeric(12,2) NOT NULL,
        "dueDate" date,
        "status" "athlete_charge_status" NOT NULL DEFAULT 'pending',
        "notes" character varying(500),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_athlete_charges" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_athlete_charges_tenant_athlete" ON "athlete_charges" ("tenantId", "athleteId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_athlete_charges_tenant_status" ON "athlete_charges" ("tenantId", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_athlete_charges_tenant_due" ON "athlete_charges" ("tenantId", "dueDate")`,
    );
    await queryRunner.query(`
      ALTER TABLE "athlete_charges"
      ADD CONSTRAINT "FK_athlete_charges_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "athlete_charges"
      ADD CONSTRAINT "FK_athlete_charges_athlete" FOREIGN KEY ("athleteId") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "athlete_charges"
      ADD CONSTRAINT "FK_athlete_charges_item" FOREIGN KEY ("chargeItemId") REFERENCES "charge_items"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "athlete_charges" DROP CONSTRAINT "FK_athlete_charges_item"`);
    await queryRunner.query(`ALTER TABLE "athlete_charges" DROP CONSTRAINT "FK_athlete_charges_athlete"`);
    await queryRunner.query(`ALTER TABLE "athlete_charges" DROP CONSTRAINT "FK_athlete_charges_tenant"`);
    await queryRunner.query(`DROP TABLE "athlete_charges"`);

    await queryRunner.query(`ALTER TABLE "charge_items" DROP CONSTRAINT "FK_charge_items_tenant"`);
    await queryRunner.query(`DROP TABLE "charge_items"`);

    await queryRunner.query(`ALTER TABLE "attendances" DROP CONSTRAINT "FK_attendances_athlete"`);
    await queryRunner.query(`ALTER TABLE "attendances" DROP CONSTRAINT "FK_attendances_session"`);
    await queryRunner.query(`ALTER TABLE "attendances" DROP CONSTRAINT "FK_attendances_tenant"`);
    await queryRunner.query(`DROP TABLE "attendances"`);

    await queryRunner.query(`ALTER TABLE "training_sessions" DROP CONSTRAINT "FK_training_sessions_team"`);
    await queryRunner.query(`ALTER TABLE "training_sessions" DROP CONSTRAINT "FK_training_sessions_group"`);
    await queryRunner.query(`ALTER TABLE "training_sessions" DROP CONSTRAINT "FK_training_sessions_branch"`);
    await queryRunner.query(`ALTER TABLE "training_sessions" DROP CONSTRAINT "FK_training_sessions_tenant"`);
    await queryRunner.query(`DROP TABLE "training_sessions"`);

    await queryRunner.query(`ALTER TABLE "athlete_team_memberships" DROP CONSTRAINT "FK_atm_team"`);
    await queryRunner.query(`ALTER TABLE "athlete_team_memberships" DROP CONSTRAINT "FK_atm_athlete"`);
    await queryRunner.query(`ALTER TABLE "athlete_team_memberships" DROP CONSTRAINT "FK_atm_tenant"`);
    await queryRunner.query(`DROP TABLE "athlete_team_memberships"`);

    await queryRunner.query(`ALTER TABLE "athlete_guardians" DROP CONSTRAINT "FK_athlete_guardians_guardian"`);
    await queryRunner.query(`ALTER TABLE "athlete_guardians" DROP CONSTRAINT "FK_athlete_guardians_athlete"`);
    await queryRunner.query(`ALTER TABLE "athlete_guardians" DROP CONSTRAINT "FK_athlete_guardians_tenant"`);
    await queryRunner.query(`DROP TABLE "athlete_guardians"`);

    await queryRunner.query(`ALTER TABLE "guardians" DROP CONSTRAINT "FK_guardians_tenant"`);
    await queryRunner.query(`DROP TABLE "guardians"`);

    await queryRunner.query(`ALTER TABLE "athletes" DROP CONSTRAINT "FK_athletes_primary_group"`);
    await queryRunner.query(`ALTER TABLE "athletes" DROP CONSTRAINT "FK_athletes_sport_branch"`);
    await queryRunner.query(`ALTER TABLE "athletes" DROP CONSTRAINT "FK_athletes_tenant"`);
    await queryRunner.query(`DROP TABLE "athletes"`);

    await queryRunner.query(`DROP TYPE "athlete_charge_status"`);
    await queryRunner.query(`DROP TYPE "attendance_status"`);
    await queryRunner.query(`DROP TYPE "training_session_status"`);
    await queryRunner.query(`DROP TYPE "athlete_status"`);
  }
}
