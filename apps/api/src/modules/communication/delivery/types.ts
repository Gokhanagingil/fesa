/**
 * Provider-ready delivery types for the WhatsApp Integration Readiness
 * pack.  Kept intentionally small: the goal is a clean seam between the
 * follow-up application logic and any future direct-send provider, NOT
 * a generic messaging framework.
 */

export type DeliveryChannel = 'whatsapp' | 'phone' | 'email' | 'manual';

/** Honest "how was this attempted" classification. */
export type DeliveryMode = 'assisted' | 'direct';

/**
 * Honest "what actually happened" classification.  The vocabulary is
 * tiny on purpose — operators see this language verbatim in history.
 *
 *  - `prepared` — assisted draft is ready (no real send happened).
 *  - `sent`     — direct send succeeded.
 *  - `failed`   — direct send was attempted and failed.
 *  - `fallback` — direct send was attempted, failed, and the operator
 *    (or auto-fallback) used the assisted path instead.
 */
export type DeliveryState = 'prepared' | 'sent' | 'failed' | 'fallback';

export type DeliveryRecipient = {
  athleteId: string;
  athleteName: string;
  guardianId: string | null;
  guardianName: string | null;
  /** E.164-ish phone for whatsapp/phone channels. May be null. */
  phone: string | null;
  /** Address for the email channel. May be null. */
  email: string | null;
  /** Personalised message body for this recipient. */
  message: string;
  /** Email subject (only used when channel === 'email'). */
  subject?: string | null;
};

export type DeliveryRequest = {
  tenantId: string;
  channel: DeliveryChannel;
  topic: string;
  /** Recipients pre-personalised by the application layer. */
  recipients: DeliveryRecipient[];
};

export type DeliveryRecipientResult = {
  athleteId: string;
  guardianId: string | null;
  /** Per-recipient outcome.  Always one of `sent` / `failed`. */
  state: 'sent' | 'failed';
  providerMessageId: string | null;
  /** Short, operator-friendly note ("Token rejected", "Delivered"). */
  detail: string | null;
};

export type DeliveryResult = {
  /** Provider key (`whatsapp_cloud_api`, `assisted_whatsapp`, …). */
  provider: string;
  mode: DeliveryMode;
  /** Aggregate outcome rolled up from `recipients`. */
  state: DeliveryState;
  /** When the attempt started.  Always present. */
  attemptedAt: Date;
  /** When the attempt completed.  Present for terminal states. */
  completedAt: Date | null;
  /** Aggregate operator-friendly detail line. */
  detail: string | null;
  recipients: DeliveryRecipientResult[];
};

/**
 * Capability descriptor returned by a provider when it is asked
 * whether it can handle a given tenant + channel.  Honest by design —
 * `direct_capable` MUST imply the provider has everything it needs to
 * attempt a real send.
 */
export type ProviderCapability = {
  provider: string;
  mode: DeliveryMode;
  /** Channels the provider can handle for this tenant right now. */
  channels: DeliveryChannel[];
  /**
   * Readiness state for the *direct* mode for this provider.  Assisted
   * providers always return `assisted_only` here.
   */
  state: 'direct_capable' | 'partial' | 'assisted_only' | 'not_configured' | 'invalid';
  /** Optional human-readable message for the readiness UI. */
  message: string | null;
};

/**
 * Provider contract.  Kept intentionally minimal:
 *
 *  - `key`          — stable identifier persisted on outreach rows.
 *  - `capability()` — declares what the provider can do for a tenant.
 *  - `deliver()`    — performs (or simulates) the actual send.
 *
 * Providers are pure: they never read tenant config directly.  The
 * `CommunicationDeliveryService` resolves capabilities once and routes
 * a single request to the most appropriate provider.
 */
export interface DeliveryProvider {
  readonly key: string;
  readonly mode: DeliveryMode;

  capability(tenantId: string, channel: DeliveryChannel): Promise<ProviderCapability>;

  deliver(request: DeliveryRequest): Promise<DeliveryResult>;
}
