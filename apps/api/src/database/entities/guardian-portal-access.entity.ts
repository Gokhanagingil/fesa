import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { Guardian } from './guardian.entity';
import { GuardianPortalSession } from './guardian-portal-session.entity';

@Entity('guardian_portal_accesses')
@Unique(['tenantId', 'guardianId'])
@Index(['tenantId', 'email'])
@Index(['tenantId', 'status'])
export class GuardianPortalAccess {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @Column({ type: 'uuid' })
  guardianId!: string;

  @ManyToOne(() => Guardian, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'guardianId' })
  guardian!: Guardian;

  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({ type: 'varchar', length: 32, default: 'invited' })
  status!: 'invited' | 'active' | 'disabled';

  @Column({ type: 'varchar', length: 128, nullable: true })
  passwordHash!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  passwordSalt!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  inviteTokenHash!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  inviteTokenExpiresAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  invitedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  activatedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  disabledAt!: Date | null;

  @OneToMany(() => GuardianPortalSession, (session) => session.access)
  sessions?: GuardianPortalSession[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
