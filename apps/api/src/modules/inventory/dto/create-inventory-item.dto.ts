import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { InventoryCategory } from '../../../database/enums';

export class CreateInventoryItemVariantDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  size?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  number?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  color?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  initialStock?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number | null;
}

export class CreateInventoryItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsEnum(InventoryCategory)
  category!: InventoryCategory;

  @IsOptional()
  @IsUUID()
  sportBranchId?: string | null;

  @IsOptional()
  @IsBoolean()
  hasVariants?: boolean;

  @IsOptional()
  @IsBoolean()
  trackAssignment?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * Optional initial stock for pooled items (no variants). Ignored when
   * variants are supplied.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  initialStock?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => CreateInventoryItemVariantDto)
  variants?: CreateInventoryItemVariantDto[];
}
