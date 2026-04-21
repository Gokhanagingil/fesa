import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LicensePlanEntitlement } from './license-plan-entitlement.entity';

/**
 * Billing & Licensing Foundation v1 — License Plan.
 *
 * A "plan" is a first-class commercial offering ("Starter", "Operations",
 * "Growth"). Plans are intentionally small: a stable code, a display
 * name, a description, an `isActive` flag (so a plan can be retired
 * without deleting historical subscriptions), and a display order so
 * the platform-admin UI shows them in a stable hierarchy.
 *
 * Plans are NOT priced here. Price points belong to a future commercial
 * surface (price book, billing processor, etc.) that v1 deliberately
 * does not build. This keeps licensing a clean technical control plane
 * without dragging in invoicing or accounting concerns.
 */
@Entity('license_plans')
@Index(['code'], { unique: true })
@Index(['displayOrder'])
export class LicensePlan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Stable machine code: `starter`, `operations`, `growth`. */
  @Column({ type: 'varchar', length: 64 })
  code!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 400, nullable: true })
  description!: string | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'integer', default: 0 })
  displayOrder!: number;

  /**
   * If true, new tenants without an explicit assignment fall into trial
   * on this plan. Exactly one plan should carry this flag at any time;
   * the licensing service enforces a single default plan via runtime
   * validation, not via a unique index, so platform admins can swap it
   * without orphaning rows.
   */
  @Column({ type: 'boolean', default: false })
  isDefaultTrial!: boolean;

  @OneToMany(() => LicensePlanEntitlement, (entitlement) => entitlement.plan)
  entitlements?: LicensePlanEntitlement[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
