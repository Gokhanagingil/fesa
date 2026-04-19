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

  /**
   * Lifecycle status:
   *  - "draft"     — work in progress, kept for the operator to come back to
   *  - "logged"    — outreach intent recorded (the assisted "sent" state)
   *  - "archived"  — superseded or no longer relevant; hidden by default
   *
   * Stored as varchar (not a Postgres enum) so the lifecycle can grow
   * without a destructive migration.
   */
  @Column({ type: 'varchar', length: 16, default: 'logged' })
  status!: string;

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

  /**
   * Delivery mode — *how* this follow-up reached (or will reach) the
   * recipients.  Two honest options:
   *
   *  - `assisted` — the platform prepared a deep-link / copy block and
   *    a human opened WhatsApp (the v1.x default).
   *  - `direct`   — the platform itself attempted to send via a real
   *    provider (eg. WhatsApp Cloud API).
   *
   * Stored as varchar (not enum) so the model can grow without a
   * destructive migration.  Defaults to `assisted` to preserve the
   * existing meaning of every historical row.
   */
  @Column({ type: 'varchar', length: 16, default: 'assisted' })
  deliveryMode!: string;

  /**
   * Delivery state — the *outcome* of the most recent attempt.  Tiny
   * vocabulary on purpose:
   *
   *  - `prepared`   — assisted draft is ready (no real send happened).
   *  - `sent`       — direct send succeeded.
   *  - `failed`     — direct send was attempted and failed.
   *  - `fallback`   — direct send was attempted, failed, and the
   *    operator (or auto-fallback) used the assisted path instead.
   *
   * `prepared` is the default so historical rows continue to read as
   * "we prepared a follow-up", which is what they always meant.
   */
  @Column({ type: 'varchar', length: 16, default: 'prepared' })
  deliveryState!: string;

  /**
   * Provider key for direct-mode rows (eg. `whatsapp_cloud_api`).
   * Always null for assisted-mode rows so we never imply a provider
   * touched the message.
   */
  @Column({ type: 'varchar', length: 32, nullable: true })
  deliveryProvider!: string | null;

  /**
   * Provider-specific message reference (eg. WhatsApp message id).
   * Useful for later troubleshooting; never surfaced verbatim in the
   * main operator UX.
   */
  @Column({ type: 'varchar', length: 200, nullable: true })
  deliveryProviderMessageId!: string | null;

  /**
   * Operator-friendly summary of the most recent delivery attempt.
   * Short, calm, free-form ("All recipients delivered.", "Token
   * rejected — assisted fallback used.").  Never raw provider JSON.
   */
  @Column({ type: 'varchar', length: 500, nullable: true })
  deliveryDetail!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  deliveryAttemptedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deliveryCompletedAt!: Date | null;

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
