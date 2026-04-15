import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitGuardianPortalActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  responseText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
