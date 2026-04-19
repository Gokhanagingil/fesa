import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class BulkDeleteGuardiansDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  guardianIds!: string[];

  /**
   * When true, guardians that still have linked athletes are silently skipped
   * instead of blocking the operation. Default is false: any linked guardian
   * blocks the entire batch so staff can review safely.
   */
  @IsOptional()
  @IsBoolean()
  skipLinked?: boolean;
}
