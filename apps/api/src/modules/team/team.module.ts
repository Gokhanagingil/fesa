import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Team } from '../../database/entities/team.entity';
import { CoachModule } from '../coach/coach.module';
import { TeamController } from './team.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Team]), CoachModule],
  controllers: [TeamController],
  exports: [TypeOrmModule],
})
export class TeamModule {}
