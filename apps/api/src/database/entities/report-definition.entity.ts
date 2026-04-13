import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Registry row for first-class reports (versioning and i18n in later waves).
 */
@Entity('report_definitions')
export class ReportDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Stable key, e.g. ATTENDANCE_SUMMARY */
  @Column({ type: 'varchar', length: 64, unique: true })
  key!: string;

  /** i18n key for title (frontend resolves). */
  @Column({ type: 'varchar', length: 128 })
  titleKey!: string;

  @Column({ type: 'jsonb', default: [] })
  domains!: string[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
