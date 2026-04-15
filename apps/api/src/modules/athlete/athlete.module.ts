import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Athlete } from '../../database/entities/athlete.entity';
import { SportBranch } from '../../database/entities/sport-branch.entity';
import { ClubGroup } from '../../database/entities/club-group.entity';
import { Team } from '../../database/entities/team.entity';
import { AthleteGuardian } from '../../database/entities/athlete-guardian.entity';
import { AthleteTeamMembership } from '../../database/entities/athlete-team-membership.entity';
import { AthleteService } from './athlete.service';
import { AthleteController } from './athlete.controller';
import { GuardianModule } from '../guardian/guardian.module';
import { FamilyActionModule } from '../family-action/family-action.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Athlete, SportBranch, ClubGroup, Team, AthleteGuardian, AthleteTeamMembership]),
    GuardianModule,
    FamilyActionModule,
  ],
  controllers: [AthleteController],
  providers: [AthleteService],
  exports: [AthleteService, TypeOrmModule],
})
export class AthleteModule {}
