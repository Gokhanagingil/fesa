import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Wave 11 - Executive Demo & Reporting Foundation Pack v1.
 *
 * - adds Athlete.shirtSize for richer reportability
 * - upgrades saved_filter_presets to also persist Reporting v1 saved views
 *   (entity/columns/sort/filterTree/visibility/ownerStaffUserId/description),
 *   alongside the existing communications presets that use the legacy `payload` column.
 */
export class Wave11ReportingFoundation1745700000000 implements MigrationInterface {
  name = 'Wave11ReportingFoundation1745700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "athletes"
      ADD COLUMN IF NOT EXISTS "shirtSize" varchar(16)
    `);

    await queryRunner.query(`
      ALTER TABLE "saved_filter_presets"
      ADD COLUMN IF NOT EXISTS "entity" varchar(64)
    `);
    await queryRunner.query(`
      ALTER TABLE "saved_filter_presets"
      ADD COLUMN IF NOT EXISTS "description" varchar(500)
    `);
    await queryRunner.query(`
      ALTER TABLE "saved_filter_presets"
      ADD COLUMN IF NOT EXISTS "filterTree" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "saved_filter_presets"
      ADD COLUMN IF NOT EXISTS "columns" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "saved_filter_presets"
      ADD COLUMN IF NOT EXISTS "sort" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "saved_filter_presets"
      ADD COLUMN IF NOT EXISTS "visibility" varchar(16) NOT NULL DEFAULT 'private'
    `);
    await queryRunner.query(`
      ALTER TABLE "saved_filter_presets"
      ADD COLUMN IF NOT EXISTS "ownerStaffUserId" uuid
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_saved_filter_presets_tenant_surface"
      ON "saved_filter_presets" ("tenantId", "surface")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_saved_filter_presets_tenant_entity"
      ON "saved_filter_presets" ("tenantId", "entity")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'saved_filter_presets'
            AND constraint_name = 'FK_saved_filter_presets_owner_staff_user'
        ) THEN
          ALTER TABLE "saved_filter_presets"
          ADD CONSTRAINT "FK_saved_filter_presets_owner_staff_user"
          FOREIGN KEY ("ownerStaffUserId") REFERENCES "staff_users"("id") ON DELETE SET NULL;
        END IF;
      END$$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "saved_filter_presets" DROP CONSTRAINT IF EXISTS "FK_saved_filter_presets_owner_staff_user"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_saved_filter_presets_tenant_entity"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_saved_filter_presets_tenant_surface"`);
    await queryRunner.query(`ALTER TABLE "saved_filter_presets" DROP COLUMN IF EXISTS "ownerStaffUserId"`);
    await queryRunner.query(`ALTER TABLE "saved_filter_presets" DROP COLUMN IF EXISTS "visibility"`);
    await queryRunner.query(`ALTER TABLE "saved_filter_presets" DROP COLUMN IF EXISTS "sort"`);
    await queryRunner.query(`ALTER TABLE "saved_filter_presets" DROP COLUMN IF EXISTS "columns"`);
    await queryRunner.query(`ALTER TABLE "saved_filter_presets" DROP COLUMN IF EXISTS "filterTree"`);
    await queryRunner.query(`ALTER TABLE "saved_filter_presets" DROP COLUMN IF EXISTS "description"`);
    await queryRunner.query(`ALTER TABLE "saved_filter_presets" DROP COLUMN IF EXISTS "entity"`);
    await queryRunner.query(`ALTER TABLE "athletes" DROP COLUMN IF EXISTS "shirtSize"`);
  }
}
