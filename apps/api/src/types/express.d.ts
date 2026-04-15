import 'express';

declare global {
  namespace Express {
    interface Request {
      /** Resolved tenant for the request (set by TenantGuard). */
      tenantId?: string;
      staffUserId?: string;
      staffSessionId?: string;
      staffSessionToken?: string;
      staffPlatformRole?: 'global_admin' | 'standard';
      guardianPortalAccessId?: string;
      guardianId?: string;
      portalSessionId?: string;
      guardianPortalSessionToken?: string;
    }
  }
}

export {};
