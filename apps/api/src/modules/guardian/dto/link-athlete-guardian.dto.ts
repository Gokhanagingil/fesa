import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class LinkAthleteGuardianDto {
  @IsUUID()
  guardianId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(32)
  relationshipType!: string;

  @IsOptional()
  @IsBoolean()
  isPrimaryContact?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
