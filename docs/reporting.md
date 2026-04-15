# Reporting and command center

## What Wave 6 adds

Wave 6 keeps the existing reporting and command-center backbone, then extends it into a practical daily action surface:

- `/api/reporting/definitions` still returns stable live report cards with i18n keys.
- `/api/reporting/command-center` now combines:
  - finance command-center data,
  - private-lesson follow-up visibility,
  - communication-readiness counts,
  - family workflow counts and recent family-action items,
  - **action-center counts and top priority items** for immediate staff follow-through.
- `/api/action-center/items` now exposes the shared operational backlog used by:
  - the header notification center,
  - the dedicated staff work queue page,
  - dashboard and report action summaries.

## Action center model

Wave 6 intentionally does **not** introduce a parallel workflow engine.

Instead, it derives actionable items from current operational truth:

- overdue or near-due finance follow-up,
- family requests awaiting guardian response,
- family requests awaiting staff review,
- readiness gaps that block clean operations,
- upcoming private lessons missing prep details,
- upcoming training sessions missing prep details,
- recently finished sessions with no attendance recorded.

Each active item carries:

- a tenant-safe stable `itemKey`,
- a derived `snapshotToken` so read/dismiss state only applies to the current operational condition,
- a category, type, urgency, deep link, and optional communication pivot,
- lightweight persisted state (`read`, `dismissed`, `completed`, `snoozedUntil`) in `action_center_item_states`.

That keeps the queue trustworthy: if the underlying issue changes materially, the item can resurface instead of remaining silently hidden.

## Command center conventions

- **One operational truth:** reporting, dashboard, action center, finance, family workflows, and communications all build from the same current modules.
- **No notification vanity:** items only exist when they represent clear staff action, not passive system noise.
- **Deep-link first:** queue items land on the exact workflow surface (`finance`, `athlete detail`, `training`, `private lessons`, `communications`) rather than vague landing pages.
- **Bulk actions stay pragmatic:** mark read, dismiss, complete, and snooze are route-level actions on the action-center API, not a generic async command bus.

## Communication follow-through

Wave 6 keeps communications in the “preparation and targeting” lane:

- action-center items can pivot into `/app/communications` with prefilled filters,
- audience reasons still explain why the athlete or family is included,
- reporting can now show both the backlog and the size of the likely outreach population.

This keeps follow-through operational without drifting into a full outbound messaging platform.

## Intentionally still deferred

- CSV / Excel export workflows
- scheduled report delivery
- saved report presets beyond communication-targeting use cases
- background bulk job orchestration and audit dashboards
- email / SMS / WhatsApp delivery infrastructure
- public guardian authentication / external family portal delivery
