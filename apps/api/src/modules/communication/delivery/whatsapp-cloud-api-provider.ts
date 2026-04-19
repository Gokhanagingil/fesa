import { Injectable, Logger } from '@nestjs/common';
import {
  DeliveryChannel,
  DeliveryProvider,
  DeliveryRequest,
  DeliveryResult,
  ProviderCapability,
} from './types';
import { WhatsAppReadinessService } from './whatsapp-readiness.service';

/**
 * WhatsAppCloudApiProvider
 * ------------------------
 * Provider stub for the WhatsApp Cloud API (Meta).
 *
 * In the WhatsApp Integration Readiness pack we deliberately do NOT
 * call `graph.facebook.com`.  The work in this wave is to make the
 * architecture honest, not to claim live delivery.  When a real
 * integration ships, only the `attemptCloudApiSend()` body needs to
 * change — the contract above stays the same.
 *
 * Behaviour today:
 *   - `capability()` reports `direct_capable` only when the readiness
 *     service confirms the tenant has resolvable config.
 *   - `deliver()` returns `failed` with a calm `provider_not_live` detail
 *     so the caller can transition to the assisted fallback honestly.
 *
 * When the live implementation lands, the only behavioural change is
 * inside `attemptCloudApiSend`, which can flip recipients to `sent`
 * with a real `providerMessageId`.
 */
@Injectable()
export class WhatsAppCloudApiProvider implements DeliveryProvider {
  private readonly logger = new Logger(WhatsAppCloudApiProvider.name);

  readonly key = 'whatsapp_cloud_api';
  readonly mode = 'direct' as const;

  constructor(private readonly readiness: WhatsAppReadinessService) {}

  async capability(tenantId: string, channel: DeliveryChannel): Promise<ProviderCapability> {
    if (channel !== 'whatsapp') {
      return {
        provider: this.key,
        mode: 'direct',
        channels: [],
        state: 'not_configured',
        message: 'channel_not_supported',
      };
    }
    const summary = await this.readiness.getSummary(tenantId);
    return {
      provider: this.key,
      mode: 'direct',
      channels: ['whatsapp'],
      state:
        summary.state === 'direct_capable'
          ? 'direct_capable'
          : summary.state === 'partial'
            ? 'partial'
            : summary.state === 'invalid'
              ? 'invalid'
              : summary.state === 'assisted_only'
                ? 'assisted_only'
                : 'not_configured',
      message: summary.issues[0] ?? null,
    };
  }

  async deliver(request: DeliveryRequest): Promise<DeliveryResult> {
    const startedAt = new Date();
    const resolved = await this.readiness.getResolvedConfig(request.tenantId);
    if (!resolved.summary.directSendAvailable || !resolved.accessToken || !resolved.phoneNumberId) {
      return this.failedResult(request, startedAt, 'cloud_api_not_ready');
    }
    return this.attemptCloudApiSend(request, startedAt, {
      accessToken: resolved.accessToken,
      phoneNumberId: resolved.phoneNumberId,
    });
  }

  /**
   * Real Cloud API call lives here in a future wave.  Until then we
   * return a calm, honest failure so the application layer can degrade
   * to assisted mode without ever lying to the operator.
   */
  private async attemptCloudApiSend(
    request: DeliveryRequest,
    startedAt: Date,
    _ctx: { accessToken: string; phoneNumberId: string },
  ): Promise<DeliveryResult> {
    this.logger.debug(
      `WhatsApp Cloud API direct send is not yet wired up; returning honest 'provider_not_live' for tenant ${request.tenantId}`,
    );
    return this.failedResult(request, startedAt, 'provider_not_live');
  }

  private failedResult(request: DeliveryRequest, startedAt: Date, detail: string): DeliveryResult {
    const completedAt = new Date();
    return {
      provider: this.key,
      mode: 'direct',
      state: 'failed',
      attemptedAt: startedAt,
      completedAt,
      detail,
      recipients: request.recipients.map((recipient) => ({
        athleteId: recipient.athleteId,
        guardianId: recipient.guardianId,
        state: 'failed',
        providerMessageId: null,
        detail,
      })),
    };
  }
}
