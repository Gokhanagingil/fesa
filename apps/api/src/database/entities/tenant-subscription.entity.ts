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
import { StaffUser } from './staff-user.entity';
import { Tenant } from './tenant.entity';

/**
 * Billing & Licensing Foundation v1 — Tenant Subscription / License.
 *
 * Each tenant has at most one active subscription. The subscription
 * pins the tenant to a plan and tracks the lifecycle (trial / active /
 * suspended / expired / cancelled). Lifecycle transitions are made by
 * platform admins through the Billing & Licensing console.
 *
 * Constraints we hold on purpose:
 *   - one row per tenant (unique index on `tenantId`);
 *   - dates are stored as `timestamptz` even when only the day
 *     matters, to keep the schema portable and time-zone-honest;
 *   - this row does NOT carry pricing, invoices, or seat counts.
 *     Those belong to a future commercial surface;
 *   - `onboardingServiceIncluded` is a small boolean seam so the
 *     console can surface "this tenant bought migration help" without
 *     inventing a separate add-ons model in v1.
 *   - actor columns (`assignedByStaffUserId`, `lastChangedByStaffUserId`)
 *     give us light traceability without growing into an audit log.
 */
export type TenantSubscriptionStatus =
  | 'trial'
  | 'active'
  | 'suspended'
  | 'expired'
  | 'cancelled';

@Entity('tenant_subscriptions')
@Index(['tenantId'], { unique: true })
@Index(['planId'])
@Index(['status'])
export class TenantSubscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @Column({ type: 'uuid' })
  planId!: string;

  @ManyToOne(() => LicensePlan, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'planId' })
  plan!: LicensePlan;

  @Column({ type: 'varchar', length: 32, default: 'trial' })
  status!: TenantSubscriptionStatus;

  @Column({ type: 'timestamptz', nullable: true })
  startDate!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  renewalDate!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  trialEndsAt!: Date | null;

  @Column({ type: 'boolean', default: false })
  onboardingServiceIncluded!: boolean;

  @Column({ type: 'varchar', length: 240, nullable: true })
  internalNotes!: string | null;

  @Column({ type: 'varchar', length: 240, nullable: true })
  statusReason!: string | null;

  @Column({ type: 'uuid', nullable: true })
  assignedByStaffUserId!: string | null;

  @ManyToOne(() => StaffUser, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assignedByStaffUserId' })
  assignedByStaffUser!: StaffUser | null;

  @Column({ type: 'uuid', nullable: true })
  lastChangedByStaffUserId!: string | null;

  @ManyToOne(() => StaffUser, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'lastChangedByStaffUserId' })
  lastChangedByStaffUser!: StaffUser | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
