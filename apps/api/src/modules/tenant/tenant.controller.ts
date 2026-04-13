import { Controller, Get } from '@nestjs/common';
import { TenantService } from './tenant.service';

/**
 * Public tenant directory for development UIs (no auth yet).
 * Replace with auth-scoped listing when RBAC lands.
 */
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenants: TenantService) {}

  @Get()
  list() {
    return this.tenants.findAll();
  }
}
