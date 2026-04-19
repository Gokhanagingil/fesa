import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class SaveWhatsAppReadinessDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  cloudApiEnabled?: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(64)
  phoneNumberId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(64)
  businessAccountId?: string | null;

  /**
   * Reference to the access token (eg. `env:WHATSAPP_CLOUD_API_TOKEN`).
   * The actual secret is NEVER stored here — only the reference is.
   */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  accessTokenRef?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(32)
  displayPhoneNumber?: string | null;
}
