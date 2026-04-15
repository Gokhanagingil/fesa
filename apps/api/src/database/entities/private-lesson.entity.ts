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
import { Athlete } from './athlete.entity';
import { SportBranch } from './sport-branch.entity';
import { Coach } from './coach.entity';
import { AttendanceStatus, TrainingSessionStatus } from '../enums';

@Entity('private_lessons')
@Index(['tenantId', 'scheduledStart'])
@Index(['tenantId', 'athleteId'])
@Index(['tenantId', 'coachId'])
@Index(['tenantId', 'status'])
export class PrivateLesson {
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
  coachId!: string;

  @ManyToOne(() => Coach, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'coachId' })
  coach!: Coach;

  @Column({ type: 'uuid' })
  sportBranchId!: string;

  @ManyToOne(() => SportBranch, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sportBranchId' })
  sportBranch!: SportBranch;

  @Column({ type: 'varchar', length: 200, nullable: true })
  focus!: string | null;

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

  @Column({
    type: 'enum',
    enum: AttendanceStatus,
    enumName: 'attendance_status',
    nullable: true,
  })
  attendanceStatus!: AttendanceStatus | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  notes!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
