import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Athlete } from '../../database/entities/athlete.entity';
import { LicensePlan } from '../../database/entities/license-plan.entity';
import { LicensePlanEntitlement } from '../../database/entities/license-plan-entitlement.entity';
import { LicenseUsageBand } from '../../database/entities/license-usage-band.entity';
import { StaffUser } from '../../database/entities/staff-user.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import { TenantSubscription } from '../../database/entities/tenant-subscription.entity';
import { TenantUsageSnapshot } from '../../database/entities/tenant-usage-snapshot.entity';
import { AuthModule } from '../auth/auth.module';
import {
  PlatformLicensingController,
  TenantLicensingController,
} from './licensing.controller';
import { LicensingService } from './licensing.service';
import { PlatformAdminGuard } from './platform-admin.guard';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      LicensePlan,
      LicensePlanEntitlement,
      LicenseUsageBand,
      TenantSubscription,
      TenantUsageSnapshot,
      Tenant,
      Athlete,
      StaffUser,
    ]),
  ],
  controllers: [PlatformLicensingController, TenantLicensingController],
  providers: [LicensingService, PlatformAdminGuard],
  exports: [LicensingService, PlatformAdminGuard],
})
export class LicensingModule {}
