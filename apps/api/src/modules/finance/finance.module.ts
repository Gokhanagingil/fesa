import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChargeItem } from '../../database/entities/charge-item.entity';
import { AthleteCharge } from '../../database/entities/athlete-charge.entity';
import { Athlete } from '../../database/entities/athlete.entity';
import { FinanceService } from './finance.service';
import { AthleteChargeController, ChargeItemController } from './finance.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ChargeItem, AthleteCharge, Athlete])],
  controllers: [ChargeItemController, AthleteChargeController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
