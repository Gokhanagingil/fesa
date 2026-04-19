import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../database/entities/tenant.entity';
import {
  DEFAULT_BRAND_ACCENT,
  DEFAULT_BRAND_PRIMARY,
  TenantBrandingInput,
  TenantBrandingPayload,
} from './tenant-branding.types';

const HEX_COLOR = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const SAFE_URL = /^(https?:\/\/|\/)[^\s"'<>]+$/i;
const MAX_DISPLAY = 160;
const MAX_TAGLINE = 200;
const MAX_TITLE = 160;
const MAX_MESSAGE = 400;
const MAX_URL = 512;

/**
 * Branded shell, controlled product core.
 *
 * Resolves the public, parent-safe brand payload for a tenant and lets staff
 * update only the small set of brand fields we intentionally expose. Anything
 * not on this list (layout, typography, spacing, component structure,
 * accessibility, system colors for danger/success/warning, interaction
 * design) is NOT brandable and never will be from this surface.
 */
@Injectable()
export class TenantBrandingService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenants: Repository<Tenant>,
  ) {}

  private clampString(value: string | null | undefined, max: number): string | null {
    if (value == null) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    return trimmed.slice(0, max);
  }

  private normalizeColor(value: string | null | undefined): string | null {
    if (value == null) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    if (!HEX_COLOR.test(trimmed)) {
      throw new BadRequestException(
        'Brand colors must be 6 or 8 character hex values (for example #0d4a3c)',
      );
    }
    return trimmed.toLowerCase();
  }

  private normalizeUrl(value: string | null | undefined, max: number): string | null {
    const trimmed = this.clampString(value, max);
    if (!trimmed) return null;
    if (!SAFE_URL.test(trimmed)) {
      throw new BadRequestException(
        'Logo URL must be an absolute https:// URL or a path beginning with /',
      );
    }
    return trimmed;
  }

  private toPayload(tenant: Tenant): TenantBrandingPayload {
    const isCustomized = Boolean(
      tenant.brandDisplayName ||
        tenant.brandTagline ||
        tenant.brandPrimaryColor ||
        tenant.brandAccentColor ||
        tenant.brandLogoUrl ||
        tenant.brandWelcomeTitle ||
        tenant.brandWelcomeMessage,
    );

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      displayName: tenant.brandDisplayName || tenant.name,
      tagline: tenant.brandTagline,
      primaryColor: tenant.brandPrimaryColor || DEFAULT_BRAND_PRIMARY,
      accentColor: tenant.brandAccentColor || DEFAULT_BRAND_ACCENT,
      logoUrl: tenant.brandLogoUrl,
      welcomeTitle: tenant.brandWelcomeTitle,
      welcomeMessage: tenant.brandWelcomeMessage,
      isCustomized,
      updatedAt: tenant.brandUpdatedAt ? tenant.brandUpdatedAt.toISOString() : null,
    };
  }

  async getForTenant(tenantId: string): Promise<TenantBrandingPayload> {
    const tenant = await this.tenants.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return this.toPayload(tenant);
  }

  async listPublicBranding(): Promise<TenantBrandingPayload[]> {
    const rows = await this.tenants.find({ order: { name: 'ASC' } });
    return rows.map((row) => this.toPayload(row));
  }

  async updateBranding(tenantId: string, input: TenantBrandingInput): Promise<TenantBrandingPayload> {
    const tenant = await this.tenants.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (input.displayName !== undefined) {
      tenant.brandDisplayName = this.clampString(input.displayName, MAX_DISPLAY);
    }
    if (input.tagline !== undefined) {
      tenant.brandTagline = this.clampString(input.tagline, MAX_TAGLINE);
    }
    if (input.primaryColor !== undefined) {
      tenant.brandPrimaryColor = this.normalizeColor(input.primaryColor);
    }
    if (input.accentColor !== undefined) {
      tenant.brandAccentColor = this.normalizeColor(input.accentColor);
    }
    if (input.logoUrl !== undefined) {
      tenant.brandLogoUrl = this.normalizeUrl(input.logoUrl, MAX_URL);
    }
    if (input.welcomeTitle !== undefined) {
      tenant.brandWelcomeTitle = this.clampString(input.welcomeTitle, MAX_TITLE);
    }
    if (input.welcomeMessage !== undefined) {
      tenant.brandWelcomeMessage = this.clampString(input.welcomeMessage, MAX_MESSAGE);
    }

    tenant.brandUpdatedAt = new Date();
    const saved = await this.tenants.save(tenant);
    return this.toPayload(saved);
  }
}
