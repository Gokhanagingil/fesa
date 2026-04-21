import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { StaffPlatformRole } from '../../database/enums';

/**
 * Billing & Licensing Foundation v1 — platform admin guard.
 *
 * Wraps `StaffAuthGuard` semantics with a hard role check so the
 * Billing & Licensing surface is reachable only by `global_admin`
 * staff users. Tenant admins and standard staff hit a 403 immediately,
 * which keeps the commercial control plane sealed at the boundary.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const session = await this.auth.getRequestContext(req);
    if (session.profile.user.platformRole !== StaffPlatformRole.GLOBAL_ADMIN) {
      throw new ForbiddenException('Platform admin access is required');
    }
    req.staffUserId = session.profile.user.id;
    req.staffSessionId = session.sessionId;
    req.staffSessionToken = session.sessionToken;
    req.staffPlatformRole = session.profile.user.platformRole;
    return true;
  }
}
