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
- **`training_session_series`** — recurring scheduling template rows that generate concrete `training_sessions` on selected weekdays and keep repeated planning out of manual repetition hell.
- **`attendances`** — one row per `(trainingSessionId, athleteId)` with status and optional note.

Eligibility rule in the API: an athlete must share the session’s **primary group**; if the session targets a team, the athlete needs an **active** (no `endedAt`) membership in that team.

### Operational UX implications in the current product wave

- **Athlete lists** can now be filtered by **group** and by **active team membership**, which keeps the group-vs-team split visible in day-to-day roster work.
- **Groups** are presented as the main training container, with direct jumps into the athlete list and session planning.
- **Teams** are presented as optional squads layered on top of groups, with direct jumps into filtered athlete rosters.
- **Attendance** uses the same rule set: a team session loads only athletes who both belong to the session group and currently hold an active membership in that team.
- **Recurring planning** stays group-first and team-optional. Series generation creates normal session rows, so attendance, list views, and bulk operations continue to work on the same product surface.
- **Bulk rescheduling/cancellation** stays intentionally narrow: bulk shift is limited to planned sessions, and bulk cancel appends explicit notes so staff actions remain traceable.

## Coaching operations

- **`coaches`** — lean operational staff records for scheduling, group/team ownership, and private lessons.
- **Groups** and **teams** can each carry an optional **`headCoachId`** for day-to-day accountability without introducing HR complexity.
- **Training sessions** and **training session series** can carry an optional **`coachId`** so the normal planning board becomes coach-aware while keeping the existing group/team semantics intact.

### Why this stays lean

- Coaches are treated as **operational actors**, not employees with payroll, permissions, or contracts.
- The same coach can be visible across:
  - structural ownership (group / team),
  - schedule ownership (training sessions),
  - premium individual work (private lessons).

## Private lessons

- **`private_lessons`** — explicit 1-to-1 lesson rows linked to:
  - one athlete,
  - one coach,
  - one sport branch,
  - scheduled start/end,
  - optional focus, location, notes,
  - status and optional attendance outcome.

### Why private lessons are separate from training sessions

The existing training domain intentionally requires:

- a **group** on every training session,
- optional **team** filtering inside that group,
- attendance eligibility based on the athlete’s **primary group** and optional active team membership.

That makes standard sessions excellent for cohort operations, but awkward for 1-to-1 coaching. A separate private-lesson model keeps:

- group vs team semantics clean,
- attendance rules trustworthy,
- UX obvious for staff (“who / coach / when / billing”),
- future reporting and communication targeting straightforward.

### Finance linkage

- A private lesson can optionally create an **athlete charge** at creation time.
- The finance row links back through **`athlete_charges.privateLessonId`**.
- This keeps payment allocation and derived charge-state logic centralized in the existing finance flow instead of inventing lesson-specific payment logic.

## Guardians

- Guardians remain reusable tenant-level contact records.
- The product wave now treats guardian operations as a first-class workflow:
  - browse guardians,
  - open a guardian profile,
  - edit guardian contact details,
  - see linked athletes from the guardian side,
  - create a guardian directly from an athlete profile and link them in one flow.

## Finance

- **`charge_items`** — reusable catalog (name, category, default amount, currency, active flag).
- **`athlete_charges`** — an amount assigned to an athlete, optional due date, status (pending / partially_paid / paid / cancelled).
- **`payments`** — recorded collections against an athlete with amount, currency, method/reference, and paid timestamp.
- **`payment_allocations`** — how a payment is applied across one or more athlete charges.

### Current operational finance flow

- Clubs define reusable **charge items** and can manage active/inactive state directly from the list.
- **Athlete charges** can be assigned:
  - individually from an athlete profile,
  - individually through the finance area,
  - in **bulk** across multiple selected athletes.
- **Payments** are recorded explicitly and allocated to one or more open athlete charges.
- **Charge status is derived from allocations** for non-cancelled rows:
  - no allocations -> `pending`
  - some but not full allocation -> `partially_paid`
  - fully allocated -> `paid`
- **Overdue** remains a computed operational state based on due date plus remaining balance, not a separate stored enum.
- Athlete finance views now expose total charged / collected / outstanding / overdue values plus recent payment activity.

**Intentionally deferred:** ledger postings, invoices, payment gateways, tax lines, inventory links, and full accounting reconciliation.

## Reporting & command center

- Reporting remains tenant-scoped and intentionally pragmatic rather than BI-heavy.
- The current wave exposes:
  - report definition metadata for the web command center,
  - a live command-center summary for scheduling, attendance, balances, and recent collections,
  - finance summary endpoints that power dashboard, reports, and athlete finance surfaces.

## Communication operations foundation

- Communication remains **operational targeting**, not a full messaging platform.
- The current wave adds a tenant-scoped audience builder on top of existing athlete / guardian / session / private-lesson / finance data.
- Targeting can be assembled by:
  - group,
  - team,
  - training session cohort,
  - private-lesson status / coach / date window,
  - outstanding or overdue finance state,
  - primary-contact guardian visibility.

The output is intentionally simple:

- a clear **who is included** preview,
- explicit **why included** reasons,
- copy-friendly contact lines and draft preparation support,
- reuse of **`saved_filter_presets`** as the groundwork for future saved communication audiences.

`report_definitions` and `saved_filter_presets` stay lean so future saved filters/export flows can evolve without reshaping the operational entities above.

## Future packaging (tiers)

Domain code is grouped by module folders (`athlete`, `training`, `finance`, …) so **capability packaging** (Starter / Operations / Growth) can map to module sets later without renaming tables.
