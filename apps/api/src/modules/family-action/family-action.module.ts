import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Athlete } from '../../database/entities/athlete.entity';
import { AthleteGuardian } from '../../database/entities/athlete-guardian.entity';
import { FamilyActionEvent } from '../../database/entities/family-action-event.entity';
import { FamilyActionRequest } from '../../database/entities/family-action-request.entity';
import { Guardian } from '../../database/entities/guardian.entity';
import { FamilyActionController } from './family-action.controller';
import { FamilyActionService } from './family-action.service';

@Module({
  imports: [TypeOrmModule.forFeature([FamilyActionRequest, FamilyActionEvent, Athlete, Guardian, AthleteGuardian])],
  controllers: [FamilyActionController],
  providers: [FamilyActionService],
  exports: [FamilyActionService],
})
export class FamilyActionModule {}
