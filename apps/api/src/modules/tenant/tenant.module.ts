import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../../database/entities/tenant.entity';
import { LicensingModule } from '../licensing/licensing.module';
import { TenantService } from './tenant.service';
import { TenantBrandingService } from './tenant-branding.service';
import {
  PortalTenantBrandingController,
  StaffTenantBrandingController,
} from './tenant-branding.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant]), LicensingModule],
  controllers: [PortalTenantBrandingController, StaffTenantBrandingController],
  providers: [TenantService, TenantBrandingService],
  exports: [TenantService, TenantBrandingService, TypeOrmModule],
})
export class TenantModule {}
