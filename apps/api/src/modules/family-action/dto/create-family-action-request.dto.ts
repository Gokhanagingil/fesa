import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { FamilyActionRequestStatus, FamilyActionRequestType } from '../../../database/enums';

export class CreateFamilyActionRequestDto {
  @IsUUID()
  athleteId!: string;

  @IsOptional()
  @IsUUID()
  guardianId?: string | null;

  @IsEnum(FamilyActionRequestType)
  @Type(() => String)
  type!: FamilyActionRequestType;

  @IsOptional()
  @IsEnum(FamilyActionRequestStatus)
  @Type(() => String)
  status?: FamilyActionRequestStatus;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
