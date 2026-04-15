import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum TrainingBulkAction {
  CANCEL = 'cancel',
  SHIFT = 'shift',
}

export class BulkUpdateTrainingSessionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  sessionIds!: string[];

  @IsEnum(TrainingBulkAction)
  @Type(() => String)
  action!: TrainingBulkAction;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-30)
  @Max(30)
  shiftDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  noteAppend?: string;
}
