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
import { Coach } from './coach.entity';
import { TrainingSessionStatus } from '../enums';

@Entity('training_session_series')
@Index(['tenantId', 'groupId'])
@Index(['tenantId', 'teamId'])
@Index(['tenantId', 'startsOn'])
@Index(['tenantId', 'coachId'])
export class TrainingSessionSeries {
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

  @Column({ type: 'uuid', nullable: true })
  coachId!: string | null;

  @ManyToOne(() => Coach, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'coachId' })
  coach!: Coach | null;

  @Column({ type: 'date' })
  startsOn!: string;

  @Column({ type: 'date' })
  endsOn!: string;

  /** ISO weekdays, 1 = Monday ... 7 = Sunday. */
  @Column({ type: 'int', array: true, default: () => "'{}'" })
  weekdays!: number[];

  @Column({ type: 'time' })
  sessionStartTime!: string;

  @Column({ type: 'time' })
  sessionEndTime!: string;

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
