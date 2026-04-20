import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Parent Invite Delivery & Access Reliability Pack — invite delivery seam.
 *
 * Discovery surfaced a real trust gap in the parent invite flow: the
 * portal happily issued tokens and persisted invite rows, but no
 * dispatch path actually ran. The staff-facing UI silently implied
 * delivery. This service fixes that by giving the system a single,
 * truthful place to attempt invite delivery and report the outcome.
 *
 * Design discipline:
 *
 *  - Email is the primary channel because the rest of the platform
 *    already collects guardian email and the portal activation page
 *    expects an email-based invite. We use SMTP via nodemailer because
 *    SMTP is the lowest-trust-bar provider every club already has
 *    access to (their own provider, a transactional service, even a
 *    workspace mailbox in dev).
 *  - The service NEVER claims "sent" without a real provider response.
 *    When SMTP is not configured at all we report `unavailable` so the
 *    staff UX can render the truthful "delivery is unavailable, please
 *    share the link manually" path instead of a fake success.
 *  - Secrets stay in the host environment. The service never persists
 *    SMTP credentials anywhere.
 *  - The service is intentionally tiny — it is NOT a notification
 *    platform. The parent activation flow remains the single,
 *    canonical surface that consumes the activation link.
 */
export type InviteDeliveryReadiness = {
  /** True when at least one provider can be attempted right now. */
  available: boolean;
  /** Provider key the system would use ("smtp" today). */
  provider: 'smtp' | 'manual';
  /** Operator-facing summary: `configured` / `not_configured` / `error`. */
  state: 'configured' | 'not_configured' | 'error';
  /** Short message: which env vars are missing, or which test failed. */
  message: string | null;
  /** Friendly "from" address the parent would see, when configured. */
  fromAddress: string | null;
  /** Whether this readiness was confirmed via a live SMTP verify(). */
  verified: boolean;
  /** Last time the live verify() ran, when it ran. */
  verifiedAt: string | null;
};

export type InviteDeliveryAttempt = {
  /**
   * Honest outcome of the attempt.
   *
   *  - `sent`            — provider accepted the message for delivery.
   *  - `failed`          — provider attempted but rejected the message.
   *  - `unavailable`     — no provider configured; manual fallback only.
   */
  state: 'sent' | 'failed' | 'unavailable';
  provider: 'smtp' | 'manual';
  detail: string | null;
  attemptedAt: Date;
  deliveredAt: Date | null;
};

export type InviteDeliveryInput = {
  toEmail: string;
  guardianName: string;
  tenantName: string;
  /** Absolute activation URL (already includes scheme + host). */
  activationUrl: string;
  /**
   * Window the activation link is valid for, in hours. Used in the
   * outgoing copy so the parent knows when to act.
   */
  expiresInHours: number;
  language?: 'en' | 'tr';
};

@Injectable()
export class InviteDeliveryService {
  private readonly logger = new Logger(InviteDeliveryService.name);
  private cachedTransport: Transporter | null = null;
  private cachedTransportSignature: string | null = null;
  private lastVerifiedAt: Date | null = null;
  private lastVerifyOk = false;

  constructor(private readonly config: ConfigService) {}

  /**
   * Resolve the SMTP configuration from the host environment. We only
   * read what is genuinely needed; missing fields fall back to
   * `not_configured` rather than guessed defaults so we never hand a
   * provider half-baked credentials.
   */
  private resolveSmtpConfig(): {
    host: string | null;
    port: number;
    secure: boolean;
    user: string | null;
    pass: string | null;
    from: string | null;
  } {
    const host = (this.config.get<string>('SMTP_HOST') ?? '').trim() || null;
    const portRaw = (this.config.get<string>('SMTP_PORT') ?? '').trim();
    const port = portRaw ? Number.parseInt(portRaw, 10) : 587;
    const secureRaw = (this.config.get<string>('SMTP_SECURE') ?? '').trim().toLowerCase();
    const secure = secureRaw === 'true' || secureRaw === '1' || port === 465;
    const user = (this.config.get<string>('SMTP_USER') ?? '').trim() || null;
    const pass = (this.config.get<string>('SMTP_PASSWORD') ?? '').trim() || null;
    const from = (this.config.get<string>('SMTP_FROM') ?? '').trim() || user;
    return { host, port, secure, user, pass, from };
  }

