import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import { TenantGuard } from '../core/tenant.guard';
import {
  MAX_BRAND_LOGO_SIZE_BYTES,
  MediaStorageService,
} from '../media/media-storage.service';
import { TenantBrandingService } from './tenant-branding.service';
import { UpdateTenantBrandingDto } from './dto/update-tenant-branding.dto';

/**
 * Parent-portal-safe brand listing.
 *
 * Used by the parent activation/login surfaces so guardians can pick their
 * club without first authenticating to the staff API. Returns only the
 * controlled brand payload — no member counts, finance, or operational data.
 *
 * The `:tenantId/branding/logo` route streams the uploaded brand logo (if
 * any) so the portal/login pages can render it without exposing the
 * filesystem path. The route is intentionally public because:
 *   - the same payload is already public via `/portal/tenants`,
 *   - the file is sandboxed to the per-tenant media subtree,
 *   - and the URL only resolves while the tenant has an uploaded asset.
 */
@Controller('portal/tenants')
export class PortalTenantBrandingController {
  constructor(
    private readonly branding: TenantBrandingService,
    private readonly media: MediaStorageService,
  ) {}

  @Get()
  list() {
    return this.branding.listPublicBranding();
  }

  @Get(':tenantId')
  one(@Param('tenantId') tenantId: string) {
    return this.branding.getForTenant(tenantId);
  }

  @Get(':tenantId/branding/logo')
  async logo(@Param('tenantId') tenantId: string, @Res() res: Response): Promise<void> {
    const asset = await this.branding.getLogoAssetFile(tenantId);
    if (!asset) {
      throw new NotFoundException('Logo not found');
    }
    res.setHeader('Content-Type', asset.contentType);
    if (asset.sizeBytes != null) {
      res.setHeader('Content-Length', String(asset.sizeBytes));
    }
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    if (asset.uploadedAt) {
      res.setHeader('Last-Modified', asset.uploadedAt.toUTCString());
    }
    const stream = this.media.createReadStream(asset.absolutePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(500).end();
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
  }
}

/**
 * Staff-scoped branding management.
 *
 * Tenant isolation is enforced via the existing `TenantGuard`: a staff user
 * can only update branding for the tenant their authenticated request is
 * already scoped to. We intentionally do not allow cross-tenant writes here.
 *
 * Wave 18 adds:
 *   - `POST /tenant/branding/logo` — upload a brand logo asset.
 *   - `DELETE /tenant/branding/logo` — clear the uploaded asset (the
 *     tenant can still keep its `externalLogoUrl`).
 */
@Controller('tenant/branding')
@UseGuards(TenantGuard)
export class StaffTenantBrandingController {
  constructor(
    private readonly branding: TenantBrandingService,
    private readonly media: MediaStorageService,
  ) {}

  @Get()
  current(@Req() req: Request) {
    return this.branding.getForTenant(req.tenantId!);
  }

  @Put()
  update(@Req() req: Request, @Body() dto: UpdateTenantBrandingDto) {
    if (!dto || typeof dto !== 'object') {
      throw new BadRequestException('Branding payload is required');
    }
    return this.branding.updateBranding(req.tenantId!, dto);
  }

  @Post('logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_BRAND_LOGO_SIZE_BYTES, files: 1 },
    }),
  )
  uploadLogo(
    @Req() req: Request,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('No logo file received.');
    }
    const contentType = this.media.assertValidBrandLogo(file.buffer, file.mimetype);
    return this.branding.setLogoAsset(req.tenantId!, file.buffer, contentType);
  }

  @Delete('logo')
  removeLogo(@Req() req: Request) {
    return this.branding.removeLogoAsset(req.tenantId!);
  }
}
