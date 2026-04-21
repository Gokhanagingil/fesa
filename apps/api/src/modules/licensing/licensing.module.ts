import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Athlete } from '../../database/entities/athlete.entity';
import { LicensePlan } from '../../database/entities/license-plan.entity';
import { LicensePlanEntitlement } from '../../database/entities/license-plan-entitlement.entity';
import { LicenseUsageBand } from '../../database/entities/license-usage-band.entity';
import { StaffUser } from '../../database/entities/staff-user.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import { TenantSubscription } from '../../database/entities/tenant-subscription.entity';
import { TenantSubscriptionHistory } from '../../database/entities/tenant-subscription-history.entity';
import { TenantUsageSnapshot } from '../../database/entities/tenant-usage-snapshot.entity';
import { AuthModule } from '../auth/auth.module';
import { FeatureGateGuard } from './feature-gate.guard';
import {
  PlatformLicensingController,
  TenantLicensingController,
} from './licensing.controller';
import { LicensingSnapshotScheduler } from './licensing-snapshot.scheduler';
import { LicensingService } from './licensing.service';
import { PlatformAdminGuard } from './platform-admin.guard';

/**
 * LicensingModule is `@Global()` so its providers (`LicensingService`,
 * `PlatformAdminGuard`, `FeatureGateGuard`) can be injected from any
 * controller or service without requiring `LicensingModule` to be added
 * to that module's `imports` array.
 *
 * This is intentional and load-bearing for boot stability:
 *   - `StaffTenantBrandingController` (in TenantModule) decorates
 *     branding mutations with `@UseGuards(FeatureGateGuard)`.
 *   - If TenantModule had to import LicensingModule to satisfy that
 *     guard, we would re-introduce the cycle
 *     `TenantModule -> LicensingModule -> AuthModule -> TenantModule`,
 *     causing AuthModule's TenantModule import to resolve as undefined
 *     during Nest's dependency scan.
 *
 * Treating licensing as a cross-cutting capability (like `CoreModule`)
 * is the smallest correct architectural correction. The licensing
 * surface itself is unchanged: every gate still routes through
 * `LicensingService` and is still sealed by `PlatformAdminGuard` /
 * `FeatureGateGuard` exactly as before.
 */
@Global()
@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      LicensePlan,
      LicensePlanEntitlement,
      LicenseUsageBand,
      TenantSubscription,
      TenantSubscriptionHistory,
      TenantUsageSnapshot,
      Tenant,
      Athlete,
      StaffUser,
    ]),
  ],
  controllers: [PlatformLicensingController, TenantLicensingController],
  providers: [
    LicensingService,
    LicensingSnapshotScheduler,
    PlatformAdminGuard,
    FeatureGateGuard,
  ],
  exports: [LicensingService, PlatformAdminGuard, FeatureGateGuard],
})
export class LicensingModule {}
