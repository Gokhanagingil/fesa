import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AthleteStatus, FamilyReadinessStatus, TrainingSessionStatus } from '../../../database/enums';

export class ListCommunicationAudienceQueryDto {
  @IsOptional()
  @IsEnum(TrainingSessionStatus)
  privateLessonStatus?: TrainingSessionStatus;

  @IsOptional()
  @IsUUID()
  groupId?: string | null;

  @IsOptional()
  @IsUUID()
  teamId?: string | null;

  @IsOptional()
  @IsUUID()
  trainingSessionId?: string;

  @IsOptional()
  @IsUUID()
  coachId?: string;

  @IsOptional()
  @IsUUID()
  privateLessonId?: string;

  @IsOptional()
  @IsDateString()
  privateLessonFrom?: string;

  @IsOptional()
  @IsDateString()
  privateLessonTo?: string;

  @IsOptional()
  @IsEnum({ overdue: 'overdue', outstanding: 'outstanding' })
  financialState?: 'overdue' | 'outstanding';

  @IsOptional()
  @IsEnum(FamilyReadinessStatus)
  familyReadiness?: FamilyReadinessStatus;

  @IsOptional()
  @IsEnum(AthleteStatus)
  @Type(() => String)
  athleteStatus?: AthleteStatus;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  needsFollowUp?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @Type(() => String)
  @IsArray()
  @IsUUID('4', { each: true })
  athleteIds?: string[];

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
