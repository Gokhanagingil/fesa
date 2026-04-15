import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Athlete } from '../../database/entities/athlete.entity';
import { AthleteCharge } from '../../database/entities/athlete-charge.entity';
import { AthleteGuardian } from '../../database/entities/athlete-guardian.entity';
import { ClubGroup } from '../../database/entities/club-group.entity';
import { Guardian } from '../../database/entities/guardian.entity';
import { GuardianPortalAccess } from '../../database/entities/guardian-portal-access.entity';
import { GuardianPortalSession } from '../../database/entities/guardian-portal-session.entity';
import { PrivateLesson } from '../../database/entities/private-lesson.entity';
import { Team } from '../../database/entities/team.entity';
import { TrainingSession } from '../../database/entities/training-session.entity';
import { FamilyActionModule } from '../family-action/family-action.module';
import { FinanceModule } from '../finance/finance.module';
import { GuardianModule } from '../guardian/guardian.module';
import { PrivateLessonModule } from '../private-lesson/private-lesson.module';
import { TrainingModule } from '../training/training.module';
import { GuardianPortalController } from './guardian-portal.controller';
import { GuardianPortalGuard } from './guardian-portal.guard';
import { GuardianPortalService } from './guardian-portal.service';

@Module({
  imports: [
    GuardianModule,
    FamilyActionModule,
    FinanceModule,
    PrivateLessonModule,
    TrainingModule,
    TypeOrmModule.forFeature([
      Guardian,
      GuardianPortalAccess,
      GuardianPortalSession,
      AthleteGuardian,
      Athlete,
      ClubGroup,
      Team,
      TrainingSession,
      PrivateLesson,
      AthleteCharge,
    ]),
  ],
  controllers: [GuardianPortalController],
  providers: [GuardianPortalService, GuardianPortalGuard],
  exports: [GuardianPortalService, GuardianPortalGuard],
})
export class GuardianPortalModule {}
