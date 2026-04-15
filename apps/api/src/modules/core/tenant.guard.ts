import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const authContext = await this.auth.getRequestContext(req);
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
