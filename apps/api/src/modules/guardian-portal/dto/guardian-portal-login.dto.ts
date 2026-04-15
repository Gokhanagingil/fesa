import { IsEmail, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class GuardianPortalLoginDto {
  @IsUUID()
  tenantId!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(120)
  password!: string;
}
