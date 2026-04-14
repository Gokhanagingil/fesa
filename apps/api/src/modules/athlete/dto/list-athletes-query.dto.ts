import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { AthleteStatus } from '../../../database/enums';

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
  @Type(() => Number)
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  offset?: number;
}
