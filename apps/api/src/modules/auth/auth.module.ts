import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Athlete } from '../../database/entities/athlete.entity';
import { Coach } from '../../database/entities/coach.entity';
import { ClubGroup } from '../../database/entities/club-group.entity';
import { Guardian } from '../../database/entities/guardian.entity';
import { GuardianPortalAccess } from '../../database/entities/guardian-portal-access.entity';
import { StaffSession } from '../../database/entities/staff-session.entity';
import { StaffUser } from '../../database/entities/staff-user.entity';
import { Team } from '../../database/entities/team.entity';
import { TenantMembership } from '../../database/entities/tenant-membership.entity';
import { ActionCenterModule } from '../action-center/action-center.module';
import { TenantModule } from '../tenant/tenant.module';
import { AuthController, AuthTenantController } from './auth.controller';
import { AuthService } from './auth.service';
import { StaffAuthGuard } from './staff-auth.guard';

@Module({
  imports: [
    ActionCenterModule,
    TenantModule,
    TypeOrmModule.forFeature([
      StaffUser,
      StaffSession,
      TenantMembership,
      Athlete,
      Guardian,
      Coach,
      ClubGroup,
      Team,
      GuardianPortalAccess,
    ]),
  ],
  controllers: [AuthController, AuthTenantController],
  providers: [AuthService, StaffAuthGuard],
  exports: [AuthService, StaffAuthGuard],
})
export class AuthModule {}
