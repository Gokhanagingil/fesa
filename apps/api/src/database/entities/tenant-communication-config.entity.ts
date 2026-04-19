import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';

/**
 * TenantCommunicationConfig
 * -------------------------
 * Per-tenant readiness record for communication delivery providers.
 *
 * In Wave 15 (WhatsApp Integration Readiness / Cloud API Pack) the
 * platform does not send WhatsApp messages itself.  This entity exists
 * so that:
 *
 *   - clubs can declare *intent* to use direct WhatsApp Cloud API
 *     delivery in the future,
 *   - the readiness/UX layer can report `assisted_only`,
 *     `partial`, `direct_capable`, or `not_configured` honestly,
 *   - the secret material itself is NEVER stored on the row — the
 *     `whatsappAccessTokenRef` column only holds a *reference* (eg.
 *     `env:WHATSAPP_CLOUD_API_TOKEN` or a future secret-manager URI).
 *
 * The default state for every tenant is "no row" → `assisted_only`.
 */
@Entity('tenant_communication_configs')
@Index(['tenantId'], { unique: true })
export class TenantCommunicationConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @OneToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  /**
   * Operator-declared intent.  When false, even if other fields are
   * filled in, the readiness service treats the tenant as
   * `assisted_only` — clubs can pre-fill the form and only flip the
   * switch once they are sure.
   */
  @Column({ type: 'boolean', default: false })
  whatsappCloudApiEnabled!: boolean;

  /** WhatsApp Cloud API "phone_number_id" — required for direct send. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  whatsappPhoneNumberId!: string | null;

  /** WhatsApp Business Account ID — required for direct send. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  whatsappBusinessAccountId!: string | null;

  /**
   * Reference to the access token, NOT the token itself.
   *
   * In v1 of the readiness pack we accept opaque references like
   * `env:WHATSAPP_CLOUD_API_TOKEN` so deployments can plug in a single
   * shared token via the host env without building a per-tenant secret
   * manager.  A future iteration can swap the resolver for a real
   * secret store without touching the schema.
   */
  @Column({ type: 'varchar', length: 200, nullable: true })
  whatsappAccessTokenRef!: string | null;

  /**
   * Optional human-friendly display number ("+90 555 …").  Surfaced in
   * the UX so club admins can verify which line will deliver direct
   * messages.  Never used for routing — the phone_number_id is the
   * authoritative identifier.
   */
  @Column({ type: 'varchar', length: 32, nullable: true })
  whatsappDisplayPhoneNumber!: string | null;

  /**
   * Last validation outcome — `null` until the operator runs the
   * readiness check.  Stored as varchar so we can grow the vocabulary
   * without a migration.
   *
   * Allowed values: `ok` | `pending` | `invalid` | `never_validated`.
   */
  @Column({ type: 'varchar', length: 32, nullable: true })
  whatsappValidationState!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  whatsappValidationMessage!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  whatsappValidatedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
