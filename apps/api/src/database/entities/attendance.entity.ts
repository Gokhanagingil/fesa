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
import { TrainingSession } from './training-session.entity';
import { Athlete } from './athlete.entity';
import { AttendanceStatus } from '../enums';

@Entity('attendances')
@Unique(['trainingSessionId', 'athleteId'])
@Index(['tenantId', 'trainingSessionId'])
@Index(['tenantId', 'athleteId'])
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @Column({ type: 'uuid' })
  trainingSessionId!: string;

  @ManyToOne(() => TrainingSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trainingSessionId' })
  trainingSession!: TrainingSession;

  @Column({ type: 'uuid' })
  athleteId!: string;

  @ManyToOne(() => Athlete, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'athleteId' })
  athlete!: Athlete;

  @Column({
    type: 'enum',
    enum: AttendanceStatus,
    enumName: 'attendance_status',
    default: AttendanceStatus.PRESENT,
  })
  status!: AttendanceStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  recordedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
