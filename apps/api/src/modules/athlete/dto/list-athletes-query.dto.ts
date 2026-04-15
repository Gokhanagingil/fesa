import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { AthleteStatus, FamilyReadinessStatus } from '../../../database/enums';

export class ListAthletesQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(AthleteStatus)
  @Type(() => String)
  status?: AthleteStatus;

  @IsOptional()
  @IsUUID()
  sportBranchId?: string;

  @IsOptional()
  @IsUUID()
  primaryGroupId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsEnum(FamilyReadinessStatus)
  @Type(() => String)
  familyReadinessStatus?: FamilyReadinessStatus;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  needsFamilyFollowUp?: boolean;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  offset?: number;
}
