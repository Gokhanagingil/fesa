import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { Guardian } from './guardian.entity';
import { GuardianPortalSession } from './guardian-portal-session.entity';

@Entity('guardian_portal_accesses')
@Unique(['tenantId', 'guardianId'])
@Index(['tenantId', 'email'])
@Index(['tenantId', 'status'])
export class GuardianPortalAccess {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @Column({ type: 'uuid' })
  guardianId!: string;

  @ManyToOne(() => Guardian, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guardianId' })
  guardian!: Guardian;

  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({ type: 'varchar', length: 32, default: 'invited' })
  status!: 'invited' | 'active' | 'disabled';

  @Column({ type: 'varchar', length: 128, nullable: true })
  passwordHash!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  passwordSalt!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  inviteTokenHash!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  inviteTokenExpiresAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  invitedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  activatedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  disabledAt!: Date | null;

  /**
   * Parent Portal v1.2 — recovery UX.
   *
   * When a guardian opens the public "I lost access" form, the portal
   * does not leak whether their email is on file (the response is calm
   * and identical for both cases). Instead it stamps these fields on
   * the matching access row so club staff can see, from the existing
   * Guardians → portal access surface, that this family has asked for
   * help and how recently / how often. The actual reset still happens
   * through the staff resend-invite flow, which keeps recovery safely
   * inside the club's control.
   */
  @Column({ type: 'timestamptz', nullable: true })
  recoveryRequestedAt!: Date | null;

  @Column({ type: 'integer', default: 0 })
  recoveryRequestCount!: number;

  /**
   * Parent Invite Delivery & Access Reliability Pack — truthful invite
   * delivery state.
   *
   * The invite flow used to silently create a token + access row and
   * leave the staff to assume "an email went out". That was a trust
   * gap: when no SMTP provider was configured, no email was ever
   * actually delivered, but the UI implied otherwise. We now persist
   * the honest outcome of every invite attempt:
   *
   *   - `pending`         — token created but no delivery attempted yet.
   *   - `sent`            — email provider accepted the message for
   *                         delivery (the strongest claim we can make
   *                         without bounce tracking).
   *   - `failed`          — provider attempted but rejected / errored.
   *   - `shared_manually` — staff explicitly used the manual fallback
   *                         (copied / shared the activation link
   *                         themselves and stamped the row).
   *   - `unavailable`     — no provider was configured at attempt
   *                         time; the activation link is ready for
   *                         the manual fallback.
   */
  @Column({ type: 'varchar', length: 32, nullable: true })
  inviteDeliveryState!:
    | 'pending'
    | 'sent'
    | 'failed'
    | 'shared_manually'
    | 'unavailable'
    | null;

  /** Provider key that produced `inviteDeliveryState` (e.g. `smtp`, `manual`). */
  @Column({ type: 'varchar', length: 64, nullable: true })
  inviteDeliveryProvider!: string | null;

  /** Operator-friendly short note ("smtp_not_configured", "550 mailbox unavailable"). */
  @Column({ type: 'varchar', length: 500, nullable: true })
  inviteDeliveryDetail!: string | null;

  /** When the delivery attempt started. */
  @Column({ type: 'timestamptz', nullable: true })
  inviteDeliveryAttemptedAt!: Date | null;

  /** When the provider accepted the message (only stamped on `sent`). */
  @Column({ type: 'timestamptz', nullable: true })
  inviteDeliveredAt!: Date | null;

  /** When staff explicitly marked the link as shared manually. */
  @Column({ type: 'timestamptz', nullable: true })
  inviteSharedAt!: Date | null;

  /** How many times the invite has been (re)issued for this row. */
  @Column({ type: 'integer', default: 0 })
  inviteAttemptCount!: number;

  @OneToMany(() => GuardianPortalSession, (session) => session.access)
  sessions?: GuardianPortalSession[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
