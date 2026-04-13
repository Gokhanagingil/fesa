import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantService } from '../tenant/tenant.service';

/**
 * Resolves which tenant a request operates on.
 * Production: expect JWT/subdomain later; for now explicit X-Tenant-Id or DEV_TENANT_ID / first tenant.
 */
@Injectable()
export class TenantContextService {
  constructor(
    private readonly config: ConfigService,
    private readonly tenants: TenantService,
  ) {}

  async resolveTenantId(headerTenantId?: string): Promise<string> {
    const trimmed = headerTenantId?.trim();
    if (trimmed) {
      const t = await this.tenants.findById(trimmed);
      if (!t) {
        throw new NotFoundException(`Unknown tenant id: ${trimmed}`);
      }
      return t.id;
    }

    const devId = this.config.get<string>('DEV_TENANT_ID');
    if (devId) {
      const t = await this.tenants.findById(devId);
      if (t) return t.id;
    }

    const all = await this.tenants.findAll();
    if (all.length === 0) {
      throw new BadRequestException(
        'No tenants in database. Seed a tenant or send X-Tenant-Id.',
      );
    }
    return all[0].id;
  }
}
