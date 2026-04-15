import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportDefinition } from '../../database/entities/report-definition.entity';
import { SavedFilterPreset } from '../../database/entities/saved-filter-preset.entity';
import { Athlete } from '../../database/entities/athlete.entity';
import { AthleteCharge } from '../../database/entities/athlete-charge.entity';
import { Payment } from '../../database/entities/payment.entity';
import { PaymentAllocation } from '../../database/entities/payment-allocation.entity';
import { TrainingSession } from '../../database/entities/training-session.entity';
import { Attendance } from '../../database/entities/attendance.entity';
import { ClubGroup } from '../../database/entities/club-group.entity';
import { Coach } from '../../database/entities/coach.entity';
import { PrivateLesson } from '../../database/entities/private-lesson.entity';
import { FinanceModule } from '../finance/finance.module';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';

@Module({
  imports: [
    FinanceModule,
    TypeOrmModule.forFeature([
      ReportDefinition,
      SavedFilterPreset,
      Athlete,
      AthleteCharge,
      Payment,
      PaymentAllocation,
      TrainingSession,
      Attendance,
      ClubGroup,
      Coach,
      PrivateLesson,
    ]),
  ],
  controllers: [ReportingController],
  providers: [ReportingService],
})
export class ReportingModule {}
