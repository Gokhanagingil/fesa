import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Athlete } from '../../database/entities/athlete.entity';
import { Guardian } from '../../database/entities/guardian.entity';
import { AthleteGuardian } from '../../database/entities/athlete-guardian.entity';
import { ClubGroup } from '../../database/entities/club-group.entity';
import { SportBranch } from '../../database/entities/sport-branch.entity';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

/**
 * Import / Export & Bulk Operations Foundation v1.
 *
 * The Imports module focuses on adoption-critical entry data — athletes,
 * guardians, and athlete↔guardian relationships — with a guided
 * preview → validate → commit flow. We intentionally avoid building a
 * generic ETL engine: each entity has a small, explicit column contract.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Athlete, Guardian, AthleteGuardian, ClubGroup, SportBranch]),
  ],
  controllers: [ImportsController],
  providers: [ImportsService],
  exports: [ImportsService],
})
export class ImportsModule {}
