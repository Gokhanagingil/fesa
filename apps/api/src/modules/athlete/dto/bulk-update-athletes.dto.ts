import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { AthleteStatus } from '../../../database/enums';

export class BulkUpdateAthletesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  athleteIds!: string[];

  @IsOptional()
  @IsEnum(AthleteStatus)
  @Type(() => String)
  status?: AthleteStatus;

  @IsOptional()
  @IsUUID()
  primaryGroupId?: string;
}
