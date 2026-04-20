import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Wave 19 — Club Onboarding Wizard v1.1 (Go-Live Confidence Pack).
 *
 * Adds a single, deliberately small `import_batches` table so the wizard can
 * surface trustworthy server-side memory of "what was imported, when, by
 * whom, and how it landed" without growing into an audit-log stack.
 *
 * Tenant isolation:
 *   - `tenantId` is non-null and cascades on tenant delete.
 *   - All reads are gated by `TenantGuard` and asserted in service code.
 */
export class Wave19OnboardingGoLiveConfidence1746500000000 implements MigrationInterface {
  name = 'Wave19OnboardingGoLiveConfidence1746500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "import_batches" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "entity" varchar(64) NOT NULL,
        "status" varchar(32) NOT NULL DEFAULT 'success',
        "source" varchar(240),
        "totalRows" integer NOT NULL DEFAULT 0,
        "createdRows" integer NOT NULL DEFAULT 0,
        "updatedRows" integer NOT NULL DEFAULT 0,
        "skippedRows" integer NOT NULL DEFAULT 0,
        "rejectedRows" integer NOT NULL DEFAULT 0,
        "warningRows" integer NOT NULL DEFAULT 0,
        "durationMs" integer NOT NULL DEFAULT 0,
        "triggeredByStaffUserId" uuid,
        "triggeredByDisplayName" varchar(240),
        "summary" text,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_import_batches" PRIMARY KEY ("id"),
        CONSTRAINT "FK_import_batches_tenant" FOREIGN KEY ("tenantId")
          REFERENCES "tenants" ("id") ON DELETE CASCADE,
        CONSTRAINT "FK_import_batches_staff_user" FOREIGN KEY ("triggeredByStaffUserId")
          REFERENCES "staff_users" ("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_import_batches_tenantId_createdAt"
      ON "import_batches" ("tenantId", "createdAt")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_import_batches_tenantId_entity_createdAt"
      ON "import_batches" ("tenantId", "entity", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_import_batches_tenantId_entity_createdAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_import_batches_tenantId_createdAt"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "import_batches"`);
  }
}
