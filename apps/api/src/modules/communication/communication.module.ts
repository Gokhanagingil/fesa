import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Athlete } from '../../database/entities/athlete.entity';
import { AthleteCharge } from '../../database/entities/athlete-charge.entity';
import { AthleteGuardian } from '../../database/entities/athlete-guardian.entity';
import { AthleteTeamMembership } from '../../database/entities/athlete-team-membership.entity';
import { Guardian } from '../../database/entities/guardian.entity';
import { GuardianPortalAccess } from '../../database/entities/guardian-portal-access.entity';
import { ClubGroup } from '../../database/entities/club-group.entity';
import { OutreachActivity } from '../../database/entities/outreach-activity.entity';
import { PrivateLesson } from '../../database/entities/private-lesson.entity';
import { SavedFilterPreset } from '../../database/entities/saved-filter-preset.entity';
import { StaffUser } from '../../database/entities/staff-user.entity';
import { Team } from '../../database/entities/team.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import { TrainingSession } from '../../database/entities/training-session.entity';
import { FinanceModule } from '../finance/finance.module';
import { FamilyActionModule } from '../family-action/family-action.module';
import { CommunicationController } from './communication.controller';
import { CommunicationService } from './communication.service';
import { OutreachService } from './outreach.service';

@Module({
  imports: [
    FinanceModule,
    FamilyActionModule,
    TypeOrmModule.forFeature([
      Athlete,
      Guardian,
      GuardianPortalAccess,
      AthleteGuardian,
      AthleteTeamMembership,
      ClubGroup,
      Team,
      AthleteCharge,
      TrainingSession,
      PrivateLesson,
      SavedFilterPreset,
      OutreachActivity,
      StaffUser,
      Tenant,
    ]),
  ],
  controllers: [CommunicationController],
  providers: [CommunicationService, OutreachService],
  exports: [CommunicationService, OutreachService],
})
export class CommunicationModule {}
