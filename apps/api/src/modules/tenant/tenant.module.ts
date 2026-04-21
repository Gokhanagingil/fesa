import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../../database/entities/tenant.entity';
import { TenantService } from './tenant.service';
import { TenantBrandingService } from './tenant-branding.service';
import {
  PortalTenantBrandingController,
  StaffTenantBrandingController,
} from './tenant-branding.controller';

/**
 * TenantModule intentionally does NOT import LicensingModule.
 *
 * `StaffTenantBrandingController` references `FeatureGateGuard` from the
 * licensing module to gate the `parent_portal_branding` capability. That
 * guard (and `LicensingService`) are made available globally by
 * `LicensingModule` itself (see `@Global()` on that module), so we can
 * resolve them at handler-execution time without re-importing the module
 * here.
 *
 * Importing `LicensingModule` from `TenantModule` would introduce a
 * circular dependency:
 *   TenantModule -> LicensingModule -> AuthModule -> TenantModule
 * which causes `AuthModule.imports[1]` (TenantModule) to resolve as
 * `undefined` during Nest's dependency scan and the API to fail boot
 * with the exact UndefinedModuleException we hit on
 *   `AppModule -> CoreModule -> TenantModule -> LicensingModule`.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Tenant])],
  controllers: [PortalTenantBrandingController, StaffTenantBrandingController],
  providers: [TenantService, TenantBrandingService],
  exports: [TenantService, TenantBrandingService, TypeOrmModule],
})
export class TenantModule {}
