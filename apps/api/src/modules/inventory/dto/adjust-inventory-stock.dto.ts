import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Stock adjustment payload. `delta` may be positive or negative; the
 * service prevents the on-hand count from going below the currently
 * assigned count to avoid surprising negative availability.
 */
export class AdjustInventoryStockDto {
  @IsInt()
  delta!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
