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
import { Guardian } from '../../database/entities/guardian.entity';
import { AthleteGuardian } from '../../database/entities/athlete-guardian.entity';
import { AthleteTeamMembership } from '../../database/entities/athlete-team-membership.entity';
import { StaffUser } from '../../database/entities/staff-user.entity';
import { ActionCenterModule } from '../action-center/action-center.module';
import { CommunicationModule } from '../communication/communication.module';
import { FamilyActionModule } from '../family-action/family-action.module';
import { FinanceModule } from '../finance/finance.module';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';
import { SavedViewsService } from './saved-views.service';

@Module({
  imports: [
    ActionCenterModule,
    CommunicationModule,
    FamilyActionModule,
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
      Guardian,
      AthleteGuardian,
      AthleteTeamMembership,
      StaffUser,
    ]),
  ],
  controllers: [ReportingController],
  providers: [ReportingService, SavedViewsService],
})
export class ReportingModule {}
