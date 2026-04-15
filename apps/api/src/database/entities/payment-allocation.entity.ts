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
import { Payment } from './payment.entity';
import { AthleteCharge } from './athlete-charge.entity';

@Entity('payment_allocations')
@Index(['tenantId', 'paymentId'])
@Index(['tenantId', 'athleteChargeId'])
@Index(['paymentId', 'athleteChargeId'], { unique: true })
export class PaymentAllocation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @Column({ type: 'uuid' })
  paymentId!: string;

  @ManyToOne(() => Payment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'paymentId' })
  payment!: Payment;

  @Column({ type: 'uuid' })
  athleteChargeId!: string;

  @ManyToOne(() => AthleteCharge, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'athleteChargeId' })
  athleteCharge!: AthleteCharge;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
