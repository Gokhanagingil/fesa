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
import { AthleteChargeStatus } from '../../../database/enums';

export class CreateBulkAthleteChargesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  athleteIds!: string[];

  @IsUUID()
  chargeItemId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @IsOptional()
  @IsEnum(AthleteChargeStatus)
  @Type(() => String)
  status?: AthleteChargeStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
