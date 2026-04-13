import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { SportBranch } from './sport-branch.entity';
import { AgeGroup } from './age-group.entity';
import { Team } from './team.entity';

/**
 * Training / cohort bucket (e.g. birth-year group). Distinct from Team.
 * Mapped to club_groups to avoid SQL reserved word "group".
 */
@Entity('club_groups')
export class ClubGroup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, (t) => t.groups, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @Column({ type: 'uuid' })
  sportBranchId!: string;

  @ManyToOne(() => SportBranch, (b) => b.groups, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sportBranchId' })
  sportBranch!: SportBranch;

  @Column({ type: 'uuid', nullable: true })
  ageGroupId!: string | null;

  @ManyToOne(() => AgeGroup, (a) => a.groups, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'ageGroupId' })
  ageGroup!: AgeGroup | null;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => Team, (t) => t.group)
  teams!: Team[];
}
