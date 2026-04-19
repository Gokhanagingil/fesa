import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Wave 14 — Inventory & Assignment Pack v1.
 *
 * Introduces a focused, club-friendly inventory capability:
 *   - inventory_items                (catalogue entries)
 *   - inventory_variants             (size / number / colour, plus stock)
 *   - inventory_assignments          (athlete <-> variant, returnable)
 *   - inventory_movements            (lightweight audit trail)
 *
 * Designed to stay simple on purpose: no warehouse hierarchy, no per-unit
 * serial numbers, no procurement workflow. Stock math is recomputed on
 * write so the columns stay trustworthy for low-stock signals.
 */
export class Wave14InventoryAssignmentPack1746000000000 implements MigrationInterface {
  name = 'Wave14InventoryAssignmentPack1746000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_category') THEN
          CREATE TYPE "inventory_category" AS ENUM ('apparel', 'balls', 'equipment', 'gear', 'other');
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_movement_type') THEN
          CREATE TYPE "inventory_movement_type" AS ENUM (
            'stock_added', 'stock_removed', 'stock_adjusted',
            'assigned', 'returned', 'retired'
          );
        END IF;
      END$$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "inventory_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "name" varchar(200) NOT NULL,
        "category" "inventory_category" NOT NULL DEFAULT 'equipment',
        "sportBranchId" uuid,
        "hasVariants" boolean NOT NULL DEFAULT false,
        "trackAssignment" boolean NOT NULL DEFAULT false,
        "lowStockThreshold" int NOT NULL DEFAULT 0,
        "description" varchar(500),
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_inventory_items_tenant" FOREIGN KEY ("tenantId")
          REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_inventory_items_sport_branch" FOREIGN KEY ("sportBranchId")
          REFERENCES "sport_branches"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inventory_items_tenant_active"
      ON "inventory_items" ("tenantId", "isActive")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inventory_items_tenant_category"
      ON "inventory_items" ("tenantId", "category")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inventory_items_tenant_branch"
      ON "inventory_items" ("tenantId", "sportBranchId")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "inventory_variants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "inventoryItemId" uuid NOT NULL,
        "size" varchar(32),
        "number" varchar(16),
        "color" varchar(32),
        "isDefault" boolean NOT NULL DEFAULT false,
        "stockOnHand" int NOT NULL DEFAULT 0,
        "assignedCount" int NOT NULL DEFAULT 0,
        "lowStockThreshold" int,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_inventory_variants_tenant" FOREIGN KEY ("tenantId")
          REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_inventory_variants_item" FOREIGN KEY ("inventoryItemId")
          REFERENCES "inventory_items"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inventory_variants_item"
      ON "inventory_variants" ("tenantId", "inventoryItemId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inventory_variants_active"
      ON "inventory_variants" ("tenantId", "isActive")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "inventory_assignments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "inventoryItemId" uuid NOT NULL,
        "inventoryVariantId" uuid NOT NULL,
        "athleteId" uuid NOT NULL,
        "quantity" int NOT NULL DEFAULT 1,
        "assignedAt" timestamptz NOT NULL DEFAULT now(),
        "returnedAt" timestamptz,
        "notes" varchar(500),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_inventory_assignments_tenant" FOREIGN KEY ("tenantId")
          REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_inventory_assignments_item" FOREIGN KEY ("inventoryItemId")
          REFERENCES "inventory_items"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_inventory_assignments_variant" FOREIGN KEY ("inventoryVariantId")
          REFERENCES "inventory_variants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_inventory_assignments_athlete" FOREIGN KEY ("athleteId")
          REFERENCES "athletes"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inventory_assignments_athlete"
      ON "inventory_assignments" ("tenantId", "athleteId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inventory_assignments_variant"
      ON "inventory_assignments" ("tenantId", "inventoryVariantId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inventory_assignments_returned"
      ON "inventory_assignments" ("tenantId", "returnedAt")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "inventory_movements" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "inventoryItemId" uuid NOT NULL,
        "inventoryVariantId" uuid NOT NULL,
        "type" "inventory_movement_type" NOT NULL,
        "quantity" int NOT NULL,
        "athleteId" uuid,
        "note" varchar(500),
        "createdByStaffUserId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_inventory_movements_tenant" FOREIGN KEY ("tenantId")
          REFERENCES "tenants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_inventory_movements_item" FOREIGN KEY ("inventoryItemId")
          REFERENCES "inventory_items"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_inventory_movements_variant" FOREIGN KEY ("inventoryVariantId")
          REFERENCES "inventory_variants"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_inventory_movements_athlete" FOREIGN KEY ("athleteId")
          REFERENCES "athletes"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inventory_movements_item"
      ON "inventory_movements" ("tenantId", "inventoryItemId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inventory_movements_variant"
      ON "inventory_movements" ("tenantId", "inventoryVariantId")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inventory_movements_created"
      ON "inventory_movements" ("tenantId", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_inventory_movements_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_inventory_movements_variant"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_inventory_movements_item"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_movements"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_inventory_assignments_returned"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_inventory_assignments_variant"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_inventory_assignments_athlete"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_assignments"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_inventory_variants_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_inventory_variants_item"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_variants"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_inventory_items_tenant_branch"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_inventory_items_tenant_category"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_inventory_items_tenant_active"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_items"`);

    await queryRunner.query(`DROP TYPE IF EXISTS "inventory_movement_type"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "inventory_category"`);
  }
}
