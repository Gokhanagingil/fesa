import { Type } from 'class-transformer';
import {
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
import { AthleteStatus } from '../../../database/enums';

export class CreateBulkAthleteChargesDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  athleteIds?: string[];

  @IsOptional()
  @IsUUID()
  groupId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(AthleteStatus, { each: true })
  @Type(() => String)
  athleteStatuses?: AthleteStatus[];

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
