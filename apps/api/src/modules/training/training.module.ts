import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrainingSession } from '../../database/entities/training-session.entity';
import { SportBranch } from '../../database/entities/sport-branch.entity';
import { ClubGroup } from '../../database/entities/club-group.entity';
import { Team } from '../../database/entities/team.entity';
import { Athlete } from '../../database/entities/athlete.entity';
import { Attendance } from '../../database/entities/attendance.entity';
import { AthleteTeamMembership } from '../../database/entities/athlete-team-membership.entity';
import { TrainingSessionSeries } from '../../database/entities/training-session-series.entity';
import { TrainingService } from './training.service';
import { AttendanceController, TrainingController } from './training.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TrainingSession,
      SportBranch,
      ClubGroup,
      Team,
      Athlete,
      Attendance,
      AthleteTeamMembership,
      TrainingSessionSeries,
    ]),
  ],
  controllers: [TrainingController, AttendanceController],
  providers: [TrainingService],
  exports: [TrainingService],
})
export class TrainingModule {}
