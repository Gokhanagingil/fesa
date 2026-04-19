import { Global, Module } from '@nestjs/common';
import { MediaStorageService } from './media-storage.service';

/**
 * Wave 16 — Athlete Photo & Media Foundation v1.
 *
 * Tiny, intentional module that owns the on-disk media boundary so callers
 * never touch the filesystem directly.  Today it only powers athlete
 * profile photos; the API surface (`MediaStorageService`) is shaped so a
 * future `coach photo`, `team crest`, or `inventory image` can be added
 * without rewriting the storage rules or rethinking tenant isolation.
 */
@Global()
@Module({
  providers: [MediaStorageService],
  exports: [MediaStorageService],
})
export class MediaModule {}
