import { Tenant } from './tenant.entity';
import { SportBranch } from './sport-branch.entity';
import { AgeGroup } from './age-group.entity';
import { ClubGroup } from './club-group.entity';
import { Team } from './team.entity';
import { ReportDefinition } from './report-definition.entity';
import { SavedFilterPreset } from './saved-filter-preset.entity';
import { Athlete } from './athlete.entity';
import { Guardian } from './guardian.entity';
import { AthleteGuardian } from './athlete-guardian.entity';
import { AthleteTeamMembership } from './athlete-team-membership.entity';
import { TrainingSession } from './training-session.entity';
import { Attendance } from './attendance.entity';
import { ChargeItem } from './charge-item.entity';
import { AthleteCharge } from './athlete-charge.entity';

export const domainEntities = [
  Tenant,
  SportBranch,
  AgeGroup,
  ClubGroup,
  Team,
  ReportDefinition,
  SavedFilterPreset,
  Athlete,
  Guardian,
  AthleteGuardian,
  AthleteTeamMembership,
  TrainingSession,
  Attendance,
  ChargeItem,
  AthleteCharge,
];

export {
  Tenant,
  SportBranch,
  AgeGroup,
  ClubGroup,
  Team,
  ReportDefinition,
  SavedFilterPreset,
  Athlete,
  Guardian,
  AthleteGuardian,
  AthleteTeamMembership,
  TrainingSession,
  Attendance,
  ChargeItem,
  AthleteCharge,
};
