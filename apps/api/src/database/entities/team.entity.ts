import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { SportBranch } from './sport-branch.entity';
import { ClubGroup } from './club-group.entity';

@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, (t) => t.teams, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @Column({ type: 'uuid' })
  sportBranchId!: string;

  @ManyToOne(() => SportBranch, (b) => b.teams, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sportBranchId' })
  sportBranch!: SportBranch;

  /** Optional link to a cohort group (e.g. 2015A within 2015 group). */
  @Column({ type: 'uuid', nullable: true })
  groupId!: string | null;

  @ManyToOne(() => ClubGroup, (g) => g.teams, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'groupId' })
  group!: ClubGroup | null;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  code!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
