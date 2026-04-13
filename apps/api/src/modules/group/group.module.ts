import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClubGroup } from '../../database/entities/club-group.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ClubGroup])],
  exports: [TypeOrmModule],
})
export class GroupModule {}
