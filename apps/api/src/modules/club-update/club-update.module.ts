import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClubGroup } from '../../database/entities/club-group.entity';
import { ClubUpdate } from '../../database/entities/club-update.entity';
import { SportBranch } from '../../database/entities/sport-branch.entity';
import { Team } from '../../database/entities/team.entity';
import { ClubUpdateService } from './club-update.service';
import { StaffClubUpdateController } from './club-update.controller';

/**
 * Parent Portal v1.1 + v1.2 — Club Updates layer.
 *
 * Owns the small, parent-safe announcements surface: a staff-side CRUD
 * controller and the read-side helpers consumed by the guardian portal
 * service to render the calm "From the club" strip on parent home. The
 * v1.2 audience targeting reads the catalog (sport branches, groups,
 * teams) directly through these repositories so it can validate ids
 * without an extra service hop.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ClubUpdate, SportBranch, ClubGroup, Team])],
  controllers: [StaffClubUpdateController],
  providers: [ClubUpdateService],
  exports: [ClubUpdateService, TypeOrmModule],
})
export class ClubUpdateModule {}
