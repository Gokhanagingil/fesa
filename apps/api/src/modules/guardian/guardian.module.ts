import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Guardian } from '../../database/entities/guardian.entity';
import { AthleteGuardian } from '../../database/entities/athlete-guardian.entity';
import { Athlete } from '../../database/entities/athlete.entity';
import { GuardianService } from './guardian.service';
import { GuardianController } from './guardian.controller';
import { FamilyActionModule } from '../family-action/family-action.module';

@Module({
  imports: [TypeOrmModule.forFeature([Guardian, AthleteGuardian, Athlete]), FamilyActionModule],
  controllers: [GuardianController],
  providers: [GuardianService],
  exports: [GuardianService, TypeOrmModule],
})
export class GuardianModule {}
