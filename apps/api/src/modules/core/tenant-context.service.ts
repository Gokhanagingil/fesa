import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantService } from '../tenant/tenant.service';
import type { AuthSessionProfile } from '../auth/auth.service';
import { StaffPlatformRole } from '../../database/enums';

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

  async resolveTenantIdForProfile(
    headerTenantId: string | undefined,
    profile: AuthSessionProfile,
  ): Promise<string> {
    const trimmed = headerTenantId?.trim();
    const accessibleTenantIds = new Set(profile.accessibleTenants.map((tenant) => tenant.id));

    if (profile.user.platformRole === StaffPlatformRole.GLOBAL_ADMIN) {
      if (trimmed) {
        const tenant = await this.tenants.findById(trimmed);
        if (!tenant) {
          throw new NotFoundException(`Unknown tenant id: ${trimmed}`);
        }
        return tenant.id;
      }

      if (profile.defaultTenantId) {
        return profile.defaultTenantId;
      }

      if (profile.accessibleTenants[0]) {
        return profile.accessibleTenants[0].id;
      }

      const all = await this.tenants.findAll();
      if (all.length === 0) {
        throw new BadRequestException('No tenants are available for platform administration.');
      }

      return all[0].id;
    }

    if (accessibleTenantIds.size === 0) {
      throw new ForbiddenException('No tenant membership is assigned to this account.');
    }

    if (trimmed) {
      if (!accessibleTenantIds.has(trimmed)) {
        throw new ForbiddenException('This tenant is outside the current account scope.');
      }
      return trimmed;
    }

    return profile.defaultTenantId ?? profile.accessibleTenants[0].id;
  }
}
