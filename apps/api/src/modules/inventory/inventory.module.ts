import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryItem } from '../../database/entities/inventory-item.entity';
import { InventoryVariant } from '../../database/entities/inventory-variant.entity';
import { InventoryAssignment } from '../../database/entities/inventory-assignment.entity';
import { InventoryMovement } from '../../database/entities/inventory-movement.entity';
import { Athlete } from '../../database/entities/athlete.entity';
import { SportBranch } from '../../database/entities/sport-branch.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryItem,
      InventoryVariant,
      InventoryAssignment,
      InventoryMovement,
      Athlete,
      SportBranch,
    ]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
