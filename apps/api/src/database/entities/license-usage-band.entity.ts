import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Billing & Licensing Foundation v1 — Usage Band (config-driven).
 *
 * A "usage band" is the active-athlete bracket that the platform uses
 * to evaluate whether a tenant's actual footprint matches their
 * licensed footprint. Bands are stored in the database (not hardcoded)
 * so platform admins can tune them without a code change, and so
 * future add-ons (e.g. a per-branch sub-band) can extend the schema
 * without rewriting the engine.
 *
 * Each band has:
 *   - a stable `code` (e.g. `band_starter`),
 *   - a display label,
 *   - a closed-open athlete-count range `[minAthletes, maxAthletes)`;
 *     `maxAthletes = null` means "unbounded upper end",
 *   - a `displayOrder` for stable presentation.
 *
 * The engine evaluates exactly one band per tenant per snapshot. The
 * band tells the platform "where does this tenant sit right now?" — it
 * does NOT directly cap functionality. Capping is the entitlement
 * engine's job.
 */
@Entity('license_usage_bands')
@Index(['code'], { unique: true })
@Index(['displayOrder'])
export class LicenseUsageBand {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  code!: string;

  @Column({ type: 'varchar', length: 120 })
  label!: string;

  @Column({ type: 'integer' })
  minAthletes!: number;

  @Column({ type: 'integer', nullable: true })
  maxAthletes!: number | null;

  @Column({ type: 'integer', default: 0 })
  displayOrder!: number;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
