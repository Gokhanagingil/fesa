import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const auth = this.moduleRef.get(AuthService, { strict: false });
    if (!auth) {
      throw new Error('AuthService is not available for TenantGuard');
    }
    const authContext = await auth.getRequestContext(req);
    const header =
      (req.headers['x-tenant-id'] as string | undefined) ??
      (req.headers['X-Tenant-Id'] as string | undefined);

    const tenantId = await this.tenantContext.resolveTenantIdForProfile(
      header,
      authContext.profile,
    );

    req.staffUserId = authContext.profile.user.id;
    req.staffSessionId = authContext.sessionId;
    req.staffSessionToken = authContext.sessionToken;
    req.staffPlatformRole = authContext.profile.user.platformRole;
    req.tenantId = tenantId;
    return true;
  }
}
