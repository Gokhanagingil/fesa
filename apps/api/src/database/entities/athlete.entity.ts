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
import { SportBranch } from './sport-branch.entity';
import { ClubGroup } from './club-group.entity';
import { AthleteStatus } from '../enums';

@Entity('athletes')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'sportBranchId'])
@Index(['tenantId', 'primaryGroupId'])
export class Athlete {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @Column({ type: 'varchar', length: 120 })
  firstName!: string;

  @Column({ type: 'varchar', length: 120 })
  lastName!: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  preferredName!: string | null;

  /** Full date when known; supports age-based operations and future compliance needs. */
  @Column({ type: 'date', nullable: true })
  birthDate!: Date | null;

  /** Free-form or controlled vocabulary (e.g. male, female, non_binary) — extensible without schema churn. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  gender!: string | null;

  @Column({ type: 'uuid' })
  sportBranchId!: string;

  @ManyToOne(() => SportBranch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sportBranchId' })
  sportBranch!: SportBranch;

  /** Primary training cohort; athlete may train here without any team assignment. */
  @Column({ type: 'uuid', nullable: true })
  primaryGroupId!: string | null;

  @ManyToOne(() => ClubGroup, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'primaryGroupId' })
  primaryGroup!: ClubGroup | null;

  @Column({
    type: 'enum',
    enum: AthleteStatus,
    enumName: 'athlete_status',
    default: AthleteStatus.ACTIVE,
  })
  /** Trial and paused keep lifecycle visible without forcing archive/leave semantics too early. */
  status!: AthleteStatus;

  @Column({ type: 'varchar', length: 8, nullable: true })
  jerseyNumber!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
