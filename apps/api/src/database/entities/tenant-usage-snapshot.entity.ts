import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { LicenseUsageBand } from './license-usage-band.entity';
import { Tenant } from './tenant.entity';

/**
 * Billing & Licensing Foundation v1 — Tenant Usage Snapshot.
 *
 * A snapshot captures "this tenant had N active athletes at moment X
 * and the engine evaluated band B at that moment". Snapshots are
 * append-only by design — they are observability, not state.
 *
 * Why snapshots:
 *   - the platform-admin console can show a stable history strip even
 *     when athletes shift between active/paused mid-month;
 *   - future reporting (e.g. "rolling 30-day band") only needs to read
 *     these rows, not re-traverse the live athlete table;
 *   - on-demand evaluation is also supported (the engine returns the
 *     same shape from a live count) so day-to-day reads do not require
 *     a snapshot to exist.
 *
 * Constraints we hold on purpose:
 *   - tenant-scoped at the column level (CASCADE on tenant delete);
 *   - `bandId` is nullable so the snapshot still survives if a band is
 *     retired (we keep the resolved `bandCode` as a stable label);
 *   - `source` is a tiny string ("manual", "scheduled", "api") so we
 *     can tell where the row came from later without inventing an
 *     enum migration.
 */
export type TenantUsageSnapshotSource = 'manual' | 'scheduled' | 'api';

@Entity('tenant_usage_snapshots')
@Index(['tenantId', 'measuredAt'])
export class TenantUsageSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @Column({ type: 'timestamptz' })
  measuredAt!: Date;

  @Column({ type: 'integer' })
  activeAthleteCount!: number;

  @Column({ type: 'uuid', nullable: true })
  bandId!: string | null;

  @ManyToOne(() => LicenseUsageBand, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'bandId' })
  band!: LicenseUsageBand | null;

  /** Cached band code so the snapshot is readable even if a band row is later retired. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  bandCode!: string | null;

  @Column({ type: 'varchar', length: 32, default: 'manual' })
  source!: TenantUsageSnapshotSource;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