  /**
   * Public readiness summary the staff UX uses to render the calm
   * "delivery available / delivery unavailable" badge. Read-only and
   * side-effect free — the live verify path is opt-in (see
   * `verifyDelivery`).
   */
  getReadiness(): InviteDeliveryReadiness {
    const smtp = this.resolveSmtpConfig();
    if (!smtp.host || !smtp.from) {
      return {
        available: false,
        provider: 'manual',
        state: 'not_configured',
        message: !smtp.host ? 'smtp_host_missing' : 'smtp_from_missing',
        fromAddress: smtp.from,
        verified: false,
        verifiedAt: null,
      };
    }
    return {
      available: true,
      provider: 'smtp',
      state: 'configured',
      message: null,
      fromAddress: smtp.from,
      verified: this.lastVerifyOk,
      verifiedAt: this.lastVerifiedAt ? this.lastVerifiedAt.toISOString() : null,
    };
  }

  /**
   * Live SMTP verify() roundtrip — used when staff want to confirm that
   * the configured provider actually accepts a connection. Failures are
   * reported truthfully; we never promote `state` to `configured`
   * unless the credentials look minimally correct.
   */
  async verifyDelivery(): Promise<InviteDeliveryReadiness> {
    const readiness = this.getReadiness();
    if (readiness.state !== 'configured') {
      return readiness;
    }
    try {
      const transport = this.getOrCreateTransport();
      if (!transport) {
        return {
          ...readiness,
          state: 'error',
          message: 'transport_unavailable',
          verified: false,
        };
      }
      await transport.verify();
      this.lastVerifiedAt = new Date();
      this.lastVerifyOk = true;
      return {
        ...readiness,
        verified: true,
        verifiedAt: this.lastVerifiedAt.toISOString(),
      };
    } catch (error) {
      this.lastVerifyOk = false;
      const message = error instanceof Error ? error.message : 'smtp_verify_failed';
      this.logger.warn(`SMTP verify failed: ${message}`);
      return {
        ...readiness,
        state: 'error',
        message,
        verified: false,
      };
    }
  }

  /**
   * Attempt to deliver the invite email.
   *
   * Returns a truthful `InviteDeliveryAttempt`. Callers persist the
   * outcome on `guardian_portal_accesses.inviteDeliveryState` so the
   * staff UI can render exactly what happened — never a fake "sent".
   */
  async sendInvite(input: InviteDeliveryInput): Promise<InviteDeliveryAttempt> {
    const attemptedAt = new Date();
    const readiness = this.getReadiness();
    if (readiness.state !== 'configured') {
      return {
        state: 'unavailable',
        provider: 'manual',
        detail: readiness.message ?? 'smtp_not_configured',
        attemptedAt,
        deliveredAt: null,
      };
    }
    const transport = this.getOrCreateTransport();
    if (!transport) {
      return {
        state: 'unavailable',
        provider: 'manual',
        detail: 'transport_unavailable',
        attemptedAt,
        deliveredAt: null,
      };
    }
    const smtp = this.resolveSmtpConfig();
    const language = input.language === 'tr' ? 'tr' : 'en';
    const subject = renderInviteSubject(language, input.tenantName);
    const text = renderInviteText(language, input);
    const html = renderInviteHtml(language, input);
    try {
      const result = await transport.sendMail({
        from: smtp.from!,
        to: input.toEmail,
        subject,
        text,
        html,
      });
      const messageId = (result as { messageId?: string }).messageId ?? null;
      return {
        state: 'sent',
        provider: 'smtp',
        detail: messageId ? `provider_accepted:${messageId}` : 'provider_accepted',
        attemptedAt,
        deliveredAt: new Date(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'smtp_send_failed';
      this.logger.warn(`SMTP send failed for ${input.toEmail}: ${message}`);
      return {
        state: 'failed',
        provider: 'smtp',
        detail: message.slice(0, 480),
        attemptedAt,
        deliveredAt: null,
      };
    }
  }

  private getOrCreateTransport(): Transporter | null {
    const smtp = this.resolveSmtpConfig();
    if (!smtp.host) return null;
    const signature = JSON.stringify({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      user: smtp.user,
      pass: smtp.pass ? '***' : null,
    });
    if (this.cachedTransport && this.cachedTransportSignature === signature) {
      return this.cachedTransport;
    }
    try {
      const transport = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth:
          smtp.user && smtp.pass
            ? { user: smtp.user, pass: smtp.pass }
            : undefined,
      });
      this.cachedTransport = transport;
      this.cachedTransportSignature = signature;
      return transport;
    } catch (error) {
      this.logger.warn(
        `Failed to construct SMTP transport: ${
          error instanceof Error ? error.message : 'unknown_error'
        }`,
      );
      return null;
    }
  }
}

