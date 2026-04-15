import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, Max, Min } from 'class-validator';
import {
  ActionCenterItemCategory,
  ActionCenterItemUrgency,
} from '../../../database/enums';

export enum ActionCenterView {
  NOTIFICATIONS = 'notifications',
  QUEUE = 'queue',
}

export class ListActionCenterItemsQueryDto {
  @IsOptional()
  @IsEnum(ActionCenterView)
  view?: ActionCenterView;

  @IsOptional()
  @IsEnum(ActionCenterItemCategory)
  category?: ActionCenterItemCategory;

  @IsOptional()
  @IsEnum(ActionCenterItemUrgency)
  urgency?: ActionCenterItemUrgency;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeRead?: boolean;
}
