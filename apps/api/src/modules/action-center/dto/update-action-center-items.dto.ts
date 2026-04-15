import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ActionCenterItemMutation } from '../../../database/enums';

export class UpdateActionCenterItemsDto {
  @Type(() => String)
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  itemKeys!: string[];

  @IsEnum(ActionCenterItemMutation)
  action!: ActionCenterItemMutation;

  @IsOptional()
  @IsDateString()
  snoozedUntil?: string;
}
