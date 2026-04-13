import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { SportBranch } from './sport-branch.entity';
import { ClubGroup } from './club-group.entity';
import { Team } from './team.entity';
import { AgeGroup } from './age-group.entity';

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  slug!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => SportBranch, (b) => b.tenant)
  sportBranches!: SportBranch[];

  @OneToMany(() => AgeGroup, (a) => a.tenant)
  ageGroups!: AgeGroup[];

  @OneToMany(() => ClubGroup, (g) => g.tenant)
  groups!: ClubGroup[];

  @OneToMany(() => Team, (t) => t.tenant)
  teams!: Team[];
}
