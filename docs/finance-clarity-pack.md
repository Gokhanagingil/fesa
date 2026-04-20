# Athlete Charges Flow Flattening & Collections Clarity Pack

This sprint is **depth-first, clarity-first, mobile-first**. It does **not** add a payment gateway, an accounting ledger, a parallel billing engine, or a duplicate collections workspace. It simplifies, reorders, and strengthens the finance surfaces the platform already ships.

## Goals

- Flatten the athlete charges flow into one calm operational journey.
- Make collections clarity obvious for staff users without alarmist UX.
- Make payment recording and follow-up preparation easier to find.
- Reduce visual and interaction complexity in finance-heavy screens.
- Improve mobile-first usability significantly.
- Prepare clean ground for the planned **Payments & Collections Experience v1** wave without pre-building it.

## What changed

### Athlete charges page (`/app/finance/athlete-charges`)

| Before | After |
|---|---|
| Three nested `<details>` panels (bulk assign + periodic generation + record collection) sat at equal visual weight. | Single **action drawer** with a segmented control. Only the chosen action is mounted at a time. |
| Power-user fields (payment method, reference, notes, periodic notes/amount/due overrides) competed for attention by default. | Power-user fields live behind an **"Advanced details"** disclosure inside each action panel. |
| The athlete picker was a wide always-visible card next to the action stack. | The athlete picker is a calm `<details>` disclosure inside the bulk panel only, surfaced when relevant. |
| The list dominated mobile width with horizontal table scroll first. | Stacked cards on small screens, table on `md+`. |
| Recent collections was a half-width column nested inside the action grid. | Recent collections is its own calm section below the list with mobile cards. |
| There was no in-page collections clarity strip — staff had to leave for `/app/finance` to see who needs attention. | A small **"Who needs attention"** strip sits above the drawer with a direct **Prepare follow-ups** handoff. |

The drawer's tab-style segmented control is keyboard-accessible (`role="tablist"` + `aria-selected`) and the "Open athletes" link in the section header keeps the operational hop into roster review one tap away.

### Finance hub (`/app/finance`)

The page is reordered so the **primary jobs come first**:

1. Compact summary band (charged / collected / outstanding / overdue) — read first, no competing eyebrow text.
2. **Primary action surface:** the Athlete Charges link is promoted to the visual top with a single calm CTA.
3. **Priority collections** strip — the same data as before, now visually demoted from a 4-link nav grid + reporting hero stack.
4. **Private lesson follow-up** — only renders when there is real follow-up to do (no "noPrivateLessonCollections" empty card spending visual budget).
5. **More finance tools** — the demoted strip that hosts charge items, private lessons, communications, the reporting deep-links, and the advanced explorer behind progressive disclosures.

The reporting hero (which previously sat above all of this) now lives as a calm `<details>` disclosure inside "More finance tools".

### Finance → Follow-up continuity

The clarity strip on the athlete charges page reuses the **existing** communications follow-up surface. No parallel reminder tool is created. The handoff URLs preserve source/context honesty:

- `source=finance_overdue` keeps the existing finance source surface intact.
- `template=overdue_payment_reminder` keeps the existing template intact.
- `sourceKey=athlete-charges` (or `athlete-charges-<athleteId>`) provides an explicit re-open key so the existing follow-up history can return staff to the original list.

This is the same contract the priority collections strip on the finance hub already used; we simply mirrored it on the athlete charges page so staff never has to leave the page to start a calm follow-up.

## What stayed exactly the same (intentional)

- All API routes and request/response shapes for `/api/athlete-charges`, `/api/payments`, and `/api/finance/athlete-summaries`.
- The derived `pending` / `partially_paid` / `paid` / `cancelled` charge state model, including the unique billing-period index that prevents duplicate periodic charges.
- Tenant scoping on every read and write.
- The communications follow-up surface (templates, audience filters, source surfaces, history).
- The reporting starter views and finance overdue / outstanding / by-category deep-links.
- Locale parity rules under `npm run i18n:check`.

## Validation

- `npm run lint` — passes with `--max-warnings 0`.
- `npm run i18n:check` — TR/EN parity now also covers the new drawer / attention / hub copy.
- `npm run frontend:smoke` — existing communications follow-up smokes still pass; the clarity strip reuses the same handoff contract they assert.
- `npm run finance:clarity:test` — **new** pure-Node validator that protects the contracts introduced by this sprint:
  1. AthleteChargesPage uses a single action drawer (no `<details open>` stack, conditional `openAction` panels).
  2. AthleteChargesPage surfaces the collections clarity strip and exposes the documented copy keys.
  3. AthleteChargesPage preserves source/context honesty when handing off to communications.
  4. FinanceHubPage leads with summary → primary action → priority collections → demoted more-tools strip (the reporting hero must NOT sit above the priority collections section anymore).
  5. EN + TR both ship the new calmer copy.
- `npm run stabilization:gate:test` — unchanged, still green; charge-item delete confirm and other stabilization contracts still hold.

## Intentionally deferred

The following are out of scope for this sprint and remain queued for **Payments & Collections Experience v1**:

- A real ledger / invoice / receipt model.
- A payment gateway integration.
- A bulk reconciliation surface.
- A "collections workspace" page that competes with the athlete charges page.
- Per-charge partial-payment UI in the list (today still surfaces via the action drawer's allocation panel).

## Rollback

The change is purely on the web client (two pages + i18n keys + a docs/test pair). To revert:

1. `git revert` the clarity-pack commits.
2. Run `npm run i18n:check` and `npm run finance:clarity:test` will be removed alongside the revert; re-add the validator only if the structural contracts come back.

No data migrations, no backend behavior changes, no env-var changes are required.
