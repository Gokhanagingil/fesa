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
import { Tenant } from './tenant.entity';
import { StaffUser } from './staff-user.entity';

/**
 * OutreachActivity
 * ----------------
 * A lightweight follow-up log entry for the Communication & Follow-up surface.
 *
 * v1 keeps this intentionally small:
 *   - the platform does NOT send WhatsApp/email itself; outreach is
 *     "assisted" (operators open WhatsApp, copy a message, etc.)
 *   - this row records the *intent* and basic context so the team can
 *     see what was prepared, by whom, and from where.
 *
 * The same table is reused for both single-recipient and batch follow-ups
 * by storing the recipient guardian/athlete snapshot in JSON on the row.
 */
@Entity('outreach_activities')
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'channel'])
export class OutreachActivity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  /** whatsapp | phone | email | manual */
  @Column({ type: 'varchar', length: 32 })
  channel!: string;

  /** Source surface that produced this outreach (eg. action_center, report, manual). */
  @Column({ type: 'varchar', length: 64 })
  sourceSurface!: string;

  /** Optional source key for richer attribution (eg. starter view id, report key). */
  @Column({ type: 'varchar', length: 128, nullable: true })
  sourceKey!: string | null;

  /** Optional template used for this outreach. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  templateKey!: string | null;

  /** Short human-readable subject/intent (eg. "Overdue payment reminder"). */
  @Column({ type: 'varchar', length: 200 })
  topic!: string;

  /** The drafted message body that was prepared. */
  @Column({ type: 'text', nullable: true })
  messagePreview!: string | null;

  /** Number of recipients prepared in this batch (athletes). */
  @Column({ type: 'int', default: 0 })
  recipientCount!: number;

  /** Number of guardians actually reachable (with phone or email) in this batch. */
  @Column({ type: 'int', default: 0 })
  reachableGuardianCount!: number;

  /**
   * Snapshot of recipient context (athletes + guardians) for audit/recap.
   * Kept compact: { athleteIds: string[], guardianIds: string[], audienceSummary: {...} }.
   */
  @Column({ type: 'jsonb', default: {} })
  audienceSnapshot!: Record<string, unknown>;

  /** Optional free-form note from the operator. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  note!: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdByStaffUserId!: string | null;

  @ManyToOne(() => StaffUser, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdByStaffUserId' })
  createdByStaffUser!: StaffUser | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
