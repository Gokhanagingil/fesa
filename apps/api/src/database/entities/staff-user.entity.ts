import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { StaffPlatformRole, StaffUserStatus } from '../enums';
import { StaffSession } from './staff-session.entity';
import { TenantMembership } from './tenant-membership.entity';

@Entity('staff_users')
@Index(['email'], { unique: true })
@Index(['status'])
export class StaffUser {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({ type: 'varchar', length: 120 })
  firstName!: string;

  @Column({ type: 'varchar', length: 120 })
  lastName!: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  preferredName!: string | null;

  @Column({ type: 'varchar', length: 32, default: StaffPlatformRole.STANDARD })
  platformRole!: StaffPlatformRole;

  @Column({ type: 'varchar', length: 32, default: StaffUserStatus.ACTIVE })
  status!: StaffUserStatus;

  @Column({ type: 'varchar', length: 128 })
  passwordHash!: string;

  @Column({ type: 'varchar', length: 64 })
  passwordSalt!: string;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @OneToMany(() => TenantMembership, (membership) => membership.staffUser)
  memberships?: TenantMembership[];

  @OneToMany(() => StaffSession, (session) => session.staffUser)
  sessions?: StaffSession[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
