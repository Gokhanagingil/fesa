import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChargeItem } from '../../database/entities/charge-item.entity';
import { AthleteCharge } from '../../database/entities/athlete-charge.entity';
import { Athlete } from '../../database/entities/athlete.entity';
import { Payment } from '../../database/entities/payment.entity';
import { PaymentAllocation } from '../../database/entities/payment-allocation.entity';
import { FinanceService } from './finance.service';
import {
  AthleteChargeController,
  ChargeItemController,
  FinanceSummaryController,
  PaymentController,
} from './finance.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ChargeItem, AthleteCharge, Athlete, Payment, PaymentAllocation])],
  controllers: [ChargeItemController, AthleteChargeController, PaymentController, FinanceSummaryController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}
