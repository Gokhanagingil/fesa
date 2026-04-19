import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

export class DeliverOutreachRecipientDto {
  @IsString()
  @MaxLength(64)
  athleteId!: string;

  @IsString()
  @MaxLength(160)
  athleteName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  guardianId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  guardianName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  email?: string | null;

  @IsString()
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string | null;
}

export class DeliverOutreachDto {
  /**
   * Mode the operator asked for.  When omitted we default to
   * `assisted` so the call cannot accidentally trigger direct send.
   */
  @IsOptional()
  @IsEnum({ assisted: 'assisted', direct: 'direct' })
  mode?: 'assisted' | 'direct';

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DeliverOutreachRecipientDto)
  recipients!: DeliverOutreachRecipientDto[];
}
