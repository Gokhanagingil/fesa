import { Injectable, Logger } from '@nestjs/common';

/**
 * Lightweight HTTP fetcher seam.  Defaults to the global `fetch` (Node
 * 20+) but can be overridden from tests via Nest dependency injection.
 *
 * We intentionally do NOT pull in a heavy HTTP client library — the
 * Cloud API send path is a single POST per recipient and we want this
 * dependency surface to stay tiny so `WhatsAppCloudApiProvider` is the
 * only seam that future provider replacements need to think about.
 */
export type WhatsAppFetcher = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal },
) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
}>;

export const WHATSAPP_CLOUD_API_FETCHER = Symbol('WHATSAPP_CLOUD_API_FETCHER');

export type WhatsAppSendInput = {
  accessToken: string;
  phoneNumberId: string;
  /** E.164-style recipient phone (digits only, no `+`). */
  toPhoneE164: string;
  /** Free-text body — Cloud API "text" message. */
  body: string;
  /** Optional override (mostly for tests / future preview shards). */
  apiBase?: string;
  /** Optional request timeout in ms.  Defaults to 12 000. */
  timeoutMs?: number;
};

export type WhatsAppSendResult =
  | {
      ok: true;
      providerMessageId: string | null;
      raw: unknown;
    }
  | {
      ok: false;
      providerMessageId: null;
      /** Short, operator-friendly classification ("token_invalid", "rate_limited"). */
      errorCode: string;
      /** One-line human detail, never raw provider JSON. */
      errorMessage: string;
      raw: unknown;
    };

const DEFAULT_API_BASE = 'https://graph.facebook.com/v19.0';
const DEFAULT_TIMEOUT_MS = 12_000;

/**
 * WhatsAppCloudApiClient
 * ----------------------
 * Thin wrapper around the Meta Graph WhatsApp messaging endpoint.
 *
 * Responsibilities:
 *  - call `POST /{phoneNumberId}/messages` once per recipient,
 *  - extract the `wamid.*` provider message id when present,
 *  - classify HTTP/transport failures into a tiny operator-friendly
 *    vocabulary (`token_invalid`, `rate_limited`, `transport_error`,
 *    `provider_rejected`, `unknown`) so the rest of the system never
 *    has to parse Meta error JSON,
 *  - never throw — failures always come back as `{ ok: false, ... }`
 *    so the provider/orchestrator can degrade calmly.
 *
 * The client is injectable so tests can swap a deterministic fetcher
 * via the `WHATSAPP_CLOUD_API_FETCHER` token.
 */
@Injectable()
export class WhatsAppCloudApiClient {
  private readonly logger = new Logger(WhatsAppCloudApiClient.name);
  private readonly fetcher: WhatsAppFetcher;

  constructor(fetcher?: WhatsAppFetcher) {
    this.fetcher =
      fetcher ??
      ((url, init) => {
        const f = (globalThis as { fetch?: WhatsAppFetcher }).fetch;
        if (!f) {
          return Promise.reject(new Error('global fetch is not available in this runtime'));
        }
        return (f as unknown as typeof fetch)(url, init as unknown as RequestInit) as unknown as ReturnType<WhatsAppFetcher>;
      });
  }

  async sendText(input: WhatsAppSendInput): Promise<WhatsAppSendResult> {
    const apiBase = input.apiBase ?? DEFAULT_API_BASE;
    const url = `${apiBase}/${encodeURIComponent(input.phoneNumberId)}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: input.toPhoneE164,
      type: 'text',
      text: { preview_url: false, body: input.body },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    let response: Awaited<ReturnType<WhatsAppFetcher>> | null = null;
    try {
      response = await this.fetcher(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timer);
      const message = error instanceof Error ? error.message : 'transport_error';
      // Aborts read as transport errors; any other thrown error is
      // also classified as a transport problem so the orchestrator
      // can fall back honestly.
      this.logger.warn(`Cloud API transport error for ${maskPhone(input.toPhoneE164)}: ${message}`);
      return {
        ok: false,
        providerMessageId: null,
        errorCode: 'transport_error',
        errorMessage: 'transport_error',
        raw: { message },
      };
    }
    clearTimeout(timer);

    if (response.ok) {
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      const providerMessageId = extractProviderMessageId(body);
      return { ok: true, providerMessageId, raw: body };
    }

    let raw: unknown = null;
    try {
      raw = await response.json();
    } catch {
      try {
        raw = response ? await response.text() : null;
      } catch {
        raw = null;
      }
    }
    const classified = classifyError(response.status, raw);
    this.logger.warn(
      `Cloud API send failed (status=${response.status}, code=${classified.errorCode}) for ${maskPhone(input.toPhoneE164)}`,
    );
    return {
      ok: false,
      providerMessageId: null,
      errorCode: classified.errorCode,
      errorMessage: classified.errorMessage,
      raw,
    };
  }
}

function extractProviderMessageId(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const messages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(messages) || messages.length === 0) return null;
  const first = messages[0] as { id?: unknown };
  return typeof first?.id === 'string' && first.id.trim() ? first.id : null;
}

function classifyError(
  status: number,
  raw: unknown,
): { errorCode: string; errorMessage: string } {
  if (status === 401 || status === 403) {
    return { errorCode: 'token_invalid', errorMessage: 'token_invalid' };
  }
  if (status === 429) {
    return { errorCode: 'rate_limited', errorMessage: 'rate_limited' };
  }
  if (status >= 500) {
    return { errorCode: 'provider_unavailable', errorMessage: 'provider_unavailable' };
  }
  if (status === 400) {
    const code = extractMetaErrorCode(raw);
    if (code) return { errorCode: 'provider_rejected', errorMessage: code };
    return { errorCode: 'provider_rejected', errorMessage: 'provider_rejected' };
  }
  return { errorCode: 'unknown', errorMessage: `http_${status}` };
}

function extractMetaErrorCode(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const error = (raw as { error?: { code?: unknown; type?: unknown; message?: unknown } }).error;
  if (!error) return null;
  if (typeof error.code === 'number' || typeof error.code === 'string') {
    return `meta_${String(error.code)}`;
  }
  if (typeof error.type === 'string' && error.type.trim()) {
    return error.type;
  }
  return null;
}

function maskPhone(value: string): string {
  if (!value) return '';
  if (value.length <= 4) return '***';
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}
