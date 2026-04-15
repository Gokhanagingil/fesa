import { MigrationInterface, QueryRunner } from 'typeorm';

export class Wave4CoachingLessonsCommunicationOps1744732800000 implements MigrationInterface {
  name = 'Wave4CoachingLessonsCommunicationOps1744732800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "coaches" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "sportBranchId" uuid NOT NULL,
        "firstName" character varying(120) NOT NULL,
        "lastName" character varying(120) NOT NULL,
        "preferredName" character varying(160),
        "phone" character varying(32),
        "email" character varying(320),
        "specialties" character varying(200),
        "isActive" boolean NOT NULL DEFAULT true,
        "notes" character varying(500),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_coaches" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_coaches_tenant_active" ON "coaches" ("tenantId", "isActive")`);
    await queryRunner.query(`CREATE INDEX "IDX_coaches_tenant_branch" ON "coaches" ("tenantId", "sportBranchId")`);
    await queryRunner.query(`
      ALTER TABLE "coaches"
      ADD CONSTRAINT "FK_coaches_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "coaches"
      ADD CONSTRAINT "FK_coaches_branch" FOREIGN KEY ("sportBranchId") REFERENCES "sport_branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`ALTER TABLE "club_groups" ADD "headCoachId" uuid`);
    await queryRunner.query(`CREATE INDEX "IDX_club_groups_head_coach" ON "club_groups" ("headCoachId")`);
    await queryRunner.query(`
      ALTER TABLE "club_groups"
      ADD CONSTRAINT "FK_club_groups_head_coach" FOREIGN KEY ("headCoachId") REFERENCES "coaches"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`ALTER TABLE "teams" ADD "headCoachId" uuid`);
    await queryRunner.query(`CREATE INDEX "IDX_teams_head_coach" ON "teams" ("headCoachId")`);
    await queryRunner.query(`
      ALTER TABLE "teams"
      ADD CONSTRAINT "FK_teams_head_coach" FOREIGN KEY ("headCoachId") REFERENCES "coaches"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`ALTER TABLE "training_session_series" ADD "coachId" uuid`);
    await queryRunner.query(
      `CREATE INDEX "IDX_training_session_series_tenant_coach" ON "training_session_series" ("tenantId", "coachId")`,
    );
    await queryRunner.query(`
      ALTER TABLE "training_session_series"
      ADD CONSTRAINT "FK_training_session_series_coach" FOREIGN KEY ("coachId") REFERENCES "coaches"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`ALTER TABLE "training_sessions" ADD "coachId" uuid`);
    await queryRunner.query(`CREATE INDEX "IDX_training_sessions_tenant_coach" ON "training_sessions" ("tenantId", "coachId")`);
    await queryRunner.query(`
      ALTER TABLE "training_sessions"
      ADD CONSTRAINT "FK_training_sessions_coach" FOREIGN KEY ("coachId") REFERENCES "coaches"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE TABLE "private_lessons" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "athleteId" uuid NOT NULL,
        "coachId" uuid NOT NULL,
        "sportBranchId" uuid NOT NULL,
        "focus" character varying(200),
        "scheduledStart" TIMESTAMPTZ NOT NULL,
        "scheduledEnd" TIMESTAMPTZ NOT NULL,
        "location" character varying(200),
        "status" "training_session_status" NOT NULL DEFAULT 'planned',
        "attendanceStatus" "attendance_status",
        "notes" character varying(1000),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_private_lessons" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_private_lessons_tenant_scheduled_start" ON "private_lessons" ("tenantId", "scheduledStart")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_private_lessons_tenant_athlete" ON "private_lessons" ("tenantId", "athleteId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_private_lessons_tenant_coach" ON "private_lessons" ("tenantId", "coachId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_private_lessons_tenant_status" ON "private_lessons" ("tenantId", "status")`,
    );
    await queryRunner.query(`
      ALTER TABLE "private_lessons"
      ADD CONSTRAINT "FK_private_lessons_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "private_lessons"
      ADD CONSTRAINT "FK_private_lessons_athlete" FOREIGN KEY ("athleteId") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "private_lessons"
      ADD CONSTRAINT "FK_private_lessons_coach" FOREIGN KEY ("coachId") REFERENCES "coaches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
    `);
    await queryRunner.query(`
      ALTER TABLE "private_lessons"
      ADD CONSTRAINT "FK_private_lessons_branch" FOREIGN KEY ("sportBranchId") REFERENCES "sport_branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`ALTER TABLE "athlete_charges" ADD "privateLessonId" uuid`);
    await queryRunner.query(
      `CREATE INDEX "IDX_athlete_charges_tenant_private_lesson" ON "athlete_charges" ("tenantId", "privateLessonId")`,
    );
    await queryRunner.query(`
      ALTER TABLE "athlete_charges"
      ADD CONSTRAINT "FK_athlete_charges_private_lesson" FOREIGN KEY ("privateLessonId") REFERENCES "private_lessons"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "athlete_charges" DROP CONSTRAINT "FK_athlete_charges_private_lesson"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_athlete_charges_tenant_private_lesson"`);
    await queryRunner.query(`ALTER TABLE "athlete_charges" DROP COLUMN "privateLessonId"`);

    await queryRunner.query(`ALTER TABLE "private_lessons" DROP CONSTRAINT "FK_private_lessons_branch"`);
    await queryRunner.query(`ALTER TABLE "private_lessons" DROP CONSTRAINT "FK_private_lessons_coach"`);
    await queryRunner.query(`ALTER TABLE "private_lessons" DROP CONSTRAINT "FK_private_lessons_athlete"`);
    await queryRunner.query(`ALTER TABLE "private_lessons" DROP CONSTRAINT "FK_private_lessons_tenant"`);
    await queryRunner.query(`DROP TABLE "private_lessons"`);

    await queryRunner.query(`ALTER TABLE "training_sessions" DROP CONSTRAINT "FK_training_sessions_coach"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_training_sessions_tenant_coach"`);
    await queryRunner.query(`ALTER TABLE "training_sessions" DROP COLUMN "coachId"`);

    await queryRunner.query(`ALTER TABLE "training_session_series" DROP CONSTRAINT "FK_training_session_series_coach"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_training_session_series_tenant_coach"`);
    await queryRunner.query(`ALTER TABLE "training_session_series" DROP COLUMN "coachId"`);

    await queryRunner.query(`ALTER TABLE "teams" DROP CONSTRAINT "FK_teams_head_coach"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_teams_head_coach"`);
    await queryRunner.query(`ALTER TABLE "teams" DROP COLUMN "headCoachId"`);

    await queryRunner.query(`ALTER TABLE "club_groups" DROP CONSTRAINT "FK_club_groups_head_coach"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_club_groups_head_coach"`);
    await queryRunner.query(`ALTER TABLE "club_groups" DROP COLUMN "headCoachId"`);

    await queryRunner.query(`ALTER TABLE "coaches" DROP CONSTRAINT "FK_coaches_branch"`);
    await queryRunner.query(`ALTER TABLE "coaches" DROP CONSTRAINT "FK_coaches_tenant"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_coaches_tenant_branch"`);
    await queryRunner.query(`DROP TABLE "coaches"`);
  }
}
