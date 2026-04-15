import { IsOptional, IsUUID } from 'class-validator';

export class ListCoachContextQueryDto {
  @IsOptional()
  @IsUUID()
  sportBranchId?: string;
}
