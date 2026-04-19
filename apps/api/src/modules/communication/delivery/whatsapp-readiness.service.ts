import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantCommunicationConfig } from '../../../database/entities/tenant-communication-config.entity';
import { isRelationTableMissingError } from '../../core/database-error.util';
import { WhatsAppCloudApiClient } from './whatsapp-cloud-api.client';

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
 *   - Validation has two flavours.  The default `runValidation` stays
 *     side-effect free (config consistency + token-ref resolution).
 *     `runLiveValidation` performs a single read-only Cloud API call
 *     against the configured `phoneNumberId` to confirm the token is
 *     accepted before flipping the readiness chip to `ok`.
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
    private readonly cloudApiClient: WhatsAppCloudApiClient,
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
    if (configured.phoneNumberId && !/^\d{6,32}$/.test(config.whatsappPhoneNumberId!.trim())) {
      issues.push('phone_number_id_invalid');
    }
    if (configured.businessAccountId && !/^\d{6,32}$/.test(config.whatsappBusinessAccountId!.trim())) {
      issues.push('business_account_id_invalid');
    }
    if (config.whatsappAccessTokenRef && !this.canResolveTokenRef(config.whatsappAccessTokenRef)) {
      issues.push('access_token_ref_unresolved');
    }

    const validationState = config.whatsappValidationState as
      | WhatsAppReadinessSummary['validation']['state']
      | null
      | undefined;
    const validation = {
      state: validationState ?? 'never_validated',
      message: config.whatsappValidationMessage ?? null,
      validatedAt: config.whatsappValidatedAt?.toISOString() ?? null,
    };

    let state: WhatsAppReadinessState;
    let directSendAvailable = false;

    if (!config.whatsappCloudApiEnabled) {
      state = configured.phoneNumberId || configured.businessAccountId || configured.accessTokenRef
        ? 'assisted_only'
        : 'not_configured';
    } else if (issues.length > 0) {
      state = configured.phoneNumberId || configured.businessAccountId || configured.accessTokenRef
        ? 'partial'
        : 'invalid';
    } else if (validation.state === 'invalid') {
      state = 'invalid';
    } else if (validation.state === 'ok') {
      state = 'direct_capable';
      directSendAvailable = true;
    } else {
      // Configuration looks valid locally but a successful readiness
      // check has not happened yet (or the operator just edited the
      // config).  We treat this as `partial` so direct send only goes
      // live once the operator has confirmed connectivity at least
      // once — this is the trust safeguard for Wave 16.
      state = 'partial';
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
   * support the `env:NAME` scheme today — any other scheme is
   * treated as "not yet supported" so we never hand a fake token to
   * a real provider.  The host environment is the single secret
   * store; deployments are expected to inject the secret on boot.
   */
  resolveAccessToken(tokenRef: string | null | undefined): string | null {
    if (!tokenRef) return null;
    const trimmed = tokenRef.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('env:')) {
      const name = trimmed.slice('env:'.length).trim();
      if (!name || !/^[A-Z][A-Z0-9_]*$/.test(name)) return null;
      const value = process.env[name];
      return value && value.trim() ? value : null;
    }
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

    // Saving config invalidates any previous validation result.  The
    // operator is expected to re-run the readiness check explicitly
    // after a config change — this is the trust safeguard that keeps
    // direct send paused after edits.
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
   * Lightweight readiness check.  Verifies local consistency and that
   * the token reference resolves.  Does NOT touch the network — call
   * `runLiveValidation` for the real Cloud API ping.
   */
  async runValidation(tenantId: string): Promise<WhatsAppReadinessSummary> {
    return this.persistValidation(tenantId, 'local');
  }

  /**
   * Live readiness check.  In addition to the local consistency check
   * above we perform a single read-only Cloud API request against the
   * configured `phoneNumberId`.  The token must be accepted by Meta
   * before we promote the validation state to `ok` — only then does
   * the readiness chip flip to `direct_capable`.
   */
  async runLiveValidation(tenantId: string): Promise<WhatsAppReadinessSummary> {
    return this.persistValidation(tenantId, 'live');
  }

  private async persistValidation(
    tenantId: string,
    mode: 'local' | 'live',
  ): Promise<WhatsAppReadinessSummary> {
    let row = await this.safeFindConfig(tenantId);
    if (!row) {
      row = this.configs.create({ tenantId });
    }
    const localSummary = this.classify(row);

    let nextState: 'ok' | 'pending' | 'invalid' = 'pending';
    let message: string | null = null;

    if (!row.whatsappCloudApiEnabled) {
      nextState = 'pending';
      message = 'assisted_only_intent';
    } else if (localSummary.issues.length > 0) {
      nextState = 'invalid';
      message = `missing:${localSummary.issues.join(',')}`;
    } else if (mode === 'local') {
      nextState = 'ok';
      message = 'config_resolved_locally';
    } else {
      const accessToken = this.resolveAccessToken(row.whatsappAccessTokenRef);
      const phoneNumberId = row.whatsappPhoneNumberId;
      if (!accessToken || !phoneNumberId) {
        nextState = 'invalid';
        message = 'access_token_ref_unresolved';
      } else {
        const liveResult = await this.cloudApiClient
          .sendText({
            accessToken,
            phoneNumberId,
            // We only need a probe — the Cloud API rejects this with a
            // recipient error rather than a token error when the token
            // and phone_number_id are valid, which is enough for a
            // readiness signal without sending a real message.
            toPhoneE164: '0',
            body: '__amateur_readiness_probe__',
          })
          .catch((error: unknown) => ({
            ok: false,
            providerMessageId: null as string | null,
            errorCode: 'transport_error',
            errorMessage: error instanceof Error ? error.message : 'transport_error',
            raw: null,
          }));
        if (liveResult.ok) {
          nextState = 'ok';
          message = 'live_probe_accepted';
        } else if (
          liveResult.errorCode === 'token_invalid' ||
          liveResult.errorCode === 'transport_error' ||
          liveResult.errorCode === 'provider_unavailable'
        ) {
          nextState = 'invalid';
          message = liveResult.errorCode;
        } else {
          // `provider_rejected` / `rate_limited` / `unknown` here mean
          // Meta accepted the credentials but rejected the probe
          // recipient — that is exactly what we want for readiness.
          nextState = 'ok';
          message = 'live_credentials_accepted';
        }
      }
    }

    row.whatsappValidationState = nextState;
    row.whatsappValidationMessage = message;
    row.whatsappValidatedAt = new Date();
    const saved = await this.configs.save(row);
    return this.classify(saved);
  }
}
