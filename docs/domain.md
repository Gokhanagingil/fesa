# Domain modeling (wave one)

## Group vs Team

| Concept | Meaning | Example |
|---------|---------|---------|
| **Group** (`club_groups`) | Training cohort / age bucket / non-competitive grouping | “2015 birth year group” |
| **Team** (`teams`) | Competitive or named squad | “2015A”, “U12 Girls” |

Rules encoded in the schema:

- **Separate tables**: `ClubGroup` and `Team` are distinct entities (table `club_groups` avoids SQL keyword `group`).
- **Optional link**: `Team.groupId` is nullable — a team may sit under a group, or exist with only `sportBranchId` when modeling allows.
- **Group without teams**: a group can exist without any teams; athletes (future) may belong to a group for training without a team assignment.

## Foundational entities (minimal)

| Entity | Role |
|--------|------|
| `Tenant` | Organization boundary |
| `SportBranch` | Discipline within a tenant (e.g. basketball) |
| `AgeGroup` | Label and optional birth-year range for filters |
| `ClubGroup` | Cohort under a branch, optionally tied to `AgeGroup` |
| `Team` | Squad under a branch, optionally tied to `ClubGroup` |

## Reporting placeholders

- `report_definitions`: registry rows for first-class reports (keys + `titleKey` for i18n).
- `saved_filter_presets`: tenant-scoped saved filters for list/report surfaces (`surface` + JSON `payload`).

## Not modeled yet

Athletes, guardians, coaches, attendance, fixtures, payments — reserved via module folders and future migrations, not forced into this wave.
