import { Injectable } from '@nestjs/common';
import {
  DeliveryChannel,
  DeliveryProvider,
  DeliveryRequest,
  DeliveryResult,
  ProviderCapability,
} from './types';

/**
 * AssistedDeliveryProvider
 * ------------------------
 * The historical "we prepare a wa.me deep link for the operator"
 * behaviour, expressed as a first-class provider so the rest of the
 * system can reason about it uniformly.
 *
 * `deliver()` here never claims to have *sent* anything — it only
 * records that the message is ready to be opened by the operator.
 * That is what makes the assisted path safe to leave in place
 * permanently as a fallback.
 */
@Injectable()
export class AssistedDeliveryProvider implements DeliveryProvider {
  readonly key = 'assisted_whatsapp';
  readonly mode = 'assisted' as const;

  async capability(_tenantId: string, channel: DeliveryChannel): Promise<ProviderCapability> {
    return {
      provider: this.key,
      mode: 'assisted',
      channels: [channel],
      state: 'assisted_only',
      message: null,
    };
  }

  async deliver(request: DeliveryRequest): Promise<DeliveryResult> {
    const now = new Date();
    return {
      provider: this.key,
      mode: 'assisted',
      state: 'prepared',
      attemptedAt: now,
      completedAt: now,
      detail: 'assisted_deep_link_prepared',
      recipients: request.recipients.map((recipient) => ({
        athleteId: recipient.athleteId,
        guardianId: recipient.guardianId,
        state: 'sent',
        providerMessageId: null,
        detail: 'prepared_for_operator',
      })),
    };
  }
}
