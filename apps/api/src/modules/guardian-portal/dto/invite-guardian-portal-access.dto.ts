import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class InviteGuardianPortalAccessDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  /**
   * Parent Invite Delivery & Access Reliability Pack — locale hint.
   *
   * Lets staff issue an invite in the family's preferred language so
   * the outgoing email body matches the rest of the parent portal
   * surface. Optional; defaults to English on the server.
   */
  @IsOptional()
  @IsIn(['en', 'tr'])
  language?: 'en' | 'tr';
}
