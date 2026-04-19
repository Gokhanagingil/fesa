import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class AssignInventoryDto {
  @IsUUID()
  inventoryVariantId!: string;

  @IsUUID()
  athleteId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ReturnInventoryAssignmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
