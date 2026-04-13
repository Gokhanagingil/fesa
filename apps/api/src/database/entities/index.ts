import { Tenant } from './tenant.entity';
import { SportBranch } from './sport-branch.entity';
import { AgeGroup } from './age-group.entity';
import { ClubGroup } from './club-group.entity';
import { Team } from './team.entity';
import { ReportDefinition } from './report-definition.entity';
import { SavedFilterPreset } from './saved-filter-preset.entity';

export const domainEntities = [
  Tenant,
  SportBranch,
  AgeGroup,
  ClubGroup,
  Team,
  ReportDefinition,
  SavedFilterPreset,
];

export {
  Tenant,
  SportBranch,
  AgeGroup,
  ClubGroup,
  Team,
  ReportDefinition,
  SavedFilterPreset,
};
