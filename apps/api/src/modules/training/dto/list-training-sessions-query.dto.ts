import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { TrainingSessionStatus } from '../../../database/enums';

export class ListTrainingSessionsQueryDto {
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsUUID()
  sportBranchId?: string;

  @IsOptional()
  @IsEnum(TrainingSessionStatus)
  @Type(() => String)
  status?: TrainingSessionStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

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
