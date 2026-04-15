import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { GuardianPortalService } from './guardian-portal.service';

@Injectable()
export class GuardianPortalGuard implements CanActivate {
  constructor(private readonly guardianPortal: GuardianPortalService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const token = this.guardianPortal.readSessionToken(req);
    if (!token) {
      throw new UnauthorizedException('Guardian portal session is required');
    }

    const session = await this.guardianPortal.getSessionContext(token);
    req.tenantId = session.tenantId;
    req.guardianPortalAccessId = session.accessId;
    req.guardianId = session.guardianId;
    req.portalSessionId = session.sessionId;
    req.guardianPortalSessionToken = token;
    return true;
  }
}
