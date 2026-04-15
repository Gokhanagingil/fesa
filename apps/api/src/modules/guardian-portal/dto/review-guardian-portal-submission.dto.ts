import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewGuardianPortalSubmissionDto {
  @IsEnum({ approved: 'approved', rejected: 'rejected' })
  decision!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
