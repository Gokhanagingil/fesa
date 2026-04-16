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
import { StaffUser } from './staff-user.entity';
import { Tenant } from './tenant.entity';
import {
  ActionCenterItemCategory,
  ActionCenterItemType,
} from '../enums';

@Entity('action_center_item_states')
@Index(['tenantId', 'staffUserId', 'itemKey'], { unique: true })
@Index(['tenantId', 'staffUserId', 'readAt'])
@Index(['tenantId', 'staffUserId', 'dismissedAt'])
@Index(['tenantId', 'staffUserId', 'completedAt'])
@Index(['tenantId', 'staffUserId', 'snoozedUntil'])
export class ActionCenterItemState {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @Column({ type: 'uuid', nullable: true })
  staffUserId!: string | null;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @ManyToOne(() => StaffUser, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'staffUserId' })
  staffUser!: StaffUser | null;

  @Column({ type: 'varchar', length: 160 })
  itemKey!: string;

  @Column({ type: 'varchar', length: 64 })
  snapshotToken!: string;

  @Column({ type: 'varchar', length: 32 })
  category!: ActionCenterItemCategory;

  @Column({ type: 'varchar', length: 48 })
  type!: ActionCenterItemType;

  @Column({ type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  dismissedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  snoozedUntil!: Date | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
