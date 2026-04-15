import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { AttendanceStatus, TrainingSessionStatus } from '../../../database/enums';

export class CreatePrivateLessonDto {
  @IsUUID()
  athleteId!: string;

  @IsUUID()
  coachId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  focus?: string | null;

  @IsDateString()
  scheduledStart!: string;

  @IsDateString()
  scheduledEnd!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string | null;

  @IsOptional()
  @IsEnum(TrainingSessionStatus)
  @Type(() => String)
  status?: TrainingSessionStatus;

  @IsOptional()
  @IsEnum(AttendanceStatus)
  @Type(() => String)
  attendanceStatus?: AttendanceStatus | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;

  @IsOptional()
  @IsUUID()
  chargeItemId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  chargeAmount?: number;

  @IsOptional()
  @IsDateString()
  chargeDueDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  chargeNotes?: string | null;
}
