import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Coach } from '../../database/entities/coach.entity';
import { ClubGroup } from '../../database/entities/club-group.entity';
import { Team } from '../../database/entities/team.entity';
import { TrainingSession } from '../../database/entities/training-session.entity';
import { TrainingSessionSeries } from '../../database/entities/training-session-series.entity';
import { SportBranch } from '../../database/entities/sport-branch.entity';
import { CoachService } from './coach.service';
import { CoachController } from './coach.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Coach, SportBranch, ClubGroup, Team, TrainingSession, TrainingSessionSeries])],
  controllers: [CoachController],
  providers: [CoachService],
  exports: [CoachService, TypeOrmModule],
})
export class CoachModule {}
