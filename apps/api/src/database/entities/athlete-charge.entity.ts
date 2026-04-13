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
import { ChargeItem } from './charge-item.entity';
import { AthleteChargeStatus } from '../enums';

@Entity('athlete_charges')
@Index(['tenantId', 'athleteId'])
@Index(['tenantId', 'status'])
@Index(['tenantId', 'dueDate'])
export class AthleteCharge {
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

  @Column({ type: 'uuid' })
  chargeItemId!: string;

  @ManyToOne(() => ChargeItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'chargeItemId' })
  chargeItem!: ChargeItem;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @Column({ type: 'date', nullable: true })
  dueDate!: Date | null;

  @Column({
    type: 'enum',
    enum: AthleteChargeStatus,
    enumName: 'athlete_charge_status',
    default: AthleteChargeStatus.PENDING,
  })
  status!: AthleteChargeStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
