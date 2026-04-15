import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { FamilyActionRequestStatus } from '../../../database/enums';

export class TransitionFamilyActionRequestDto {
  @IsEnum(FamilyActionRequestStatus)
  @Type(() => String)
  status!: FamilyActionRequestStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  responseText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  decisionNote?: string;
}
