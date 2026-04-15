# Reporting and command center

## What this wave adds

Wave 4 keeps reporting on the same operational command-center surface while closing product drift and exposing cleaner club-lifecycle signals:

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

## Stabilization notes in this wave

This wave also closes a few product-quality gaps that affected reporting-adjacent trust:

- dashboard and finance labels now resolve through the intended i18n keys instead of leaking raw keys or drifting into fallback English
- command-center communication readiness is now populated from the live communication audience service instead of returning empty placeholder counts
- groups and teams list contracts are aligned with strict API validation, which keeps linked reporting/filter surfaces from failing on shared query parameters

## Scheduling and bulk operations

The product now includes pragmatic bulk tooling inside the existing training surface:

- recurring session generation backed by `training_session_series`
- bulk cancellation for selected sessions
- bulk day-shift rescheduling for planned sessions only
- free-text note append during bulk actions so staff can leave a clear audit trail in session notes

This intentionally stays short of a full queue/worker bulk engine. The workflow is synchronous, tenant-scoped, and designed for day-to-day club operations rather than abstract infrastructure.

## Collections operations in the current command center

Collections reporting remains intentionally pragmatic:

- manual charge assignment and payment allocation stay unchanged
- bulk charge assignment remains available for one-off roster work
- periodic generation now adds a lightweight billing-period key/label so monthly or period-based dues can be generated safely without duplicating the same athlete/item/period combination
- command-center finance summaries continue to derive paid / partial / overdue state from payment allocations instead of introducing a second accounting model

## Current conventions

- **Report keys** remain stable identifiers with `titleKey` resolved in the frontend.
- **Saved filters** now back communication-audience presets conceptually, but remain intentionally lean and surface-specific.
- **Bulk actions** remain synchronous route-level actions inside the current modules rather than a generic async command bus.

## Intentionally still deferred

- CSV / Excel export workflows
- scheduled report delivery
- saved report presets beyond communication-targeting use cases
- background bulk job orchestration and audit dashboards
