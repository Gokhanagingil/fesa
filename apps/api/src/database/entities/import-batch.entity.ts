import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { StaffUser } from './staff-user.entity';

/**
 * Club Onboarding Wizard v1.1 — Go-Live Confidence Pack.
 *
 * `import_batches` is a deliberately small, server-side memory of "what was
 * brought in" for each onboarding-aligned import commit. It is NOT an event
 * sourcing log, NOT an audit ledger, NOT a rollback engine.
 *
 * Each row answers four calm questions:
 *   - Which onboarding step / entity?
 *   - When did it happen, and who triggered it?
 *   - How many rows were created / updated / skipped / rejected?
 *   - Did the batch finish cleanly, partially, or did it need attention?
 *
 * A small `summary` blob keeps a few human-readable hints from the import
 * (the source filename, top hint lines) so the wizard can surface
 * supportive history without re-running validation.
 *
 * Tenant isolation is enforced at the column level and re-asserted in the
 * service layer via `TenantGuard`.
 */
export type ImportBatchStatus = 'success' | 'partial' | 'needs_attention';

@Entity('import_batches')
@Index(['tenantId', 'createdAt'])
@Index(['tenantId', 'entity', 'createdAt'])
export class ImportBatch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  /**
   * The importable entity key (mirrors `IMPORT_ENTITY_KEYS`). Stored as a
   * short string so we can add new onboarding step types without enum
   * migrations.
   */
  @Column({ type: 'varchar', length: 64 })
  entity!: string;

  @Column({ type: 'varchar', length: 32, default: 'success' })
  status!: ImportBatchStatus;

  /** Optional friendly source label — typically the original filename. */
  @Column({ type: 'varchar', length: 240, nullable: true })
  source!: string | null;

  @Column({ type: 'integer', default: 0 })
  totalRows!: number;

  @Column({ type: 'integer', default: 0 })
  createdRows!: number;

  @Column({ type: 'integer', default: 0 })
  updatedRows!: number;

  @Column({ type: 'integer', default: 0 })
  skippedRows!: number;

  @Column({ type: 'integer', default: 0 })
  rejectedRows!: number;

  @Column({ type: 'integer', default: 0 })
  warningRows!: number;

  @Column({ type: 'integer', default: 0 })
  durationMs!: number;

  @Column({ type: 'uuid', nullable: true })
  triggeredByStaffUserId!: string | null;

  @ManyToOne(() => StaffUser, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'triggeredByStaffUserId' })
  triggeredByStaffUser!: StaffUser | null;

  /** Cached display name of the staff user, kept stable even if they leave. */
  @Column({ type: 'varchar', length: 240, nullable: true })
  triggeredByDisplayName!: string | null;

  /**
   * A tiny JSON blob with up to ~6 short hint lines. Kept as text so the
   * column stays portable across drivers and never grows into a free-form
   * ETL payload — see `ImportsService.recordBatch` for the shape.
   */
  @Column({ type: 'text', nullable: true })
  summary!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
