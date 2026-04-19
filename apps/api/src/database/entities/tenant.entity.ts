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

  /**
   * Parent Portal & Tenant Branding Foundation v1.
   *
   * Branding is intentionally limited to a small, controlled surface so each
   * club can feel like itself in the parent portal without degrading product
   * quality. Layout, typography, spacing, and component structure stay
   * identical across tenants — only the marks below vary.
   */
  @Column({ type: 'varchar', length: 160, nullable: true })
  brandDisplayName!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  brandTagline!: string | null;

  @Column({ type: 'varchar', length: 9, nullable: true })
  brandPrimaryColor!: string | null;

  @Column({ type: 'varchar', length: 9, nullable: true })
  brandAccentColor!: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  brandLogoUrl!: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  brandWelcomeTitle!: string | null;

  @Column({ type: 'varchar', length: 400, nullable: true })
  brandWelcomeMessage!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  brandUpdatedAt!: Date | null;

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
