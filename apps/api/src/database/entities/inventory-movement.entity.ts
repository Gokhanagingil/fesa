import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { Athlete } from './athlete.entity';
import { InventoryItem } from './inventory-item.entity';
import { InventoryVariant } from './inventory-variant.entity';
import { InventoryMovementType } from '../enums';

/**
 * Inventory movement / stock event log (Inventory & Assignment Pack v1).
 *
 * Append-only audit-friendly trail of meaningful inventory events:
 *   stock added / removed / adjusted / assigned / returned / retired.
 *
 * Quantities are signed where it makes sense:
 *   +N for stock additions and assignments,
 *   -N for removals, returns and retirement.
 *
 * The log intentionally avoids encoding "warehouse semantics"; it answers
 * lightweight questions ("who took what last week?", "how did we get to
 * 12 jerseys?") without becoming an ERP stack.
 */
@Entity('inventory_movements')
@Index(['tenantId', 'inventoryItemId'])
@Index(['tenantId', 'inventoryVariantId'])
@Index(['tenantId', 'createdAt'])
export class InventoryMovement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @Column({ type: 'uuid' })
  inventoryItemId!: string;

  @ManyToOne(() => InventoryItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inventoryItemId' })
  inventoryItem!: InventoryItem;

  @Column({ type: 'uuid' })
  inventoryVariantId!: string;

  @ManyToOne(() => InventoryVariant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inventoryVariantId' })
  inventoryVariant!: InventoryVariant;

  @Column({
    type: 'enum',
    enum: InventoryMovementType,
    enumName: 'inventory_movement_type',
  })
  type!: InventoryMovementType;

  /** Signed integer. Positive = stock in / assignment, negative = stock out / return. */
  @Column({ type: 'int' })
  quantity!: number;

  @Column({ type: 'uuid', nullable: true })
  athleteId!: string | null;

  @ManyToOne(() => Athlete, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'athleteId' })
  athlete!: Athlete | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note!: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdByStaffUserId!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
