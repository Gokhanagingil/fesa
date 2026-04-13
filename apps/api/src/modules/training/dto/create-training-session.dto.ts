import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { TrainingSessionStatus } from '../../../database/enums';

export class CreateTrainingSessionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsUUID()
  sportBranchId!: string;

  @IsUUID()
  groupId!: string;

  @IsOptional()
  @IsUUID()
  teamId?: string | null;

  @IsDateString()
  scheduledStart!: string;

  @IsDateString()
  scheduledEnd!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsEnum(TrainingSessionStatus)
  @Type(() => String)
  status?: TrainingSessionStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
