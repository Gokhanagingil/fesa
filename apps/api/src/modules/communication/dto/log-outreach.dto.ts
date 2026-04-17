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

export class LogOutreachDto {
  @IsEnum({ whatsapp: 'whatsapp', phone: 'phone', email: 'email', manual: 'manual' })
  channel!: 'whatsapp' | 'phone' | 'email' | 'manual';

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
