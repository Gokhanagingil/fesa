import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  CLUB_UPDATE_AUDIENCE_SCOPES,
  CLUB_UPDATE_CATEGORIES,
  CLUB_UPDATE_STATUSES,
  ClubUpdateAudienceScope,
  ClubUpdateCategory,
  ClubUpdateStatus,
} from '../club-update.types';

/**
 * Parent Portal v1.1 — staff-side upsert payload for a club update card.
 *
 * Validation is intentionally tight: short title, plain-text body, safe
 * link, optional ISO publish/expiry/pinned-until windows. Anything richer
 * than this should be deferred — the portal explicitly is not a CMS.
 */
export class UpsertClubUpdateDto {
  @IsOptional()
  @IsIn(CLUB_UPDATE_CATEGORIES)
  category?: ClubUpdateCategory;

  @IsOptional()
  @IsIn(CLUB_UPDATE_STATUSES)
  status?: ClubUpdateStatus;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(140)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(600)
  body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  linkUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  linkLabel?: string | null;

  @IsOptional()
  @IsISO8601()
  publishedAt?: string | null;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string | null;

  @IsOptional()
  @IsISO8601()
  pinnedUntil?: string | null;

  /**
   * Parent Portal v1.2 — Targeted announcements.
   *
   * Defaults to `all`; when a scope other than `all` is used exactly
   * one matching id must be provided. The service validates that the
   * id belongs to the resolved tenant before saving.
   */
  @IsOptional()
  @IsIn(CLUB_UPDATE_AUDIENCE_SCOPES)
  audienceScope?: ClubUpdateAudienceScope;

  @IsOptional()
  @IsUUID()
  audienceSportBranchId?: string | null;

  @IsOptional()
  @IsUUID()
  audienceGroupId?: string | null;

  @IsOptional()
  @IsUUID()
  audienceTeamId?: string | null;
}
