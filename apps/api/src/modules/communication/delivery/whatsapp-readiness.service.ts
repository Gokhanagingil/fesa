import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantCommunicationConfig } from '../../../database/entities/tenant-communication-config.entity';
import { isRelationTableMissingError } from '../../core/database-error.util';

export type WhatsAppReadinessState =
  | 'not_configured'
  | 'assisted_only'
  | 'partial'
  | 'direct_capable'
  | 'invalid';

export type WhatsAppReadinessSummary = {
  state: WhatsAppReadinessState;
  /**
   * True when direct delivery via the WhatsApp Cloud API can be
   * attempted right now.  False for every other state.
   */
  directSendAvailable: boolean;
  /**
   * Operator intent — what the tenant said they want, regardless of
   * whether the configuration is valid.  Used to differentiate
   * `assisted_only` (intentional) from `not_configured` (silent).
   */
  cloudApiEnabled: boolean;
  configured: {
    phoneNumberId: boolean;
    businessAccountId: boolean;
    accessTokenRef: boolean;
  };
  displayPhoneNumber: string | null;
  validation: {
    state: 'ok' | 'pending' | 'invalid' | 'never_validated';
    message: string | null;
    validatedAt: string | null;
  };
  /**
   * Short list of human-readable issues blocking direct send.  Empty
   * when `directSendAvailable === true`.
   */
  issues: string[];
};

export type SaveReadinessInput = {
  cloudApiEnabled?: boolean;
  phoneNumberId?: string | null;
  businessAccountId?: string | null;
  accessTokenRef?: string | null;
  displayPhoneNumber?: string | null;
};

const DEFAULT_SUMMARY: WhatsAppReadinessSummary = {
  state: 'not_configured',
  directSendAvailable: false,
  cloudApiEnabled: false,
  configured: { phoneNumberId: false, businessAccountId: false, accessTokenRef: false },
  displayPhoneNumber: null,
  validation: { state: 'never_validated', message: null, validatedAt: null },
  issues: ['no_config_row'],
};

/**
 * WhatsAppReadinessService
 * ------------------------
 * Single source of truth for "can this tenant send WhatsApp directly?"
 *
 * Notes on design discipline:
 *   - We never store the access token itself; only an opaque reference
 *     (eg. `env:WHATSAPP_CLOUD_API_TOKEN`) so secret material stays in
 *     the host environment.
 *   - "Validation" is a placeholder hook: in the readiness pack it
 *     returns `pending` until a real Cloud API ping is implemented.
 *   - All operations are tenant-scoped through the explicit `tenantId`
 *     parameter; the controller is responsible for sourcing it from
 *     `TenantGuard`.
 */
@Injectable()
export class WhatsAppReadinessService {
  private readonly logger = new Logger(WhatsAppReadinessService.name);

  constructor(
    @InjectRepository(TenantCommunicationConfig)
    private readonly configs: Repository<TenantCommunicationConfig>,
  ) {}

  private async safeFindConfig(tenantId: string): Promise<TenantCommunicationConfig | null> {
    try {
      return await this.configs.findOne({ where: { tenantId } });
    } catch (error) {
      if (isRelationTableMissingError(error)) {
        return null;
      }
      throw error;
    }
  }

  private classify(config: TenantCommunicationConfig | null): WhatsAppReadinessSummary {
    if (!config) {
      return DEFAULT_SUMMARY;
    }
    const configured = {
      phoneNumberId: Boolean(config.whatsappPhoneNumberId?.trim()),
      businessAccountId: Boolean(config.whatsappBusinessAccountId?.trim()),
      accessTokenRef: Boolean(config.whatsappAccessTokenRef?.trim()),
    };
    const issues: string[] = [];
    if (!configured.phoneNumberId) issues.push('missing_phone_number_id');
    if (!configured.businessAccountId) issues.push('missing_business_account_id');
    if (!configured.accessTokenRef) issues.push('missing_access_token_ref');
    if (config.whatsappAccessTokenRef && !this.canResolveTokenRef(config.whatsappAccessTokenRef)) {
      issues.push('access_token_ref_unresolved');
    }

    const validation = {
      state: (config.whatsappValidationState as WhatsAppReadinessSummary['validation']['state']) ?? 'never_validated',
      message: config.whatsappValidationMessage ?? null,
      validatedAt: config.whatsappValidatedAt?.toISOString() ?? null,
    };

    let state: WhatsAppReadinessState;
    let directSendAvailable = false;

    if (!config.whatsappCloudApiEnabled) {
      // Operator has explicitly chosen assisted-only.
      state = configured.phoneNumberId || configured.businessAccountId || configured.accessTokenRef
        ? 'assisted_only'
        : 'not_configured';
    } else if (issues.length > 0) {
      state = configured.phoneNumberId || configured.businessAccountId || configured.accessTokenRef
        ? 'partial'
        : 'invalid';
    } else if (validation.state === 'invalid') {
      state = 'invalid';
    } else {
      state = 'direct_capable';
      directSendAvailable = true;
    }

    return {
      state,
      directSendAvailable,
      cloudApiEnabled: config.whatsappCloudApiEnabled,
      configured,
      displayPhoneNumber: config.whatsappDisplayPhoneNumber ?? null,
      validation,
      issues,
    };
  }

