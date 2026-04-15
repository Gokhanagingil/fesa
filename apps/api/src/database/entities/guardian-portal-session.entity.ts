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
import { GuardianPortalAccess } from './guardian-portal-access.entity';

@Entity('guardian_portal_sessions')
@Index(['tenantId', 'tokenHash'], { unique: true })
@Index(['tenantId', 'guardianPortalAccessId'])
@Index(['tenantId', 'expiresAt'])
export class GuardianPortalSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @Column({ type: 'uuid' })
  guardianPortalAccessId!: string;

  @ManyToOne(() => GuardianPortalAccess, (access) => access.sessions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'guardianPortalAccessId' })
  access!: GuardianPortalAccess;

  @Column({ type: 'varchar', length: 128 })
  tokenHash!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
