import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LicensePlan } from './license-plan.entity';
import { StaffUser } from './staff-user.entity';
import { Tenant } from './tenant.entity';
import type { TenantSubscriptionStatus } from './tenant-subscription.entity';

/**
 * Wave 23 — Billing & Licensing Operationalization Pack v1.
 *
 * Append-only commercial change ledger for `tenant_subscriptions`.
 *
 * Each row captures a single platform-admin lifecycle/plan change with
 * the actor, the before/after, and a small diff summary so the Billing
 * & Licensing console can show "who changed what, when" without
 * inventing a giant audit subsystem.
 *
 * Constraints we hold on purpose:
 *   - one row per change attempt (no compaction);
 *   - tenant scoped at the column level (CASCADE on tenant delete);
 *   - we keep the resolved plan name + code at the moment of change so
 *     the history stays readable even if a plan is later renamed;
 *   - actor is nullable (staff user may be retired) but we always store
 *     a label snapshot so the row stays human-readable.
 */
export type TenantSubscriptionHistoryChangeKind =
  | 'created'
  | 'plan_change'
  | 'status_change'
  | 'dates_change'
  | 'metadata_change';

@Entity('tenant_subscription_history')
@Index(['tenantId', 'changedAt'])
@Index(['changedAt'])
export class TenantSubscriptionHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @Column({ type: 'uuid', nullable: true })
  subscriptionId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  previousPlanId!: string | null;

  @ManyToOne(() => LicensePlan, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'previousPlanId' })
  previousPlan!: LicensePlan | null;

  @Column({ type: 'uuid', nullable: true })
  nextPlanId!: string | null;

  @ManyToOne(() => LicensePlan, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'nextPlanId' })
  nextPlan!: LicensePlan | null;

  /** Human readable plan label snapshot at the moment of change. */
  @Column({ type: 'varchar', length: 120, nullable: true })
  previousPlanCode!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  nextPlanCode!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  previousStatus!: TenantSubscriptionStatus | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  nextStatus!: TenantSubscriptionStatus | null;

  /** Coarse change kind — used to render iconography / grouping. */
  @Column({ type: 'varchar', length: 32 })
  changeKind!: TenantSubscriptionHistoryChangeKind;

  /**
   * Compact summary of which fields actually changed in this entry, so
   * the UI can render a calm chip list without re-diffing on the
   * client. Stored as JSON for forward extensibility.
   */
  @Column({ type: 'jsonb', nullable: true })
  changedFields!: string[] | null;

  @Column({ type: 'varchar', length: 240, nullable: true })
  statusReason!: string | null;

  @Column({ type: 'varchar', length: 240, nullable: true })
  internalNote!: string | null;

  @Column({ type: 'uuid', nullable: true })
  actorStaffUserId!: string | null;

  @ManyToOne(() => StaffUser, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actorStaffUserId' })
  actorStaffUser!: StaffUser | null;

  /** Cached actor label so the row stays readable if the staff user retires. */
  @Column({ type: 'varchar', length: 240, nullable: true })
  actorDisplayName!: string | null;

  @Column({ type: 'timestamptz' })
  changedAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
