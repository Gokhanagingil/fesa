import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActionCenterItemState } from '../../database/entities/action-center-item-state.entity';
import { Athlete } from '../../database/entities/athlete.entity';
import { AthleteGuardian } from '../../database/entities/athlete-guardian.entity';
import { FamilyActionEvent } from '../../database/entities/family-action-event.entity';
import { FamilyActionRequest } from '../../database/entities/family-action-request.entity';
import { Guardian } from '../../database/entities/guardian.entity';
import { PrivateLesson } from '../../database/entities/private-lesson.entity';
import { TrainingSession } from '../../database/entities/training-session.entity';
import { FamilyActionModule } from '../family-action/family-action.module';
import { FinanceModule } from '../finance/finance.module';
import { PrivateLessonModule } from '../private-lesson/private-lesson.module';
import { TrainingModule } from '../training/training.module';
import { ActionCenterController } from './action-center.controller';
import { ActionCenterService } from './action-center.service';

@Module({
  imports: [
    FinanceModule,
    FamilyActionModule,
    PrivateLessonModule,
    TrainingModule,
    TypeOrmModule.forFeature([
      ActionCenterItemState,
      Athlete,
      AthleteGuardian,
      FamilyActionRequest,
      FamilyActionEvent,
      Guardian,
      PrivateLesson,
      TrainingSession,
    ]),
  ],
  controllers: [ActionCenterController],
  providers: [ActionCenterService],
  exports: [ActionCenterService],
})
export class ActionCenterModule {}
