# Domain modeling

## Group vs Team vs Athlete (operational model)

| Concept | Table / entity | Meaning |
|---------|----------------|---------|
| **Group** | `club_groups` | Training cohort / age bucket. Athletes attend group-level training without needing a team. |
| **Team** | `teams` | Competitive or named squad; optional link to a group via `teams.groupId`. |
| **Athlete** | `athletes` | Person in the club; always tied to a **sport branch**; **primary group** (`primaryGroupId`) is the main cohort for training. |
| **Team membership** | `athlete_team_memberships` | Optional squad roster rows; supports `startedAt` / `endedAt` for future history and transfers. |

### Membership strategy (wave two)

We combine:

1. **`athletes.primaryGroupId`** — fast, obvious “where does this athlete train by default” for lists, schedules, and attendance UX.
2. **`athlete_team_memberships`** — explicit optional roster for teams, with nullable end dates for history without rewriting the athlete row.

This supports:

- **Group-only athlete** — `primaryGroupId` set, no open team memberships.
- **Group + team athlete** — same as above plus active membership rows.
- **Reporting** — filter by branch, group, team, membership window; attendance joins through `training_sessions` and `attendances`.

Guardians use a classic **M:N** link table `athlete_guardians` with relationship metadata (`relationshipType`, `isPrimaryContact`).

## Training & attendance

- **`training_sessions`** — scheduled work for a **group** (`groupId` required); optional **team** (`teamId`) for team-specific practices.
- **`attendances`** — one row per `(trainingSessionId, athleteId)` with status and optional note.

Eligibility rule in the API: an athlete must share the session’s **primary group**; if the session targets a team, the athlete needs an **active** (no `endedAt`) membership in that team.

### Operational UX implications in the current product wave

- **Athlete lists** can now be filtered by **group** and by **active team membership**, which keeps the group-vs-team split visible in day-to-day roster work.
- **Groups** are presented as the main training container, with direct jumps into the athlete list and session planning.
- **Teams** are presented as optional squads layered on top of groups, with direct jumps into filtered athlete rosters.
- **Attendance** uses the same rule set: a team session loads only athletes who both belong to the session group and currently hold an active membership in that team.

## Guardians

- Guardians remain reusable tenant-level contact records.
- The product wave now treats guardian operations as a first-class workflow:
  - browse guardians,
  - open a guardian profile,
  - edit guardian contact details,
  - see linked athletes from the guardian side,
  - create a guardian directly from an athlete profile and link them in one flow.

## Finance (foundation only)

- **`charge_items`** — reusable catalog (name, category, default amount, currency, active flag).
- **`athlete_charges`** — an amount assigned to an athlete, optional due date, status (pending / partially_paid / paid / cancelled).

### Current operational finance flow

- Clubs define reusable **charge items** and can now manage active/inactive state directly from the list.
- **Athlete charges** can be assigned:
  - individually from an athlete profile,
  - individually through the finance area,
  - in **bulk** across multiple selected athletes.
- Athlete charge lists now include the linked athlete record so staff can review and update charge status without losing context.

**Intentionally deferred:** ledger postings, invoices, payment gateways, tax lines, inventory links.

## Reporting placeholders (wave one)

- `report_definitions`, `saved_filter_presets` — unchanged; future reporting can key off the new entities via `tenantId` and indexed foreign keys.

## Future packaging (tiers)

Domain code is grouped by module folders (`athlete`, `training`, `finance`, …) so **capability packaging** (Starter / Operations / Growth) can map to module sets later without renaming tables.
