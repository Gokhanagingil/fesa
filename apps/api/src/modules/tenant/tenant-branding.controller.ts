import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { TenantGuard } from '../core/tenant.guard';
import { TenantBrandingService } from './tenant-branding.service';
import { UpdateTenantBrandingDto } from './dto/update-tenant-branding.dto';

/**
 * Parent-portal-safe brand listing.
 *
 * Used by the parent activation/login surfaces so guardians can pick their
 * club without first authenticating to the staff API. Returns only the
 * controlled brand payload — no member counts, finance, or operational data.
 */
@Controller('portal/tenants')
export class PortalTenantBrandingController {
  constructor(private readonly branding: TenantBrandingService) {}

  @Get()
  list() {
    return this.branding.listPublicBranding();
  }

  @Get(':tenantId')
  one(@Param('tenantId') tenantId: string) {
    return this.branding.getForTenant(tenantId);
  }
}

/**
 * Staff-scoped branding management.
 *
 * Tenant isolation is enforced via the existing `TenantGuard`: a staff user
 * can only update branding for the tenant their authenticated request is
 * already scoped to. We intentionally do not allow cross-tenant writes here.
 */
@Controller('tenant/branding')
@UseGuards(TenantGuard)
export class StaffTenantBrandingController {
  constructor(private readonly branding: TenantBrandingService) {}

  @Get()
  current(@Req() req: Request) {
    return this.branding.getForTenant(req.tenantId!);
  }

  @Put()
  update(@Req() req: Request, @Body() dto: UpdateTenantBrandingDto) {
    if (!dto || typeof dto !== 'object') {
      throw new BadRequestException('Branding payload is required');
    }
    return this.branding.updateBranding(req.tenantId!, dto);
  }
}
