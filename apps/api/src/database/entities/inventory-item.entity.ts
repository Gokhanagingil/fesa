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
import { SportBranch } from './sport-branch.entity';
import { InventoryCategory } from '../enums';

/**
 * Inventory item / product definition (Inventory & Assignment Pack v1).
 *
 * An InventoryItem is the *catalogue entry* that staff manage:
 *   - "Training jersey", "Match jersey", "Sweatshirt", "Ball", "Cones"
 *
 * Whether the item carries variants (size, number, colour) is captured
 * by the lightweight `hasVariants` flag and mirrored in InventoryVariant
 * rows. A single, "default" variant is always created so quantity bookkeeping
 * (stock added / removed / assigned) can be uniform across simple and
 * variant-bearing items without forcing two separate code paths.
 */
@Entity('inventory_items')
@Index(['tenantId', 'isActive'])
@Index(['tenantId', 'category'])
@Index(['tenantId', 'sportBranchId'])
export class InventoryItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant!: Tenant;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({
    type: 'enum',
    enum: InventoryCategory,
    enumName: 'inventory_category',
    default: InventoryCategory.EQUIPMENT,
  })
  category!: InventoryCategory;

  /** Optional sport branch hint — useful for branch-scoped filtering & reporting. */
  @Column({ type: 'uuid', nullable: true })
  sportBranchId!: string | null;

  @ManyToOne(() => SportBranch, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'sportBranchId' })
  sportBranch!: SportBranch | null;

  /**
   * Marks an item as carrying meaningful variants (size, number).
   * For pooled equipment this is false and a single default variant
   * holds the stock.
   */
  @Column({ type: 'boolean', default: false })
  hasVariants!: boolean;

  /**
   * When true, an item is intended to be *individually assigned* to athletes
   * (e.g. numbered jerseys, sweatshirts handed out). When false the item is
   * a pooled stock entry where assignment is optional and quantity-only.
   */
  @Column({ type: 'boolean', default: false })
  trackAssignment!: boolean;

  /**
   * Tenant-level low-stock threshold. When a variant's available count drops
   * to or below this number it surfaces as "low stock". Each variant may
   * override via its own threshold; 0 disables the cue.
   */
  @Column({ type: 'int', default: 0 })
  lowStockThreshold!: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description!: string | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
