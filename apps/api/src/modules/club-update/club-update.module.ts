import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClubUpdate } from '../../database/entities/club-update.entity';
import { ClubUpdateService } from './club-update.service';
import { StaffClubUpdateController } from './club-update.controller';

/**
 * Parent Portal v1.1 — Club Updates layer.
 *
 * Owns the small, parent-safe announcements surface: a staff-side CRUD
 * controller and the read-side helpers consumed by the guardian portal
 * service to render the calm "From the club" strip on parent home.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ClubUpdate])],
  controllers: [StaffClubUpdateController],
  providers: [ClubUpdateService],
  exports: [ClubUpdateService, TypeOrmModule],
})
export class ClubUpdateModule {}
