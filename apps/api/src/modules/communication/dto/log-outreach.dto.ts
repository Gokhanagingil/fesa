import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { TrainingSessionStatus } from '../../../database/enums';

export class OutreachAudienceSummaryDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  athletes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  guardians?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  primaryContacts?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  withOverdueBalance?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  needingFollowUp?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contextLabel?: string;
}

export class OutreachAudienceFiltersDto {
  @IsOptional()
  @IsEnum(TrainingSessionStatus)
  privateLessonStatus?: TrainingSessionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  financialState?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  familyReadiness?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  athleteStatus?: string;

  @IsOptional()
  @IsUUID()
  groupId?: string | null;

  @IsOptional()
  @IsUUID()
  teamId?: string | null;

  @IsOptional()
  @IsUUID()
  trainingSessionId?: string | null;

  @IsOptional()
  @IsUUID()
  coachId?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  athleteIds?: string[];

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  needsFollowUp?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  primaryContactsOnly?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  portalEnabledOnly?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  portalPendingOnly?: boolean;
}

export type OutreachStatus = 'draft' | 'logged' | 'archived';

export class LogOutreachDto {
  @IsEnum({ whatsapp: 'whatsapp', phone: 'phone', email: 'email', manual: 'manual' })
  channel!: 'whatsapp' | 'phone' | 'email' | 'manual';

  /**
   * Lifecycle status:
   *  - "draft"     — work in progress, kept for the operator to come back to
   *  - "logged"    — outreach intent recorded (the assisted "sent" state)
   *  - "archived"  — superseded or no longer relevant; hidden by default
   *
   * Optional on the wire to keep v1 clients working: when omitted we
   * default to "logged" to preserve the original behaviour.
   */
  @IsOptional()
  @IsEnum({ draft: 'draft', logged: 'logged', archived: 'archived' })
  status?: OutreachStatus;

  @IsString()
  @MaxLength(64)
  sourceSurface!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  sourceKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  templateKey?: string;

  @IsString()
  @MaxLength(200)
  topic!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  messagePreview?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  athleteIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  guardianIds?: string[];

  @IsOptional()
  @IsObject()
  @Type(() => OutreachAudienceFiltersDto)
  @ValidateNested()
  audienceFilters?: OutreachAudienceFiltersDto;

  @IsOptional()
  @IsObject()
  @Type(() => OutreachAudienceSummaryDto)
  @ValidateNested()
  audienceSummary?: OutreachAudienceSummaryDto;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  recipientCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  reachableGuardianCount?: number;
}
