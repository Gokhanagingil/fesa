import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { FamilyActionRequestStatus, FamilyActionRequestType } from '../../../database/enums';

export class ListFamilyActionRequestsQueryDto {
  @IsOptional()
  @IsUUID()
  athleteId?: string;

  @IsOptional()
  @IsUUID()
  guardianId?: string;

  @IsOptional()
  @IsEnum(FamilyActionRequestType)
  @Type(() => String)
  type?: FamilyActionRequestType;

  @IsOptional()
  @IsEnum(FamilyActionRequestStatus, { each: true })
  @Type(() => String)
  @IsArray()
  statuses?: FamilyActionRequestStatus[];

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  needsFollowUp?: boolean;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;
}
