import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class InviteGuardianPortalAccessDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
