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

  /**
   * Lifecycle filter.  When omitted we return logged + draft rows so the
   * default history view shows both ready-to-resume drafts and completed
   * intents.  Pass an explicit value (eg. `status=draft`) to scope the
   * list further.
   */
  @IsOptional()
  @IsEnum({ draft: 'draft', logged: 'logged', archived: 'archived' })
  status?: 'draft' | 'logged' | 'archived';
}
