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
import { InventoryItem } from './inventory-item.entity';

/**
 * Inventory variant (Inventory & Assignment Pack v1).
 *
 * Variants describe the actual stockable units of an InventoryItem:
 *   - Sweatshirt size M
 *   - Training jersey size L number 12
 *   - "Default" pooled bucket for cones / balls
 *
 * Stock math is intentionally additive and explicit:
 *   stockOnHand   — total physical units owned by the club for this variant
 *   assignedCount — number of those units currently assigned to athletes
 *   available     — derived as max(stockOnHand - assignedCount, 0)
 *
 * The service layer recomputes assignedCount on every assignment / return so
 * the field stays trustworthy for low-stock signals without expensive joins.
 */
@Entity('inventory_variants')
@Index(['tenantId', 'inventoryItemId'])
@Index(['tenantId', 'isActive'])
export class InventoryVariant {
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

  /** Free-form size label ("S", "M", "L", "XL", "5"). Null for pooled defaults. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  size!: string | null;

  /** Optional jersey/back number; only meaningful for assigned items. */
  @Column({ type: 'varchar', length: 16, nullable: true })
  number!: string | null;

  /** Optional colour label ("white", "navy"). Kept short and free-form. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  color!: string | null;

  /** Marker for the auto-generated default variant of pooled / single items. */
  @Column({ type: 'boolean', default: false })
  isDefault!: boolean;

  @Column({ type: 'int', default: 0 })
  stockOnHand!: number;

  @Column({ type: 'int', default: 0 })
  assignedCount!: number;

  /** Optional override for the parent item's low-stock threshold. */
  @Column({ type: 'int', nullable: true })
  lowStockThreshold!: number | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
