import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportDefinition } from '../../database/entities/report-definition.entity';
import { SavedFilterPreset } from '../../database/entities/saved-filter-preset.entity';
import { ReportingController } from './reporting.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ReportDefinition, SavedFilterPreset])],
  controllers: [ReportingController],
})
export class ReportingModule {}
