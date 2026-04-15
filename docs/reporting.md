# Reporting and command center

## What Wave 5 adds

Wave 5 keeps reporting on the same operational command-center surface while extending it for family-facing readiness and controlled workflow closure:

- `/api/reporting/definitions` continues to return live report cards with i18n keys instead of introducing a separate reporting registry.
- `/api/reporting/command-center` now combines:
  - finance command-center data,
  - private-lesson follow-up visibility,
  - communication-readiness counts,
  - family workflow counts and recent family-action items.
- `/api/communications/audiences` now supports family-readiness and follow-up filters in addition to group/team/training/finance targeting.

## Family workflow visibility

The command center now exposes a pragmatic family-operations layer:

- athletes with **incomplete family readiness**
- athletes **awaiting family action**
- athletes **awaiting staff review**
- recent family action requests so staff can see what changed without opening each athlete profile first

This is intentionally not a generic workflow inbox. The goal is to make the most important club-follow-up queues visible where managers already work.

## Communication follow-through

Communication reporting now uses the same workflow/readiness model as athlete and guardian detail:

- audience counts can reflect incomplete family readiness
- follow-up audiences can be filtered to “needs follow-up”
- reporting surfaces can quantify athletes waiting on family response vs staff review

That keeps reporting, athlete detail, and communications aligned on one operational truth instead of parallel status systems.

## Current conventions

- **Report keys** remain stable identifiers with `titleKey` resolved in the frontend.
- **Saved filters** still back communication-audience presets conceptually, but remain intentionally lean and surface-specific.
- **Bulk actions** remain synchronous route-level actions inside the current modules rather than a generic async command bus.
- **Family workflows** use a lean status model and event history, not a BPM engine.

## Intentionally still deferred

- CSV / Excel export workflows
- scheduled report delivery
- saved report presets beyond communication-targeting use cases
- background bulk job orchestration and audit dashboards
- public guardian authentication / external family portal delivery
