import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { AthleteStatus, FamilyReadinessStatus } from '../../../database/enums';

export class ListAthletesQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(AthleteStatus)
  @Type(() => String)
  status?: AthleteStatus;

  @IsOptional()
  @IsUUID()
  sportBranchId?: string;

  @IsOptional()
  @IsUUID()
  primaryGroupId?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsEnum(FamilyReadinessStatus)
  @Type(() => String)
  familyReadinessStatus?: FamilyReadinessStatus;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  needsFamilyFollowUp?: boolean;

  /**
   * Page size cap.
   *
   * The cap is intentionally larger than the typical paginated list-page
   * (which only requests 25–50 rows) because the same endpoint is reused
   * to load a full session roster from the training attendance surface.
   * A roster of 500 comfortably covers any single group/team for an
   * amateur club; surfaces that need a strict catalog cap (groups, teams,
   * coaches) keep their own limits at the controller level.
   */
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  offset?: number;
}
