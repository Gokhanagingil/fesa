import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AthleteStatus } from '../../../database/enums';

export class CreateAthleteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  lastName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  preferredName?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  gender?: string;

  @IsUUID()
  sportBranchId!: string;

  @IsOptional()
  @IsUUID()
  primaryGroupId?: string | null;

  @IsOptional()
  @IsEnum(AthleteStatus)
  @Type(() => String)
  status?: AthleteStatus;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  jerseyNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
