import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTenantBrandingDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  displayName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  tagline?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(9)
  primaryColor?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(9)
  accentColor?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  logoUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  welcomeTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  welcomeMessage?: string | null;
}
