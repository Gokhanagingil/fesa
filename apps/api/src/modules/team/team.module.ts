import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Team } from '../../database/entities/team.entity';
import { TeamController } from './team.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Team])],
  controllers: [TeamController],
  exports: [TypeOrmModule],
})
export class TeamModule {}
