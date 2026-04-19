import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Wave 17 — Parent Access & Portal Foundation + Tenant Branding Foundation v1.
 *
 * Adds a small, controlled branding surface to tenants so each club can
 * appear in the parent portal with its own logo, display name, primary /
 * accent colors, and a short welcome message — without giving clubs a free
 * design tool. Layout, typography, spacing, component structure, and
 * accessibility rules stay shared across all tenants and are NOT brandable
 * here on purpose.
 *
 * All columns are nullable so existing tenants keep rendering with the
 * default amateur palette until a club admin opts in to branding.
 */
export class Wave17ParentPortalTenantBranding1746300000000 implements MigrationInterface {
  name = 'Wave17ParentPortalTenantBranding1746300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "brandDisplayName" varchar(160)
    `);
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "brandTagline" varchar(200)
    `);
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "brandPrimaryColor" varchar(9)
    `);
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "brandAccentColor" varchar(9)
    `);
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "brandLogoUrl" varchar(512)
    `);
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "brandWelcomeTitle" varchar(160)
    `);
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "brandWelcomeMessage" varchar(400)
    `);
    await queryRunner.query(`
      ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "brandUpdatedAt" timestamptz
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "brandUpdatedAt"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "brandWelcomeMessage"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "brandWelcomeTitle"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "brandLogoUrl"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "brandAccentColor"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "brandPrimaryColor"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "brandTagline"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "brandDisplayName"`);
  }
}
