import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Wave 18 — Parent Portal v1.1 + Brand Admin v1.1.
 *
 * Two small, controlled additions on top of Wave 17:
 *
 *   1. Tenant-side logo asset columns so clubs that do not host their own
 *      logo can upload a small image through the staff branding surface.
 *      The free-form `brandLogoUrl` column from Wave 17 stays in place —
 *      these new columns describe an uploaded asset stored under the
 *      per-tenant media root.
 *
 *   2. A small `club_updates` table that backs the parent-facing club
 *      updates strip. Deliberately tiny: short cards, no rich text, no
 *      per-family targeting, no comments — see club-update.entity.ts for
 *      the design rationale.
 */
export class Wave18ParentPortalV11746400000000 implements MigrationInterface {
  name = 'Wave18ParentPortalV11746400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "brandLogoAssetFileName" varchar(200)
    `);
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "brandLogoAssetContentType" varchar(100)
    `);
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "brandLogoAssetSizeBytes" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "brandLogoAssetUploadedAt" timestamptz
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "club_updates" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "category" varchar(32) NOT NULL DEFAULT 'announcement',
        "status" varchar(32) NOT NULL DEFAULT 'draft',
        "title" varchar(140) NOT NULL,
        "body" varchar(600) NOT NULL,
        "linkUrl" varchar(512),
        "linkLabel" varchar(80),
        "publishedAt" timestamptz,
        "expiresAt" timestamptz,
        "pinnedUntil" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_club_updates" PRIMARY KEY ("id"),
        CONSTRAINT "FK_club_updates_tenant" FOREIGN KEY ("tenantId")
          REFERENCES "tenants" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_club_updates_tenantId_publishedAt"
      ON "club_updates" ("tenantId", "publishedAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_club_updates_tenantId_status"
      ON "club_updates" ("tenantId", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_club_updates_tenantId_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_club_updates_tenantId_publishedAt"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "club_updates"`);

    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "brandLogoAssetUploadedAt"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "brandLogoAssetSizeBytes"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "brandLogoAssetContentType"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "brandLogoAssetFileName"`);
  }
}
