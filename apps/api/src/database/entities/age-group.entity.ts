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

@Entity('age_groups')
export class AgeGroup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, (t) => t.ageGroups, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  /** Display label, e.g. "2015" or "U12". */
  @Column({ type: 'varchar', length: 64 })
  label!: string;

  /** Optional birth year lower bound for reporting filters. */
  @Column({ type: 'int', nullable: true })
  birthYearFrom!: number | null;

  /** Optional birth year upper bound. */
  @Column({ type: 'int', nullable: true })
  birthYearTo!: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => ClubGroup, (g) => g.ageGroup)
  groups!: ClubGroup[];
}
