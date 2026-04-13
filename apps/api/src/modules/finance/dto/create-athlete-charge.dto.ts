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
import { AthleteChargeStatus } from '../../../database/enums';

export class CreateAthleteChargeDto {
  @IsUUID()
  athleteId!: string;

  @IsUUID()
  chargeItemId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

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
