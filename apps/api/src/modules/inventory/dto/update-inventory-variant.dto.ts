import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateInventoryVariantDto {
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
  lowStockThreshold?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
