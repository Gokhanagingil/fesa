import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';

@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const session = await this.auth.getRequestContext(req);

    req.staffUserId = session.profile.user.id;
    req.staffSessionId = session.sessionId;
    req.staffSessionToken = session.sessionToken;
    req.staffPlatformRole = session.profile.user.platformRole;

    return true;
  }
}
