import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Wave 16 — Athlete Photo & Media Foundation v1.
 *
 * Adds a small, focused profile-photo capability to athletes:
 *   - photoFileName       — relative filename inside the per-tenant media dir
 *   - photoContentType    — validated mime (jpeg/png/webp/gif)
 *   - photoSizeBytes      — for UI display + safety guards
 *   - photoUploadedAt     — drives cache busting and "last changed" copy
 *
 * Storage and tenant isolation live in the API layer — this migration is
 * purely the persistence boundary.  Replace/remove are destructive and
 * single-version on purpose: clubs need a trustworthy current photo, not a
 * media library or version history.
 *
 * Backfill: existing athletes simply have NULL photo columns (no photo).
 */
export class Wave16AthletePhotoMediaFoundation1746200000000 implements MigrationInterface {
  name = 'Wave16AthletePhotoMediaFoundation1746200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "athletes"
      ADD COLUMN IF NOT EXISTS "photoFileName" varchar(200)
    `);
    await queryRunner.query(`
      ALTER TABLE "athletes"
      ADD COLUMN IF NOT EXISTS "photoContentType" varchar(100)
    `);
    await queryRunner.query(`
      ALTER TABLE "athletes"
      ADD COLUMN IF NOT EXISTS "photoSizeBytes" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "athletes"
      ADD COLUMN IF NOT EXISTS "photoUploadedAt" timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "athletes" DROP COLUMN IF EXISTS "photoUploadedAt"`);
    await queryRunner.query(`ALTER TABLE "athletes" DROP COLUMN IF EXISTS "photoSizeBytes"`);
    await queryRunner.query(`ALTER TABLE "athletes" DROP COLUMN IF EXISTS "photoContentType"`);
    await queryRunner.query(`ALTER TABLE "athletes" DROP COLUMN IF EXISTS "photoFileName"`);
  }
}
