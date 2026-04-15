import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { AthleteStatus } from '../../../database/enums';

export class GeneratePeriodicAthleteChargesDto {
  @IsUUID()
  chargeItemId!: string;

  @IsString()
  @MaxLength(32)
  billingPeriodKey!: string;

  @IsString()
  @MaxLength(120)
  billingPeriodLabel!: string;

  @IsOptional()
  @Type(() => String)
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  athleteIds?: string[];

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @Type(() => String)
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(AthleteStatus, { each: true })
  athleteStatuses?: AthleteStatus[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
