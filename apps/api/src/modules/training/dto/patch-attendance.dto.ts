import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { AttendanceStatus } from '../../../database/enums';

export class PatchAttendanceDto {
  @IsOptional()
  @IsEnum(AttendanceStatus)
  @Type(() => String)
  status?: AttendanceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}
