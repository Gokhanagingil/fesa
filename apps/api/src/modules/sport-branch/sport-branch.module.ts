import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SportBranch } from '../../database/entities/sport-branch.entity';
import { SportBranchController } from './sport-branch.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SportBranch])],
  controllers: [SportBranchController],
})
export class SportBranchModule {}
