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
import { Guardian } from './guardian.entity';
import { FamilyActionRequestStatus, FamilyActionRequestType } from '../enums';

@Entity('family_action_requests')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'athleteId', 'status'])
@Index(['tenantId', 'guardianId', 'status'])
export class FamilyActionRequest {
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

  @Column({ type: 'uuid', nullable: true })
  guardianId!: string | null;

  @ManyToOne(() => Guardian, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'guardianId' })
  guardian!: Guardian | null;

  @Column({
    type: 'enum',
    enum: FamilyActionRequestType,
    enumName: 'family_action_request_type',
  })
  type!: FamilyActionRequestType;

  @Column({
    type: 'enum',
    enum: FamilyActionRequestStatus,
    enumName: 'family_action_request_status',
    default: FamilyActionRequestStatus.PENDING_FAMILY_ACTION,
  })
  status!: FamilyActionRequestStatus;

  @Column({ type: 'varchar', length: 200 })
  title!: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  description!: string | null;

  @Column({ type: 'date', nullable: true })
  dueDate!: Date | null;

  @Column({ type: 'jsonb', default: {} })
  payload!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  latestResponseText!: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  decisionNote!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
