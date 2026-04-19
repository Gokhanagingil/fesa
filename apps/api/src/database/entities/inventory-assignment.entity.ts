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
import { InventoryItem } from './inventory-item.entity';
import { InventoryVariant } from './inventory-variant.entity';

/**
 * Inventory assignment (Inventory & Assignment Pack v1).
 *
 * Tracks which athlete currently has, or once had, a particular variant.
 * An "open" assignment has `returnedAt = null`; returning the item closes it
 * but keeps the row for history / future reporting (think team manager
 * looking back at "who had jersey #12 last season?").
 *
 * Quantity defaults to 1 because the dominant case in amateur clubs is
 * single-unit assignments (one jersey, one tracksuit). The column is still
 * captured so a coach can give "5 cones to athlete X" from the same UX
 * without inventing a parallel flow.
 */
@Entity('inventory_assignments')
@Index(['tenantId', 'athleteId'])
@Index(['tenantId', 'inventoryVariantId'])
@Index(['tenantId', 'returnedAt'])
export class InventoryAssignment {
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

  @Column({ type: 'uuid' })
  athleteId!: string;

  @ManyToOne(() => Athlete, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'athleteId' })
  athlete!: Athlete;

  @Column({ type: 'int', default: 1 })
  quantity!: number;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  assignedAt!: Date;

  /** Set when the item was returned / released. Null while the assignment is open. */
  @Column({ type: 'timestamptz', nullable: true })
  returnedAt!: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
