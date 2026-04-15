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
import { Athlete } from './athlete.entity';

@Entity('payments')
@Index(['tenantId', 'athleteId'])
@Index(['tenantId', 'paidAt'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @Column({ type: 'uuid' })
  athleteId!: string;

  @ManyToOne(() => Athlete, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'athleteId' })
  athlete!: Athlete;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({ type: 'timestamptz' })
  paidAt!: Date;

  @Column({ type: 'varchar', length: 64, nullable: true })
  method!: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  reference!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
