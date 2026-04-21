import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdatePlanEntitlementDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  limitValue?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  notes?: string | null;
}
