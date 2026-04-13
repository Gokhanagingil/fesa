import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AttendanceStatus } from '../../../database/enums';

export class AttendanceRowDto {
  @IsUUID()
  athleteId!: string;

  @IsEnum(AttendanceStatus)
  @Type(() => String)
  status!: AttendanceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class BulkAttendanceDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AttendanceRowDto)
  rows!: AttendanceRowDto[];
}
