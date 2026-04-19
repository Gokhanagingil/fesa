import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

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
