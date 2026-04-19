import { Injectable, Logger } from '@nestjs/common';
import {
  DeliveryChannel,
  DeliveryProvider,
  DeliveryRecipient,
  DeliveryRecipientResult,
  DeliveryRequest,
  DeliveryResult,
  DeliveryState,
  ProviderCapability,
} from './types';
import { WhatsAppCloudApiClient } from './whatsapp-cloud-api.client';
import { WhatsAppReadinessService } from './whatsapp-readiness.service';

/**
 * WhatsAppCloudApiProvider
 * ------------------------
 * Real WhatsApp Cloud API delivery provider.
 *
 * Wave 16 (WhatsApp Cloud API Live Delivery Pack) replaces the v15
 * "honest stub" with an actual HTTP send via `WhatsAppCloudApiClient`.
 * The provider stays disciplined:
 *
 *   - it only attempts a send when readiness reports `direct_capable`
 *     and the access token + phone number id resolve;
 *   - it never throws — every transport / rejection / timeout is
 *     translated into a per-recipient `failed` outcome with a short
 *     calm classification (`token_invalid`, `rate_limited`, …);
 *   - aggregate state is honest:
 *       all sent       → `sent`
 *       all failed     → `failed`
 *       mixed batch    → `sent` with a `partial_sent:<n>_of_<total>` detail
 *         (the orchestrator preserves the assisted fallback option for
 *         the failed subset, but the row itself is *not* a lie — at
 *         least one recipient really was delivered).
 *
 * The provider key (`whatsapp_cloud_api`) and contract surface stay
 * unchanged from v15, so the orchestrator and the persisted
 * `deliveryProvider` column on `outreach_activities` remain stable.
 */
@Injectable()
export class WhatsAppCloudApiProvider implements DeliveryProvider {
  private readonly logger = new Logger(WhatsAppCloudApiProvider.name);

  readonly key = 'whatsapp_cloud_api';
  readonly mode = 'direct' as const;

  constructor(
    private readonly readiness: WhatsAppReadinessService,
    private readonly client: WhatsAppCloudApiClient,
  ) {}

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
   * Perform a live Cloud API send for each recipient and roll the
   * outcomes up into a single honest `DeliveryResult`.
   */
  private async attemptCloudApiSend(
    request: DeliveryRequest,
    startedAt: Date,
    ctx: { accessToken: string; phoneNumberId: string },
  ): Promise<DeliveryResult> {
    const recipientResults: DeliveryRecipientResult[] = [];
    let sentCount = 0;
    let failedCount = 0;
    let firstFailureCode: string | null = null;

    for (const recipient of request.recipients) {
      const phone = normalizePhoneE164(recipient.phone);
      if (!phone) {
        failedCount += 1;
        firstFailureCode = firstFailureCode ?? 'no_phone';
        recipientResults.push({
          athleteId: recipient.athleteId,
          guardianId: recipient.guardianId,
          state: 'failed',
          providerMessageId: null,
          detail: 'no_phone',
        });
        continue;
      }
      const body = recipient.message?.trim();
      if (!body) {
        failedCount += 1;
        firstFailureCode = firstFailureCode ?? 'empty_message';
        recipientResults.push({
          athleteId: recipient.athleteId,
          guardianId: recipient.guardianId,
          state: 'failed',
          providerMessageId: null,
          detail: 'empty_message',
        });
        continue;
      }

      const result = await this.client.sendText({
        accessToken: ctx.accessToken,
        phoneNumberId: ctx.phoneNumberId,
        toPhoneE164: phone,
        body,
      });
      if (result.ok) {
        sentCount += 1;
        recipientResults.push({
          athleteId: recipient.athleteId,
          guardianId: recipient.guardianId,
          state: 'sent',
          providerMessageId: result.providerMessageId,
          detail: result.providerMessageId ? 'delivered' : 'accepted',
        });
      } else {
        failedCount += 1;
        firstFailureCode = firstFailureCode ?? result.errorCode;
        recipientResults.push({
          athleteId: recipient.athleteId,
          guardianId: recipient.guardianId,
          state: 'failed',
          providerMessageId: null,
          detail: result.errorCode,
        });
      }
    }

    const completedAt = new Date();
    const total = recipientResults.length;
    let state: DeliveryState;
    let detail: string;
    if (total === 0) {
      state = 'failed';
      detail = 'no_recipients';
    } else if (sentCount === total) {
      state = 'sent';
      detail = total === 1 ? 'delivered' : `delivered_${sentCount}_of_${total}`;
    } else if (sentCount === 0) {
      state = 'failed';
      detail = firstFailureCode ?? 'cloud_api_failed';
    } else {
      // Honest mixed-batch outcome: at least one delivery really
      // happened so we report `sent`, but the detail makes the partial
      // truth clear and the per-recipient list still carries the
      // failures verbatim for auditability.
      state = 'sent';
      detail = `partial_sent:${sentCount}_of_${total}`;
    }

    if (state === 'failed') {
      this.logger.warn(
        `Cloud API delivery failed for tenant=${request.tenantId} (${failedCount}/${total} recipients failed, code=${firstFailureCode ?? 'unknown'})`,
      );
    }

    return {
      provider: this.key,
      mode: 'direct',
      state,
      attemptedAt: startedAt,
      completedAt,
      detail,
      recipients: recipientResults,
    };
  }

  private failedResult(
    request: DeliveryRequest,
    startedAt: Date,
    detail: string,
  ): DeliveryResult {
    const completedAt = new Date();
    return {
      provider: this.key,
      mode: 'direct',
      state: 'failed',
      attemptedAt: startedAt,
      completedAt,
      detail,
      recipients: request.recipients.map((recipient: DeliveryRecipient) => ({
        athleteId: recipient.athleteId,
        guardianId: recipient.guardianId,
        state: 'failed',
        providerMessageId: null,
        detail,
      })),
    };
  }
}

/**
 * Normalise a stored phone string to the digits-only form Meta expects
 * (no leading `+`, no spaces, no separators).  Returns `null` when the
 * input is missing or has no usable digits.
 */
function normalizePhoneE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned) return null;
  const digits = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
  if (!digits) return null;
  return digits;
}
