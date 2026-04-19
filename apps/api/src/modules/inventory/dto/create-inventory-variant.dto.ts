import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateInventoryVariantDto {
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
