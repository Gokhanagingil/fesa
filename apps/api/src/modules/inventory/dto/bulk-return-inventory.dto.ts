import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class BulkReturnInventoryDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  assignmentIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;
}
