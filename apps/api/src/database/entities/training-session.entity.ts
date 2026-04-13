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
import { Team } from './team.entity';
import { TrainingSessionStatus } from '../enums';
@Entity('training_sessions')
@Index(['tenantId', 'scheduledStart'])
@Index(['tenantId', 'groupId'])
@Index(['tenantId', 'teamId'])
export class TrainingSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'uuid' })
  sportBranchId!: string;

  @ManyToOne(() => SportBranch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sportBranchId' })
  sportBranch!: SportBranch;

  @Column({ type: 'uuid' })
  groupId!: string;

  @ManyToOne(() => ClubGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group!: ClubGroup;

  @Column({ type: 'uuid', nullable: true })
  teamId!: string | null;

  @ManyToOne(() => Team, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'teamId' })
  team!: Team | null;

  @Column({ type: 'timestamptz' })
  scheduledStart!: Date;

  @Column({ type: 'timestamptz' })
  scheduledEnd!: Date;

  @Column({ type: 'varchar', length: 200, nullable: true })
  location!: string | null;

  @Column({
    type: 'enum',
    enum: TrainingSessionStatus,
    enumName: 'training_session_status',
    default: TrainingSessionStatus.PLANNED,
  })
  status!: TrainingSessionStatus;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  notes!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
