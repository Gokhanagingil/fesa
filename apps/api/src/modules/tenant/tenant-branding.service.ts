import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../database/entities/tenant.entity';
import {
  AllowedBrandLogoMimeType,
  MediaStorageService,
} from '../media/media-storage.service';
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

/** WCAG AA threshold for normal text (4.5:1) used in the contrast advisory. */
const READABLE_CONTRAST = 4.5;

/**
 * Branded shell, controlled product core.
 *
 * Resolves the public, parent-safe brand payload for a tenant and lets staff
 * update only the small set of brand fields we intentionally expose. Anything
 * not on this list (layout, typography, spacing, component structure,
 * accessibility, system colors for danger/success/warning, interaction
 * design) is NOT brandable and never will be from this surface.
 *
 * Wave 18 (Parent Portal v1.1 + Brand Admin v1.1) extends this with:
 *   - `setLogoAsset` / `removeLogoAsset` for an uploaded brand logo,
 *   - a `contrast` advisory in the payload so the staff brand admin can
 *     warn about hard-to-read colour choices without ever overriding the
 *     portal's own contrast guarantees.
 */
@Injectable()
export class TenantBrandingService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenants: Repository<Tenant>,
    private readonly media: MediaStorageService,
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

  private hexToRgb(value: string | null | undefined): { r: number; g: number; b: number } | null {
    if (!value) return null;
    if (!HEX_COLOR.test(value)) return null;
    const cleaned = value.slice(1, 7);
    return {
      r: parseInt(cleaned.slice(0, 2), 16),
      g: parseInt(cleaned.slice(2, 4), 16),
      b: parseInt(cleaned.slice(4, 6), 16),
    };
  }

  private relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
    const channel = (value: number) => {
      const v = value / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  }

  private contrastAgainst(background: string | null | undefined): {
    ink: 'light' | 'dark';
    ratio: number;
    readable: boolean;
  } {
    const rgb = this.hexToRgb(background) ?? this.hexToRgb(DEFAULT_BRAND_PRIMARY)!;
    const lum = this.relativeLuminance(rgb);
    const lightLum = 1;
    const darkLum = this.relativeLuminance({ r: 15, g: 31, b: 26 });
    const ratioWhite = (lightLum + 0.05) / (lum + 0.05);
    const ratioDark = (lum + 0.05) / (darkLum + 0.05);
    if (ratioDark >= ratioWhite) {
      return { ink: 'dark', ratio: Number(ratioDark.toFixed(2)), readable: ratioDark >= READABLE_CONTRAST };
    }
    return { ink: 'light', ratio: Number(ratioWhite.toFixed(2)), readable: ratioWhite >= READABLE_CONTRAST };
  }

  /**
   * Wave 18 — tenant-scoped, cache-busted route to the uploaded brand logo.
   * The version segment is the upload timestamp so a freshly replaced logo
   * never serves stale bytes from a CDN/browser cache.
   */
  buildBrandLogoAssetUrl(tenant: Tenant): string | null {
    if (!tenant.brandLogoAssetFileName) return null;
    const version = tenant.brandLogoAssetUploadedAt
      ? Date.parse(tenant.brandLogoAssetUploadedAt.toISOString())
      : 0;
    return `/api/portal/tenants/${tenant.id}/branding/logo${version ? `?v=${version}` : ''}`;
  }

  private toPayload(tenant: Tenant): TenantBrandingPayload {
    const isCustomized = Boolean(
      tenant.brandDisplayName ||
        tenant.brandTagline ||
        tenant.brandPrimaryColor ||
        tenant.brandAccentColor ||
        tenant.brandLogoUrl ||
        tenant.brandLogoAssetFileName ||
        tenant.brandWelcomeTitle ||
        tenant.brandWelcomeMessage,
    );

    const primary = tenant.brandPrimaryColor || DEFAULT_BRAND_PRIMARY;
    const accent = tenant.brandAccentColor || DEFAULT_BRAND_ACCENT;
    const primaryContrast = this.contrastAgainst(primary);
    const accentContrast = this.contrastAgainst(accent);
    const uploadedLogoUrl = this.buildBrandLogoAssetUrl(tenant);

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      displayName: tenant.brandDisplayName || tenant.name,
      tagline: tenant.brandTagline,
      primaryColor: primary,
      accentColor: accent,
      logoUrl: uploadedLogoUrl ?? tenant.brandLogoUrl,
      externalLogoUrl: tenant.brandLogoUrl,
      hasUploadedLogo: Boolean(tenant.brandLogoAssetFileName),
      welcomeTitle: tenant.brandWelcomeTitle,
      welcomeMessage: tenant.brandWelcomeMessage,
      contrast: {
        primaryInk: primaryContrast.ink,
        accentInk: accentContrast.ink,
        primaryRatio: primaryContrast.ratio,
        accentRatio: accentContrast.ratio,
        primaryReadable: primaryContrast.readable,
        accentReadable: accentContrast.readable,
      },
      isCustomized,
      updatedAt: tenant.brandUpdatedAt ? tenant.brandUpdatedAt.toISOString() : null,
    };
  }

  async getTenantRow(tenantId: string): Promise<Tenant> {
    const tenant = await this.tenants.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  async getForTenant(tenantId: string): Promise<TenantBrandingPayload> {
    return this.toPayload(await this.getTenantRow(tenantId));
  }

  async listPublicBranding(): Promise<TenantBrandingPayload[]> {
    const rows = await this.tenants.find({ order: { name: 'ASC' } });
    return rows.map((row) => this.toPayload(row));
  }

  async updateBranding(tenantId: string, input: TenantBrandingInput): Promise<TenantBrandingPayload> {
    const tenant = await this.getTenantRow(tenantId);

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

  /**
   * Wave 18 — Brand logo upload.
   *
   * The previous asset (if any) is deleted after the new one is committed
   * so a failed write never leaves the tenant without a logo. Validation
   * runs at the controller boundary via {@link MediaStorageService.assertValidBrandLogo}.
   */
  async setLogoAsset(
    tenantId: string,
    buffer: Buffer,
    contentType: AllowedBrandLogoMimeType,
  ): Promise<TenantBrandingPayload> {
    const tenant = await this.getTenantRow(tenantId);
    const previousFileName = tenant.brandLogoAssetFileName;

    const stored = await this.media.storePhoto(
      tenantId,
      'tenant-brand',
      tenantId,
      buffer,
      contentType,
    );

    tenant.brandLogoAssetFileName = stored.fileName;
    tenant.brandLogoAssetContentType = stored.contentType;
    tenant.brandLogoAssetSizeBytes = stored.sizeBytes;
    tenant.brandLogoAssetUploadedAt = stored.uploadedAt;
    tenant.brandUpdatedAt = new Date();
    const saved = await this.tenants.save(tenant);

    if (previousFileName && previousFileName !== stored.fileName) {
      await this.media.removeFile(tenantId, 'tenant-brand', tenantId, previousFileName);
    }
    return this.toPayload(saved);
  }

  async removeLogoAsset(tenantId: string): Promise<TenantBrandingPayload> {
    const tenant = await this.getTenantRow(tenantId);
    if (!tenant.brandLogoAssetFileName) {
      return this.toPayload(tenant);
    }
    const previousFileName = tenant.brandLogoAssetFileName;
    tenant.brandLogoAssetFileName = null;
    tenant.brandLogoAssetContentType = null;
    tenant.brandLogoAssetSizeBytes = null;
    tenant.brandLogoAssetUploadedAt = null;
    tenant.brandUpdatedAt = new Date();
    const saved = await this.tenants.save(tenant);
    await this.media.removeFile(tenantId, 'tenant-brand', tenantId, previousFileName);
    return this.toPayload(saved);
  }

  /**
   * Locate the current uploaded logo on disk, scoped to the tenant.
   * Returns null when the tenant exists but no asset is stored.
   */
  async getLogoAssetFile(tenantId: string): Promise<{
    absolutePath: string;
    contentType: string;
    sizeBytes: number | null;
    uploadedAt: Date | null;
  } | null> {
    const tenant = await this.getTenantRow(tenantId);
    if (!tenant.brandLogoAssetFileName) return null;
    const absolutePath = this.media.resolveExistingFile(
      tenantId,
      'tenant-brand',
      tenantId,
      tenant.brandLogoAssetFileName,
    );
    if (!absolutePath) return null;
    return {
      absolutePath,
      contentType: tenant.brandLogoAssetContentType ?? 'application/octet-stream',
      sizeBytes: tenant.brandLogoAssetSizeBytes,
      uploadedAt: tenant.brandLogoAssetUploadedAt,
    };
  }
}
