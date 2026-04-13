import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClubGroup } from '../../database/entities/club-group.entity';
import { GroupController } from './group.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ClubGroup])],
  controllers: [GroupController],
  exports: [TypeOrmModule],
})
export class GroupModule {}
