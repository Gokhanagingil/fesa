import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClubGroup } from '../../database/entities/club-group.entity';
import { Coach } from '../../database/entities/coach.entity';
import { GroupController } from './group.controller';
import { CoachModule } from '../coach/coach.module';

@Module({
  imports: [CoachModule, TypeOrmModule.forFeature([ClubGroup, Coach])],
  controllers: [GroupController],
  exports: [TypeOrmModule],
})
export class GroupModule {}
