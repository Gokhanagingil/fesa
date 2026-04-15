import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { FamilyActionRequest } from './family-action-request.entity';
import { FamilyActionActor, FamilyActionRequestStatus } from '../enums';

@Entity('family_action_events')
@Index(['tenantId', 'familyActionRequestId'])
export class FamilyActionEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @Column({ type: 'uuid' })
  familyActionRequestId!: string;

  @ManyToOne(() => FamilyActionRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'familyActionRequestId' })
  familyActionRequest!: FamilyActionRequest;

  @Column({
    type: 'enum',
    enum: FamilyActionActor,
    enumName: 'family_action_actor',
  })
  actor!: FamilyActionActor;

  @Column({ type: 'varchar', length: 64 })
  eventType!: string;

  @Column({
    type: 'enum',
    enum: FamilyActionRequestStatus,
    enumName: 'family_action_request_status',
    nullable: true,
  })
  fromStatus!: FamilyActionRequestStatus | null;

  @Column({
    type: 'enum',
    enum: FamilyActionRequestStatus,
    enumName: 'family_action_request_status',
    nullable: true,
  })
  toStatus!: FamilyActionRequestStatus | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  note!: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
