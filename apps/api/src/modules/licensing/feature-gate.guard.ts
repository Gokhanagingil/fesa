import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { LicenseFeatureKey } from './license.constants';
import { LicensingService } from './licensing.service';

/**
 * Wave 23 — Billing & Licensing Operationalization Pack v1.
 *
 * Generic feature gate guard. Other modules apply this *after*
 * `TenantGuard` (so `req.tenantId` is populated) and pair it with
 * {@link RequireFeature} on the route or controller class.
 *
 * Why this exists:
 *   - Centralises every commercial gate behind LicensingService — no
 *     scattered `if (plan === 'starter')` checks anywhere in the API.
 *   - Returns a structured 403 payload (`reason`, `featureKey`) so the
 *     web client can render calm, accurate copy ("Available on
 *     Operations / Growth", "Trial expired", etc.) instead of a raw
 *     "Forbidden".
 *
 * Failure mode is `ForbiddenException` for tenant requests; that
 * matches platform-admin guard semantics already used elsewhere.
 */
export const FEATURE_GATE_KEY = 'licensing:featureKey';

export const RequireFeature = (featureKey: LicenseFeatureKey) =>
  SetMetadata(FEATURE_GATE_KEY, featureKey);

@Injectable()
export class FeatureGateGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly licensing: LicensingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const featureKey = this.reflector.getAllAndOverride<LicenseFeatureKey | undefined>(
      FEATURE_GATE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!featureKey) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const tenantId = req.tenantId;
    if (!tenantId) {
      throw new ForbiddenException({
        message: 'Tenant context is required for this capability.',
        featureKey,
        reason: 'no_tenant_context',
      });
    }

    const reason = await this.licensing.getFeatureUnavailableReason(tenantId, featureKey);
    if (!reason) return true;
    throw new ForbiddenException({
      message: 'Feature is not available on the current license.',
      featureKey,
      reason: reason.reason,
    });
  }
}
