import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs, createReadStream, existsSync } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { dirname, isAbsolute, join, normalize, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Allowed mime types for athlete profile photos.
 *
 * Kept intentionally short: web-friendly, widely supported in mobile
 * browsers, and easy to validate without re-encoding.  HEIC/HEIF are
 * intentionally excluded for v1 because rendering them in browsers still
 * requires a transcoder.
 */
export const ALLOWED_PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export type AllowedPhotoMimeType = (typeof ALLOWED_PHOTO_MIME_TYPES)[number];

/** 5 MB ceiling — generous for phone-sourced photos, safely below proxy limits. */
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

const MIME_TO_EXT: Record<AllowedPhotoMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export type SupportedMediaScope = 'athletes';

export interface StoredMediaFile {
  fileName: string;
  contentType: AllowedPhotoMimeType;
  sizeBytes: number;
  uploadedAt: Date;
}

@Injectable()
export class MediaStorageService {
  private readonly logger = new Logger(MediaStorageService.name);
  private readonly storageRoot: string;

  constructor(private readonly config: ConfigService) {
    const configured = this.config.get<string>('media.storageRoot') ?? 'storage/media';
    this.storageRoot = isAbsolute(configured) ? configured : resolve(process.cwd(), configured);
  }

  /** Public for diagnostics + tests. Never includes a tenant component. */
  getStorageRoot(): string {
    return this.storageRoot;
  }

  /**
   * Resolve the per-(tenant, scope, owner) directory while guaranteeing the
   * resulting path stays inside {@link storageRoot}.  Tenant + owner ids are
   * UUIDs in this codebase, but we still validate to keep this safe in case
   * a non-uuid ever flows in (eg. via a future scope).
   */
  private getOwnerDirectory(
    tenantId: string,
    scope: SupportedMediaScope,
    ownerId: string,
  ): string {
    if (!tenantId || !ownerId) {
      throw new BadRequestException('tenantId and ownerId are required for media storage');
    }
    const sanitizedTenant = sanitizeIdSegment(tenantId);
    const sanitizedOwner = sanitizeIdSegment(ownerId);
    const dir = resolve(this.storageRoot, sanitizedTenant, scope, sanitizedOwner);
    if (!dir.startsWith(this.storageRoot + sep) && dir !== this.storageRoot) {
      throw new BadRequestException('Resolved media path escapes the storage root');
    }
    return dir;
  }

  /**
   * Validate an upload against {@link ALLOWED_PHOTO_MIME_TYPES} +
   * {@link MAX_PHOTO_SIZE_BYTES}.  Throws BadRequestException with a calm,
   * human-readable message on any violation so it can surface unchanged in
   * the UI.
   */
  assertValidPhoto(buffer: Buffer | undefined, contentType: string | undefined): AllowedPhotoMimeType {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('No photo file received.');
    }
    if (!contentType || !isAllowedPhotoMime(contentType)) {
      throw new BadRequestException(
        'Unsupported file type. Use a JPG, PNG, WEBP, or GIF image.',
      );
    }
    if (buffer.length > MAX_PHOTO_SIZE_BYTES) {
      throw new BadRequestException(
        'Photo is larger than 5 MB. Try a smaller image.',
      );
    }
    return contentType;
  }

  /**
   * Persist a photo for the given (tenant, athlete) and return the stored
   * descriptor.  Caller is responsible for unlinking any previously stored
   * file via {@link removeFile} before/after this call — keeping the side
   * effects in the caller leaves the storage layer composable.
   */
  async storePhoto(
    tenantId: string,
    scope: SupportedMediaScope,
    ownerId: string,
    buffer: Buffer,
    contentType: AllowedPhotoMimeType,
  ): Promise<StoredMediaFile> {
    const dir = this.getOwnerDirectory(tenantId, scope, ownerId);
    await mkdir(dir, { recursive: true });
    const fileName = `${randomUUID()}.${MIME_TO_EXT[contentType]}`;
    const fullPath = join(dir, fileName);
    await fs.writeFile(fullPath, buffer);
    return {
      fileName,
      contentType,
      sizeBytes: buffer.length,
      uploadedAt: new Date(),
    };
  }

  async removeFile(
    tenantId: string,
    scope: SupportedMediaScope,
    ownerId: string,
    fileName: string | null | undefined,
  ): Promise<void> {
    if (!fileName) return;
    const dir = this.getOwnerDirectory(tenantId, scope, ownerId);
    const target = resolve(dir, sanitizeFileName(fileName));
    if (!target.startsWith(dir + sep)) {
      this.logger.warn(`Refusing to remove media file outside owner directory: ${fileName}`);
      return;
    }
    try {
      await unlink(target);
    } catch (error: unknown) {
      // ENOENT is fine — the row pointed at a file that's already gone.
      if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
        this.logger.warn(
          `Failed to remove media file ${target}: ${(error as Error).message}`,
        );
      }
    }
    // Best-effort: prune the owner directory if it's now empty so the tree
    // stays tidy.  Ignore errors — leftover empty dirs are harmless.
    try {
      const entries = await fs.readdir(dir);
      if (entries.length === 0) {
        await fs.rmdir(dir);
        const parent = dirname(dir);
        if (parent.startsWith(this.storageRoot)) {
          const parentEntries = await fs.readdir(parent);
          if (parentEntries.length === 0) {
            await fs.rmdir(parent);
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  /**
   * Return an absolute path to a stored file, guaranteeing the resolved
   * path stays inside the per-(tenant, scope, owner) directory.  Returns
   * null if the file no longer exists on disk.
   */
  resolveExistingFile(
    tenantId: string,
    scope: SupportedMediaScope,
    ownerId: string,
    fileName: string | null | undefined,
  ): string | null {
    if (!fileName) return null;
    const dir = this.getOwnerDirectory(tenantId, scope, ownerId);
    const target = resolve(dir, sanitizeFileName(fileName));
    if (!target.startsWith(dir + sep)) {
      return null;
    }
    return existsSync(target) ? target : null;
  }

  createReadStream(absolutePath: string) {
    return createReadStream(absolutePath);
  }
}

export function isAllowedPhotoMime(value: string): value is AllowedPhotoMimeType {
  return (ALLOWED_PHOTO_MIME_TYPES as readonly string[]).includes(value);
}

function sanitizeIdSegment(value: string): string {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    throw new BadRequestException('Invalid identifier segment for media storage');
  }
  return trimmed;
}

function sanitizeFileName(value: string): string {
  const normalized = normalize(value);
  if (normalized.includes('..') || normalized.includes(sep) || normalized.startsWith('.')) {
    throw new BadRequestException('Invalid media file name');
  }
  return normalized;
}
