import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Athlete } from '../../database/entities/athlete.entity';
import { AthleteCharge } from '../../database/entities/athlete-charge.entity';
import { AthleteGuardian } from '../../database/entities/athlete-guardian.entity';
import { AthleteTeamMembership } from '../../database/entities/athlete-team-membership.entity';
import { Guardian } from '../../database/entities/guardian.entity';
import { ClubGroup } from '../../database/entities/club-group.entity';
import { PrivateLesson } from '../../database/entities/private-lesson.entity';
import { SavedFilterPreset } from '../../database/entities/saved-filter-preset.entity';
import { Team } from '../../database/entities/team.entity';
import { TrainingSession } from '../../database/entities/training-session.entity';
import { FinanceModule } from '../finance/finance.module';
import { CommunicationController } from './communication.controller';
import { CommunicationService } from './communication.service';

@Module({
  imports: [
    FinanceModule,
    TypeOrmModule.forFeature([
      Athlete,
      Guardian,
      AthleteGuardian,
      AthleteTeamMembership,
      ClubGroup,
      Team,
      AthleteCharge,
      TrainingSession,
      PrivateLesson,
      SavedFilterPreset,
    ]),
  ],
  controllers: [CommunicationController],
  providers: [CommunicationService],
})
export class CommunicationModule {}
