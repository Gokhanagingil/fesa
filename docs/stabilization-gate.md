# FESA Stabilization & Productization Gate

This document records the **non-feature** sprint that hardened the platform
between the Parent Portal v1.3 wave and the next major capability wave. The
goal was explicitly *not* to add new modules; it was to remove cross-module
friction, sharpen action hierarchy, and increase trust in journeys that
already exist.

## Why this sprint existed

By the end of the Parent Portal v1.3 wave the platform had crossed the
"interesting feature set" threshold:

- onboarding / import / go-live confidence
- parent portal / branding / club updates
- family activation and landing
- communication / follow-up
- inventory
- finance readiness surfaces
- athlete media
- reporting / validation / smoke infrastructure

The **primary product risk** had moved from "we are missing another big
module" to "hidden friction between modules, broken transitions, stale
state, UX overload in older surfaces, mobile awkwardness in the highest
traffic journeys, and small correctness bugs that erode trust."

This sprint was the explicit **stabilization & productization gate** that
addressed those risks before opening the next wave.

## Journeys hardened

| Journey | What changed | Why |
|---|---|---|
| **Parent portal — daily use** | Home now refetches when the tab becomes visible again, so a parent returning from `/portal/actions/:id` after submitting sees up-to-date attention counts and continuity strip without a hard refresh. The `#family` / `#updates` mobile bottom-nav shortcuts no longer dead-end on non-home routes (they navigate back to `/portal/home#…`). The lower "All requests" section is now a calm "Past requests" archive that filters out items already shown in "What needs your attention", so the page stops repeating the same CTA. The empty club-updates strip no longer echoes the hero welcome copy. | Trust: parent should never doubt that they sent something. Calm: a single source of "do this now". |
| **Parent activation** | A dead invite token (expired / used / malformed / missing) now offers explicit **Recover an existing account** and **Sign in** escapes instead of leaving the parent at a card whose only exit was the brand link. New `GuardianPortalActivationPage.smoke.test.tsx` covers valid invite, dead invite, and successful submission. | Trust: a parent who clicks an old invite link should never feel stuck. |
| **Parent action submission** | Submitting a request no longer auto-redirects 700ms later. The page stays put, refetches the action, shows a clear success alert, and updates the status badge / history. The parent uses the explicit **Back to home** link when they're ready. | Calm + correctness: the previous behavior threw the parent at a stale home before they could read the confirmation. |
| **Staff Action Center** | Per-row mutations (Resolve / Snooze / Dismiss / Mark read) now surface API errors as a per-row `InlineAlert` instead of swallowing them. The row layout reflows on mobile so the primary **Resolve** action is full-width and the deep links are calmer secondary actions. | Trust: failed actions used to look successful until the next manual refresh. |
| **Staff Settings** | The Header's `?section=platform|club|brand|delivery` deep links are now honoured: matching anchor ids exist on the page and the corresponding section scrolls into view on mount. | Coherence: the navigation gesture finally does what it implies. |
| **Charge items** | Delete now requires a `window.confirm` gate with the item name interpolated. Aligns with the existing inventory-delete guardrail. | Correctness: charge items are referenced by historical athlete charges; an accidental delete was a real risk. |
| **Athletes list / detail** | Athletes-list error now uses `InlineAlert` (was a raw red `<p>`). Athlete-detail "inventory in hand" empty state is now a dashed card with calmer wording (was a single muted line that read as "no data" rather than "nothing assigned yet"). | Coherence between newer and older surfaces. |
| **Onboarding drawers** | Hardcoded English error fallbacks (`'Failed to load batch'`, `'Failed to load step history'`) replaced with `t('app.errors.loadFailed')`. | Tone: drawers feel product-native, not debuggy. |
| **Staff sidebar (mobile)** | Active link scrolls into view on every route change so the horizontal nav strip never pretends the user is on Dashboard when they are really on Communications. Tap targets gain `min-h-[40px]` and snap-x snap-start. | Mobile ergonomics on a 17-link strip. |
| **PortalShell mobile bottom-nav** | Off-home, the **Family** and **Updates** shortcuts navigate to `/portal/home#…` instead of relying on a `#…` href that does nothing on `/portal/actions/:id`. `GuardianPortalHomePage` honours an incoming hash on landing. | Predictability: a tap should never be a dead gesture. |

## Validation

The stabilization sprint added one new pure-Node validator and one new
smoke test, and re-uses every existing protection script:

| Check | Coverage |
|---|---|
| `npm run lint` | ESLint across the API, web, and shared packages with `--max-warnings 0`. |
| `npm run i18n:check` | Locale parity for the protected key prefixes (extended with the new portal/activation keys this sprint added). |
| `npm run repo:guard` | Repo / workspace structure invariants. |
| `npm run frontend:smoke` | 13 smoke test files, 60 tests — including the new `GuardianPortalActivationPage.smoke.test.tsx`. |
| `npm run stabilization:gate:test` | **New**: pure-Node validator that fails if any of the six stabilization contracts regresses (action-center error surfacing, charge-item delete confirm, portal past-requests separation, activation recovery escape, settings deep-link anchors, portal bottom-nav off-home navigation). |
| `npm run tenant:branding:test` | Tenant branding contract. |
| `npm run club:updates:test` | Club updates surface contract. |
| `npm run family:activation:test` | Family activation surface contract. |
| `npm run parent:portal:v1.3:test` | Parent portal v1.3 contract. |
| `npm run onboarding:imports:test` / `onboarding:readiness:test` | Onboarding surface contracts. |
| `npm run reporting:filter-tree:test` / `reporting:starter-views:test` | Reporting validators. |
| `npm run media:isolation:test` | Tenant-isolated media storage. |
| `npm run whatsapp:delivery:test` | WhatsApp Cloud delivery client / provider / orchestrator. |

All checks pass on this branch.

## What is intentionally *not* in this sprint

- No new modules.
- No "bigger redesign" of athletes / charges / dashboard. The discovery
  identified those as candidates for a future *coherence* sprint, but
  redesigning them now would have violated the "depth over breadth"
  principle of this gate.
- No mobile staff sidebar drawer — only minimal scroll-into-view polish.
  A full drawer is a larger, separate body of work.
- No payment capture, no accounting closure checklist. Those remain in
  the deferred list in `docs/README.md`.
- No tenant-isolation regressions: every API change in this sprint
  preserved `TenantGuard` + `req.tenantId!` enforcement; in fact, no
  API tenant-scoping behaviour was changed at all.

## Recommended next phase

Pick **one** of:

1. **Athlete detail coherence pass** — reduce scroll, deduplicate finance
   surfaces (sidebar + enrollment + charges section), and align with the
   newer parent-portal calmness.
2. **Athlete charges flow flattening** — replace the nested
   `<details>` bulk / periodic / payment hierarchy with a stepped
   flow or tabs, so "record payment" stops being buried.
3. **Communications page primary path** — progressive disclosure for the
   six scenarios + four channels + filter grid, so the default screen
   feels guided rather than a power-user cockpit.

Each is a self-contained product polish, not a new capability wave.
