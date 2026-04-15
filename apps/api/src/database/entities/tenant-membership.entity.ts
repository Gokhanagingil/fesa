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
import { TenantMembershipRole } from '../enums';
import { StaffUser } from './staff-user.entity';
import { Tenant } from './tenant.entity';

@Entity('tenant_memberships')
@Unique(['tenantId', 'staffUserId'])
@Index(['tenantId', 'role'])
@Index(['staffUserId'])
export class TenantMembership {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @Column({ type: 'uuid' })
  staffUserId!: string;

  @ManyToOne(() => StaffUser, (staffUser) => staffUser.memberships, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staffUserId' })
  staffUser!: StaffUser;

  @Column({ type: 'varchar', length: 32 })
  role!: TenantMembershipRole;

  @Column({ type: 'boolean', default: false })
  isDefault!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
