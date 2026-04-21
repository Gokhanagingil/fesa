import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  TENANT_SUBSCRIPTION_STATUSES,
  TenantSubscriptionStatusValue,
} from '../license.constants';

export class AssignSubscriptionDto {
  @IsString()
  planCode!: string;

  @IsIn([...TENANT_SUBSCRIPTION_STATUSES])
  status!: TenantSubscriptionStatusValue;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  renewalDate?: string;

  @IsOptional()
  @IsISO8601()
  trialEndsAt?: string;

  @IsOptional()
  @IsBoolean()
  onboardingServiceIncluded?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  internalNotes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  statusReason?: string;
}
