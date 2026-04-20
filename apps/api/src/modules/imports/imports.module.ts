import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Athlete } from '../../database/entities/athlete.entity';
import { Guardian } from '../../database/entities/guardian.entity';
import { AthleteGuardian } from '../../database/entities/athlete-guardian.entity';
import { ClubGroup } from '../../database/entities/club-group.entity';
import { SportBranch } from '../../database/entities/sport-branch.entity';
import { Coach } from '../../database/entities/coach.entity';
import { Team } from '../../database/entities/team.entity';
import { ChargeItem } from '../../database/entities/charge-item.entity';
import { InventoryItem } from '../../database/entities/inventory-item.entity';
import { InventoryVariant } from '../../database/entities/inventory-variant.entity';
import { InventoryMovement } from '../../database/entities/inventory-movement.entity';
import { ImportBatch } from '../../database/entities/import-batch.entity';
import { StaffUser } from '../../database/entities/staff-user.entity';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

/**
 * Club Onboarding Wizard + Import Templates Foundation.
 *
 * The Imports module is the platform's adoption engine. It owns:
 *   - the per-entity column contracts (sport branches → coaches → groups →
 *     teams → athletes → guardians → links → finance → inventory)
 *   - downloadable CSV templates for each step
 *   - a strict but human preview / validate / commit pipeline
 *   - the onboarding state endpoint that backs the guided wizard
 *
 * We intentionally avoid building a generic ETL engine: each entity has a
 * small, explicit column contract and a dedicated commit handler.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Athlete,
      Guardian,
      AthleteGuardian,
      ClubGroup,
      SportBranch,
      Coach,
      Team,
      ChargeItem,
      InventoryItem,
      InventoryVariant,
      InventoryMovement,
      ImportBatch,
      StaffUser,
    ]),
  ],
  controllers: [ImportsController, OnboardingController],
  providers: [ImportsService, OnboardingService],
  exports: [ImportsService, OnboardingService],
})
export class ImportsModule {}
