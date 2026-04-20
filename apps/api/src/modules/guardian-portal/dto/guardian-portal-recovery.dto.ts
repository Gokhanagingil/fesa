import { IsEmail, IsOptional, IsUUID, MaxLength } from 'class-validator';

/**
 * Parent Portal v1.2 — public recovery request payload.
 *
 * Email is required so we can find the matching access row. Tenant id
 * is optional — if the parent already chose a club on the login screen
 * we use it to scope the lookup, otherwise we look up by email across
 * tenants. Either way the public response is identical for "match" and
 * "no match" so we never leak whether an email is on file.
 */
export class GuardianPortalRecoveryRequestDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;
}