function renderInviteSubject(language: 'en' | 'tr', tenantName: string): string {
  if (language === 'tr') {
    return `${tenantName} aile portalı davetiniz`;
  }
  return `${tenantName} family portal invitation`;
}

function renderInviteText(language: 'en' | 'tr', input: InviteDeliveryInput): string {
  const hours = Math.max(1, Math.round(input.expiresInHours));
  if (language === 'tr') {
    return [
      `Merhaba ${input.guardianName},`,
      '',
      `${input.tenantName} sizi aile portalına davet ediyor. Aşağıdaki bağlantı ile giriş bilgilerinizi oluşturun:`,
      '',
      input.activationUrl,
      '',
      `Bu bağlantı ${hours} saat içinde geçerlidir. Eğer size ulaşmadıysa kulübünüzle iletişime geçin.`,
      '',
      `${input.tenantName} ekibi`,
    ].join('\n');
  }
  return [
    `Hi ${input.guardianName},`,
    '',
    `${input.tenantName} has invited you to the family portal. Use the link below to set your password and sign in:`,
    '',
    input.activationUrl,
    '',
    `This link is valid for ${hours} hour(s). If it doesn't reach you, please contact your club.`,
    '',
    `${input.tenantName}`,
  ].join('\n');
}

function renderInviteHtml(language: 'en' | 'tr', input: InviteDeliveryInput): string {
  const hours = Math.max(1, Math.round(input.expiresInHours));
  const safeUrl = input.activationUrl.replace(/"/g, '&quot;');
  const safeName = escapeHtml(input.guardianName);
  const safeTenant = escapeHtml(input.tenantName);
  const greeting = language === 'tr' ? `Merhaba ${safeName},` : `Hi ${safeName},`;
  const intro =
    language === 'tr'
      ? `${safeTenant} sizi aile portalına davet ediyor. Aşağıdaki bağlantıyla giriş bilgilerinizi oluşturun.`
      : `${safeTenant} has invited you to the family portal. Use the button below to set your password and sign in.`;
  const button = language === 'tr' ? 'Aile portalını aç' : 'Open the family portal';
  const expiry =
    language === 'tr'
      ? `Bu bağlantı ${hours} saat içinde geçerlidir.`
      : `This link is valid for ${hours} hour(s).`;
  const fallback =
    language === 'tr'
      ? 'Buton açılmazsa şu adresi tarayıcınıza yapıştırabilirsiniz:'
      : "If the button doesn't work, paste this link into your browser:";
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937; max-width: 480px; margin: 0 auto; padding: 24px;">
      <p style="font-size: 16px; margin: 0 0 12px;">${greeting}</p>
      <p style="font-size: 14px; line-height: 1.6; margin: 0 0 20px;">${intro}</p>
      <p style="margin: 0 0 24px;">
        <a href="${safeUrl}" style="display: inline-block; background: #1f2937; color: #ffffff; padding: 12px 20px; border-radius: 12px; text-decoration: none; font-weight: 600;">${button}</a>
      </p>
      <p style="font-size: 13px; color: #6b7280; margin: 0 0 12px;">${expiry}</p>
      <p style="font-size: 12px; color: #6b7280; margin: 0 0 4px;">${fallback}</p>
      <p style="font-size: 12px; color: #374151; word-break: break-all; margin: 0;">${safeUrl}</p>
    </div>
  `.trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
