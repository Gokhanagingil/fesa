import { IsOptional, IsUUID } from 'class-validator';

export class AssignHeadCoachDto {
  @IsOptional()
  @IsUUID()
  headCoachId?: string | null;
}
