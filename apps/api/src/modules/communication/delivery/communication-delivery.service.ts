import { Injectable, Logger } from '@nestjs/common';
import { AssistedDeliveryProvider } from './assisted-provider';
import {
  DeliveryChannel,
  DeliveryMode,
  DeliveryRequest,
  DeliveryResult,
  DeliveryState,
  ProviderCapability,
} from './types';
import { WhatsAppCloudApiProvider } from './whatsapp-cloud-api-provider';
import { WhatsAppReadinessService } from './whatsapp-readiness.service';

export type ResolvedDeliveryPlan = {
  /**
   * Mode the system thinks it can attempt for this tenant + channel
   * right now.  `direct` only when a configured provider says so.
   */
  preferredMode: DeliveryMode;
  /**
   * The fallback mode if the preferred mode fails.  Almost always
   * `assisted`.  Null when no fallback is appropriate (eg. no
   * recipients).
   */
  fallbackMode: DeliveryMode | null;
  /** Capability of every provider, surfaced for the UX layer. */
  capabilities: ProviderCapability[];
};

/**
 * CommunicationDeliveryService
 * ----------------------------
 * Application-layer orchestrator on top of the provider abstraction.
 *
 * Responsibilities:
 *   - report the *plan* for a given tenant + channel (used by the UX
 *     to render the assisted-vs-direct mode badge),
 *   - run a single delivery attempt with auto-fallback to assisted
 *     when direct fails.
 *
 * The orchestrator is intentionally thin.  It never reads the database
 * directly; readiness queries go through `WhatsAppReadinessService`,
 * recipient/audience hydration stays inside `OutreachService`.
 *
 * Wave 16 honest-state semantics:
 *   - `sent`     — every recipient confirmed by the provider
 *   - `sent` with `partial_sent:` detail — at least one delivered
 *     (failed recipients are still listed per-recipient so the UX can
 *     offer assisted follow-up for the gaps).
 *   - `failed`   — no recipient delivered, no fallback used
 *   - `fallback` — direct attempt failed end-to-end and the assisted
 *     deep-link was prepared instead.
 */
@Injectable()
export class CommunicationDeliveryService {
  private readonly logger = new Logger(CommunicationDeliveryService.name);

  constructor(
    private readonly readiness: WhatsAppReadinessService,
    private readonly assisted: AssistedDeliveryProvider,
    private readonly whatsappCloudApi: WhatsAppCloudApiProvider,
  ) {}

  async planFor(tenantId: string, channel: DeliveryChannel): Promise<ResolvedDeliveryPlan> {
    const capabilities = await this.gatherCapabilities(tenantId, channel);
    const direct = capabilities.find((cap) => cap.mode === 'direct' && cap.state === 'direct_capable');
    return {
      preferredMode: direct ? 'direct' : 'assisted',
      fallbackMode: direct ? 'assisted' : null,
      capabilities,
    };
  }

  /**
   * Attempt delivery using the operator-requested mode, falling back
   * to assisted when direct fails end-to-end.  Aggregate state stays
   * honest:
   *   - direct + at least one delivered → `sent` (partial detail kept)
   *   - direct + all failed             → assisted attempt → `fallback`
   *   - direct unavailable              → assisted attempt → `fallback`
   *   - assisted only                   → `prepared`
   */
  async deliver(
    requestedMode: DeliveryMode,
    request: DeliveryRequest,
  ): Promise<DeliveryResult> {
    if (request.recipients.length === 0) {
      const now = new Date();
      return {
        provider: this.assisted.key,
        mode: 'assisted',
        state: 'prepared',
        attemptedAt: now,
        completedAt: now,
        detail: 'no_recipients',
        recipients: [],
      };
    }
    if (requestedMode === 'direct' && request.channel === 'whatsapp') {
      const directCap = await this.whatsappCloudApi.capability(request.tenantId, request.channel);
      if (directCap.state === 'direct_capable') {
        const directResult = await this.whatsappCloudApi.deliver(request);
        // `sent` covers the all-delivered AND partial-delivered cases.
        // The provider keeps per-recipient outcomes intact so the UX
        // can offer the assisted path for the failed subset without
        // re-classifying the whole row.
        if (directResult.state === 'sent') {
          return directResult;
        }
        const fallback = await this.assisted.deliver(request);
        return {
          ...fallback,
          state: 'fallback' as DeliveryState,
          detail: directResult.detail
            ? `direct_failed:${directResult.detail}`
            : 'direct_failed_assisted_used',
        };
      }
      const fallback = await this.assisted.deliver(request);
      return {
        ...fallback,
        state: 'fallback' as DeliveryState,
        detail: directCap.message ? `direct_unavailable:${directCap.message}` : 'direct_unavailable',
      };
    }
    return this.assisted.deliver(request);
  }

  private async gatherCapabilities(
    tenantId: string,
    channel: DeliveryChannel,
  ): Promise<ProviderCapability[]> {
    const capabilities: ProviderCapability[] = [];
    capabilities.push(await this.assisted.capability(tenantId, channel));
    if (channel === 'whatsapp') {
      capabilities.push(await this.whatsappCloudApi.capability(tenantId, channel));
    }
    return capabilities;
  }
}
