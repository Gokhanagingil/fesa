import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { AthleteChargeStatus } from '../../../database/enums';

export class ListAthleteChargesQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsUUID()
  athleteId?: string;

  @IsOptional()
  @IsEnum(AthleteChargeStatus)
  @Type(() => String)
  status?: AthleteChargeStatus;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  overdueOnly?: boolean;

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
