import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Core tenant and catalog tables required before wave-two operational tables.
 * Wave two migrations reference `tenants`, `sport_branches`, and `club_groups`.
 */
export class Wave1TenantCatalogFoundation1744500000000 implements MigrationInterface {
  name = 'Wave1TenantCatalogFoundation1744500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tenants" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(160) NOT NULL,
        "slug" character varying(64) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tenants" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tenants_slug" UNIQUE ("slug")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "sport_branches" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "code" character varying(48) NOT NULL,
        "name" character varying(160) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sport_branches" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sport_branches_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_sport_branches_tenant" ON "sport_branches" ("tenantId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "age_groups" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "label" character varying(64) NOT NULL,
        "birthYearFrom" integer,
        "birthYearTo" integer,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_age_groups" PRIMARY KEY ("id"),
        CONSTRAINT "FK_age_groups_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_age_groups_tenant" ON "age_groups" ("tenantId")`);

    await queryRunner.query(`
      CREATE TABLE "club_groups" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "sportBranchId" uuid NOT NULL,
        "ageGroupId" uuid,
        "name" character varying(200) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_club_groups" PRIMARY KEY ("id"),
        CONSTRAINT "FK_club_groups_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_club_groups_branch" FOREIGN KEY ("sportBranchId") REFERENCES "sport_branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_club_groups_age_group" FOREIGN KEY ("ageGroupId") REFERENCES "age_groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_club_groups_tenant_branch" ON "club_groups" ("tenantId", "sportBranchId")`,
    );

    await queryRunner.query(`
      CREATE TABLE "teams" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "sportBranchId" uuid NOT NULL,
        "groupId" uuid,
        "name" character varying(200) NOT NULL,
        "code" character varying(32),
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_teams" PRIMARY KEY ("id"),
        CONSTRAINT "FK_teams_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_teams_branch" FOREIGN KEY ("sportBranchId") REFERENCES "sport_branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_teams_group" FOREIGN KEY ("groupId") REFERENCES "club_groups"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_teams_tenant_branch" ON "teams" ("tenantId", "sportBranchId")`);
    await queryRunner.query(`CREATE INDEX "IDX_teams_tenant_group" ON "teams" ("tenantId", "groupId")`);

    await queryRunner.query(`
      CREATE TABLE "report_definitions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "key" character varying(64) NOT NULL,
        "titleKey" character varying(128) NOT NULL,
        "domains" jsonb NOT NULL DEFAULT '[]',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_report_definitions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_report_definitions_key" UNIQUE ("key")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "saved_filter_presets" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenantId" uuid NOT NULL,
        "name" character varying(200) NOT NULL,
        "surface" character varying(64) NOT NULL,
        "payload" jsonb NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_saved_filter_presets" PRIMARY KEY ("id"),
        CONSTRAINT "FK_saved_filter_presets_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_saved_filter_presets_tenant" ON "saved_filter_presets" ("tenantId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "saved_filter_presets"`);
    await queryRunner.query(`DROP TABLE "report_definitions"`);
    await queryRunner.query(`DROP TABLE "teams"`);
    await queryRunner.query(`DROP TABLE "club_groups"`);
    await queryRunner.query(`DROP TABLE "age_groups"`);
    await queryRunner.query(`DROP TABLE "sport_branches"`);
    await queryRunner.query(`DROP TABLE "tenants"`);
  }
}