  /**
   * Resolve an access-token reference to a real value.  We only
   * support the `env:NAME` scheme in the readiness pack — any other
   * scheme is treated as "not yet supported" so we never hand a fake
   * token to a real provider.
   */
  resolveAccessToken(tokenRef: string | null | undefined): string | null {
    if (!tokenRef) return null;
    const trimmed = tokenRef.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('env:')) {
      const name = trimmed.slice('env:'.length).trim();
      if (!name) return null;
      const value = process.env[name];
      return value && value.trim() ? value : null;
    }
    // Future: secret-manager:// schemes plug in here.
    return null;
  }

  private canResolveTokenRef(tokenRef: string | null | undefined): boolean {
    if (!tokenRef) return false;
    if (!tokenRef.startsWith('env:')) return false;
    return Boolean(this.resolveAccessToken(tokenRef));
  }

  async getSummary(tenantId: string): Promise<WhatsAppReadinessSummary> {
    const config = await this.safeFindConfig(tenantId);
    return this.classify(config);
  }

  async getResolvedConfig(
    tenantId: string,
  ): Promise<{
    summary: WhatsAppReadinessSummary;
    phoneNumberId: string | null;
    accessToken: string | null;
  }> {
    const config = await this.safeFindConfig(tenantId);
    const summary = this.classify(config);
    return {
      summary,
      phoneNumberId: config?.whatsappPhoneNumberId ?? null,
      accessToken: this.resolveAccessToken(config?.whatsappAccessTokenRef ?? null),
    };
  }

  async saveSummary(
    tenantId: string,
    input: SaveReadinessInput,
  ): Promise<WhatsAppReadinessSummary> {
    let row = await this.safeFindConfig(tenantId);
    if (!row) {
      row = this.configs.create({ tenantId });
    }

    if (typeof input.cloudApiEnabled === 'boolean') {
      row.whatsappCloudApiEnabled = input.cloudApiEnabled;
    }
    if (input.phoneNumberId !== undefined) {
      row.whatsappPhoneNumberId = input.phoneNumberId?.trim() || null;
    }
    if (input.businessAccountId !== undefined) {
      row.whatsappBusinessAccountId = input.businessAccountId?.trim() || null;
    }
    if (input.accessTokenRef !== undefined) {
      row.whatsappAccessTokenRef = input.accessTokenRef?.trim() || null;
    }
    if (input.displayPhoneNumber !== undefined) {
      row.whatsappDisplayPhoneNumber = input.displayPhoneNumber?.trim() || null;
    }

    // Saving config invalidates the previous validation result; the
    // operator is expected to re-run the readiness check explicitly.
    if (
      input.phoneNumberId !== undefined ||
      input.businessAccountId !== undefined ||
      input.accessTokenRef !== undefined ||
      input.cloudApiEnabled !== undefined
    ) {
      row.whatsappValidationState = 'never_validated';
      row.whatsappValidationMessage = null;
      row.whatsappValidatedAt = null;
    }

    const saved = await this.configs.save(row);
    return this.classify(saved);
  }

  /**
   * Light readiness check.  We deliberately avoid making a live Cloud
   * API request here — that would couple the readiness pack to a live
   * Meta endpoint we are not yet integrated with.  Instead we verify
   * the tenant has consistent local config and that the token
   * reference resolves.  Anything more is left to a future wave.
   */
  async runValidation(tenantId: string): Promise<WhatsAppReadinessSummary> {
    let row = await this.safeFindConfig(tenantId);
    if (!row) {
      row = this.configs.create({ tenantId });
    }
    const summary = this.classify(row);
    let nextState: 'ok' | 'pending' | 'invalid' = 'pending';
    let message: string | null = null;
    if (!row.whatsappCloudApiEnabled) {
      nextState = 'pending';
      message = 'assisted_only_intent';
    } else if (summary.issues.length > 0) {
      nextState = 'invalid';
      message = `missing:${summary.issues.join(',')}`;
    } else {
      nextState = 'ok';
      message = 'config_resolved_locally';
    }
    row.whatsappValidationState = nextState;
    row.whatsappValidationMessage = message;
    row.whatsappValidatedAt = new Date();
    const saved = await this.configs.save(row);
    return this.classify(saved);
  }
}
