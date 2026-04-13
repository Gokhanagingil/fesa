import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { Athlete } from './athlete.entity';
import { Guardian } from './guardian.entity';

/**
 * M:N between Athlete and Guardian with relationship metadata.
 * One row per (athlete, guardian) pair.
 */
@Entity('athlete_guardians')
@Unique(['athleteId', 'guardianId'])
@Index(['tenantId', 'athleteId'])
@Index(['tenantId', 'guardianId'])
export class AthleteGuardian {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @Column({ type: 'uuid' })
  athleteId!: string;

  @ManyToOne(() => Athlete, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'athleteId' })
  athlete!: Athlete;

  @Column({ type: 'uuid' })
  guardianId!: string;

  @ManyToOne(() => Guardian, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guardianId' })
  guardian!: Guardian;

  /** mother | father | guardian | other — extend via vocabulary later */
  @Column({ type: 'varchar', length: 32 })
  relationshipType!: string;

  @Column({ type: 'boolean', default: false })
  isPrimaryContact!: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
