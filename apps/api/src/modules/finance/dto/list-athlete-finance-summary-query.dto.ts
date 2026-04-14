import { IsOptional, IsUUID } from 'class-validator';

export class ListAthleteFinanceSummaryQueryDto {
  @IsOptional()
  @IsUUID()
  athleteId?: string;
}
