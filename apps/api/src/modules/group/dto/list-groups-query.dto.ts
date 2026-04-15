import { Type } from 'class-transformer';
import { IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListGroupsQueryDto {
  @IsOptional()
  @IsUUID()
  sportBranchId?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  offset?: number;
}
