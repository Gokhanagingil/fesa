import 'express';

declare global {
  namespace Express {
    interface Request {
      /** Resolved tenant for the request (set by TenantGuard). */
      tenantId?: string;
      guardianPortalAccessId?: string;
      guardianId?: string;
      portalSessionId?: string;
      guardianPortalSessionToken?: string;
    }
  }
}

export {};
