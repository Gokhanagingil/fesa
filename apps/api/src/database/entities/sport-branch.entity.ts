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
import { ClubGroup } from './club-group.entity';
import { Team } from './team.entity';

@Entity('sport_branches')
export class SportBranch {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, (t) => t.sportBranches, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  /** Stable code for integrations (e.g. BASKETBALL). */
  @Column({ type: 'varchar', length: 48 })
  code!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => ClubGroup, (g) => g.sportBranch)
  groups!: ClubGroup[];

  @OneToMany(() => Team, (t) => t.sportBranch)
  teams!: Team[];
}
