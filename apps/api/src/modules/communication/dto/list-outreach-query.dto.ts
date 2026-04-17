import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListOutreachQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsEnum({ whatsapp: 'whatsapp', phone: 'phone', email: 'email', manual: 'manual' })
  channel?: 'whatsapp' | 'phone' | 'email' | 'manual';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sourceSurface?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  templateKey?: string;
}
