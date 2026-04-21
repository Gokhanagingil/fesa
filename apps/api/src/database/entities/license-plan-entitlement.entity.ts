import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LicensePlan } from './license-plan.entity';

/**
 * Billing & Licensing Foundation v1 — Plan Entitlement.
 *
 * Each row maps a single canonical feature key (see
 * `LICENSE_FEATURE_KEYS` in the licensing module) to a single plan with
 * a boolean `enabled` flag and an optional numeric `limitValue` for
 * limits such as "max import batches per month" or "max staff seats".
 *
 * Constraints we hold on purpose:
 *   - one (planId, featureKey) row maximum (unique index);
 *   - feature keys live in code, not in this table — the table is the
 *     mapping, the catalog of valid keys lives next to the engine;
 *   - `limitValue` is nullable. `null` means "no numeric limit" (the
 *     boolean `enabled` is the answer); a positive integer means the
 *     ceiling for capability checks.
 */
@Entity('license_plan_entitlements')
@Index(['planId', 'featureKey'], { unique: true })
@Index(['featureKey'])
export class LicensePlanEntitlement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  planId!: string;

  @ManyToOne(() => LicensePlan, (plan) => plan.entitlements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'planId' })
  plan!: LicensePlan;

  @Column({ type: 'varchar', length: 96 })
  featureKey!: string;

  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  @Column({ type: 'integer', nullable: true })
  limitValue!: number | null;

  @Column({ type: 'varchar', length: 240, nullable: true })
  notes!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
