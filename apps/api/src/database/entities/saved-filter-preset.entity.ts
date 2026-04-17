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
 * Saved list/report filter preset.
 *
 * Two flavors share this table:
 *   1. legacy "communications" presets: `surface = 'communications'`, free-form payload.
 *   2. reporting v1 saved views: `surface = 'report:<entity>'` with `entity`, `columns`, `sort`,
 *      `filterTree`, `visibility`, and `ownerStaffUserId` populated.
 *
 * Reusing one table keeps persistence simple and avoids duplicate implementations of
 * "saved filter" semantics.
 */
@Entity('saved_filter_presets')
@Index(['tenantId', 'surface'])
@Index(['tenantId', 'entity'])
export class SavedFilterPreset {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  /** Target surface: communications | report:athletes | report:guardians | ... */
  @Column({ type: 'varchar', length: 64 })
  surface!: string;

  /** Logical reporting entity, populated for reporting v1 saved views. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  entity!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description!: string | null;

  /** Filter tree JSON (ReportFilterNode) or other surface-specific filter payload. */
  @Column({ type: 'jsonb', nullable: true })
  filterTree!: Record<string, unknown> | null;

  /** Selected column keys for reporting v1 explorers. */
  @Column({ type: 'jsonb', nullable: true })
  columns!: string[] | null;

  /** Sort clauses ([{field, direction}]) for reporting v1 explorers. */
  @Column({ type: 'jsonb', nullable: true })
  sort!: Array<{ field: string; direction: 'asc' | 'desc' }> | null;

  /** "private" (owner only) | "shared" (visible to all club staff). */
  @Column({ type: 'varchar', length: 16, default: 'private' })
  visibility!: 'private' | 'shared';

  /** Owner staff user; null for legacy/communications presets. */
  @Column({ type: 'uuid', nullable: true })
  ownerStaffUserId!: string | null;

  @ManyToOne(() => StaffUser, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'ownerStaffUserId' })
  ownerStaffUser!: StaffUser | null;

  /** Legacy free-form payload (communications surface). New surfaces should leave as default. */
  @Column({ type: 'jsonb', default: {} })
  payload!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
