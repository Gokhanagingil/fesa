import { MigrationInterface, QueryRunner } from 'typeorm';

export class Wave4StabilizationMembershipCollections1744822800000 implements MigrationInterface {
  name = 'Wave4StabilizationMembershipCollections1744822800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "athlete_status" ADD VALUE IF NOT EXISTS 'paused'`);

    await queryRunner.query(`ALTER TABLE "athlete_charges" ADD "billingPeriodKey" character varying(32)`);
    await queryRunner.query(`ALTER TABLE "athlete_charges" ADD "billingPeriodLabel" character varying(120)`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_athlete_charges_period_unique"
      ON "athlete_charges" ("tenantId", "athleteId", "chargeItemId", "billingPeriodKey")
      WHERE "billingPeriodKey" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_athlete_charges_period_unique"`);
    await queryRunner.query(`ALTER TABLE "athlete_charges" DROP COLUMN "billingPeriodLabel"`);
    await queryRunner.query(`ALTER TABLE "athlete_charges" DROP COLUMN "billingPeriodKey"`);

    await queryRunner.query(`UPDATE "athletes" SET "status" = 'inactive' WHERE "status" = 'paused'`);
    await queryRunner.query(`ALTER TYPE "athlete_status" RENAME TO "athlete_status_old"`);
    await queryRunner.query(`CREATE TYPE "athlete_status" AS ENUM('active', 'inactive', 'trial', 'archived')`);
    await queryRunner.query(`
      ALTER TABLE "athletes"
      ALTER COLUMN "status" TYPE "athlete_status"
      USING "status"::text::"athlete_status"
    `);
    await queryRunner.query(`DROP TYPE "athlete_status_old"`);
  }
}
