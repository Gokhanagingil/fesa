# Reporting and command center

## What this wave adds

Wave 3 turns reporting from a finance-and-scheduling snapshot into a broader operating command center:

- `/api/reporting/definitions` now returns live report cards with i18n keys for collections, scheduling, and athlete balance monitoring.
- `/api/reporting/command-center` returns tenant-aware operational + finance visibility for the reports page.
- `/api/finance/dashboard-summary` powers the dashboard command center with:
  - athlete / session counts
  - active coach count
  - private lessons scheduled this week
  - attendance distribution
  - upcoming sessions by group
  - outstanding / overdue / collected totals
  - recent payment activity
  - top outstanding athletes
- Reporting surfaces now also expose:
  - upcoming private lessons with coach + billing visibility
  - communication-readiness counts for audience assembly
  - report cards for private lessons and communication operations

## Scheduling and bulk operations

The product now includes pragmatic bulk tooling inside the existing training surface:

- recurring session generation backed by `training_session_series`
- bulk cancellation for selected sessions
- bulk day-shift rescheduling for planned sessions only
- free-text note append during bulk actions so staff can leave a clear audit trail in session notes

This intentionally stays short of a full queue/worker bulk engine. The workflow is synchronous, tenant-scoped, and designed for day-to-day club operations rather than abstract infrastructure.

## Current conventions

- **Report keys** remain stable identifiers with `titleKey` resolved in the frontend.
- **Saved filters** now back communication-audience presets conceptually, but remain intentionally lean and surface-specific.
- **Bulk actions** remain synchronous route-level actions inside the current modules rather than a generic async command bus.

## Intentionally still deferred

- CSV / Excel export workflows
- scheduled report delivery
- saved report presets beyond communication-targeting use cases
- background bulk job orchestration and audit dashboards
