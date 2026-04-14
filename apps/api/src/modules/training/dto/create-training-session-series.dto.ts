import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TrainingSessionStatus } from '../../../database/enums';

export class CreateTrainingSessionSeriesDto {
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
  startsOn!: string;

  @IsDateString()
  endsOn!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  weekdays!: number[];

  @IsString()
  @MinLength(5)
  @MaxLength(5)
  sessionStartTime!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(5)
  sessionEndTime!: string;

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
