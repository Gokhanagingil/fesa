# FESA Stabilization & Productization Gate — Trust & Calm Pass

This document records the second hardening pass on top of the original
**FESA Stabilization & Productization Gate** (see
[stabilization-gate.md](./stabilization-gate.md)) and the **Athlete
Charges Flow Flattening & Collections Clarity Pack** (see
[finance-clarity-pack.md](./finance-clarity-pack.md)).

It is **explicitly not** a feature wave. No new modules, no new domain
concepts, no new tables, no new API routes. The pass is a depth-first,
trust-first sweep that closes a small set of cross-module friction
points discovery surfaced in the parent-facing journeys, the shared
network layer, and the staff communications surface.

## Why this pass existed

The previous stabilization gate tightened the parent journey on the
big strokes:

- `/portal/home` refetches on tab focus and the past-requests archive
  no longer duplicates the attention surface,
- the activation page offers explicit Recover / Sign-in escapes,
- the action page no longer auto-redirects after submit,
- the staff Action Center surfaces per-row mutation errors,
- the bottom-nav shortcuts no longer dead-end on non-home routes.

Discovery on this pass found a set of smaller but trust-critical
issues sitting *underneath* those big improvements:

| Area | What discovery showed |
|---|---|
| Landing page | The English locale was missing `landing.ctaPortal`, so the public landing page rendered the raw key `landing.ctaPortal` for English visitors. The about card also reused `pages.dashboard.subtitle` + `pages.groups.subtitle` for filler, so unrelated copy edits could mutate the landing hero unexpectedly. |
| Shared API client | `parseError` fell back to a hardcoded English `'Request failed'` whenever the server response had no usable body (network blip, proxy 502). Turkish parents seeing English error chrome breaks the otherwise-Turkish portal trust we'd built up. |
| Parent action page | A missing `:id` route param (broken bookmark, share-truncated link, manual typo) left the page on an infinite loading spinner because the early-return in the load effect skipped `setLoading(false)`. The submit control was also a small `py-2` button on mobile, undersized vs the textarea above it — the most important parent action was the weakest CTA. The wording was staff-tone ("Submit response", "Your response was submitted for club review") rather than parent-tone. |
| Portal shell | The sign-out chip on the parent portal header was a `text-xs px-3 py-1.5` control — sub-spec on a phone for what is the only deliberate exit from the portal. |
| Staff communications | The bundle (`/api/groups`, `/api/teams`, `/api/coaches`, `/api/training-sessions`, `/api/communications/templates`) and history loaders silently swallowed fetch failures, so a partial backend failure looked like a brand-new tenant with zero data. Staff had no signal that anything had failed. |

## What changed

| Surface | Change | Why |
|---|---|---|
| `apps/web/src/pages/LandingPage.tsx` + `apps/web/src/i18n/locales/{en,tr}/common.json` | EN ships the `landing.ctaPortal` and `landing.entry*` keys TR already had. The about card now reads from a small landing-owned copy contract (`landing.entryTitle`, `landing.entryStaffTitle/Body`, `landing.entryGuardianTitle/Body`) instead of borrowing dashboard / groups subtitles. EN `ctaSecondary` is now "Learn more" (matching TR "Daha fazla bilgi") since it scrolls to the about card, not the guardian portal. | Trust: the public landing page is the first impression and must never render the raw key string. Stability: edits to dashboard or groups copy can no longer mutate the landing hero. |
| `apps/web/src/lib/api.ts` + `app.errors.requestFailed` (EN/TR) | `parseError` now falls back through `i18n.t('app.errors.requestFailed')` when the response body cannot be parsed, instead of the hardcoded English `'Request failed'`. | Tone: no more accidental English in an otherwise-Turkish portal experience. |
| `apps/web/src/pages/GuardianPortalActionPage.tsx` | Missing-id branch now resolves `setLoading(false)` and surfaces the calm `app.errors.loadFailed` line, so a parent who reaches the page with no `:id` is never stuck on a spinner. The primary submit Button adopts the mobile-first `h-12 w-full` pattern (matching the activation / login pages) and right-aligns from `sm` upward. New `GuardianPortalActionPage.smoke.test.tsx` covers all three paths (loaded action with primary control, missing-id graceful fall-through, in-place success refetch). | Correctness + trust: the most important parent action on the page becomes the most visible and most reliable control. |
| `pages.guardianPortal.action.*` (EN/TR) | Wording softened from staff-tone to parent-tone: "What your club is asking" / "Send my response" / "Thanks — your response is on its way to your club." instead of "Request details" / "Submit response" / "Your response was submitted for club review." `backHome` is now "Back to family portal" / "Aile portalına dön". | Tone: the page now reads like the parent's own surface, not an internal staff queue. |
| `apps/web/src/components/layout/PortalShell.tsx` | Sign-out chip is now `min-h-[40px]`, comfortable for a thumb on a phone, while keeping the same visual treatment on tablet+ where it sits beside the language switch. | Mobile ergonomics on the only deliberate exit from the portal. |
| `apps/web/src/pages/CommunicationsPage.tsx` | The bundle loader (`/api/groups`, `/api/teams`, `/api/coaches`, `/api/training-sessions`, `/api/communications/templates`) now calls `setError(...)` after clearing dropdowns, and the history loader does the same after zeroing the counts. The existing inline error alert at the top of the page surfaces both. | Trust: a broken backend used to look like an empty tenant. Now staff see the failure and can act, not silently lose the page. |

No backend behavior changed, no API contracts changed, no migrations
were added, no tenant-scoping logic was touched. Every change is on
the web client and its locales.

## Validation

The pass adds one new validator and one new smoke test, and re-runs
every existing protection script:

| Check | Coverage |
|---|---|
| `npm run lint` | ESLint across the API, web, and shared packages with `--max-warnings 0`. |
| `npm run i18n:check` | Locale parity for the protected key prefixes (extended with the new `landing.*` and `app.errors.requestFailed` keys this pass added). |
| `npm run frontend:smoke` | 14 smoke test files, 65 tests — including the new `GuardianPortalActionPage.smoke.test.tsx`. |
| `npm run trust:calm:test` | **New**: pure-Node validator that fails if any of the six Trust & Calm Pass contracts regresses (landing locale parity, localized API error fallback, action page id-guard, action page mobile primary control, portal sign-out tap target, communications error surfacing). |
| `npm run stabilization:gate:test` | Unchanged — every original stabilization contract still holds. |
| `npm run finance:clarity:test` | Unchanged — every clarity-pack contract still holds. |
| `npm run repo:guard` | Repo / workspace structure invariants. |
| `npm run tenant:branding:test`, `club:updates:test`, `family:activation:test`, `parent:portal:v1.3:test`, `parent:invite:delivery:test`, `parent:access:stabilization:test`, `media:isolation:test`, `whatsapp:delivery:test`, `onboarding:imports:test`, `onboarding:readiness:test`, `reporting:filter-tree:test`, `reporting:starter-views:test` | All unchanged and green on this branch. |

All checks pass on this branch.

## What is intentionally *not* in this pass

- **No new modules.** This pass is depth-first.
- **No athletes-list mobile card-stack.** The athletes list still uses
  `min-w-[520px]` with horizontal scroll on phones. Converting it to a
  card-stack is a legitimate next-phase candidate but a larger,
  separate body of work.
- **No staff sidebar drawer.** The 17-link horizontal snap strip on
  mobile is calmer than it used to be after the original stabilization
  gate (active link scrolls into view), and a full drawer remains
  deferred from that gate.
- **No payment gateway / accounting closure / collections workspace.**
  These remain queued for the planned Payments & Collections
  Experience v1 wave.
- **No tenant-isolation regressions.** No API change in this pass; the
  client tenant header behavior is unchanged.
- **No activation copy rewrite.** The Recover / Sign-in escape pair
  the original stabilization gate added is the right thing to do for a
  parent who lost access; we keep the existing wording intact.

## Recommended next phase

Pick **one** of:

1. **Athletes list mobile card-stack** — convert the staff athletes
   list from a horizontal-scroll table to a stacked-card layout on
   small screens, mirroring the calm pattern the parent portal already
   uses. Keep the table on `md+` for power users.
2. **Communications draft / history mobile pass** — the staff
   communications page is dense; the same depth-first treatment that
   the finance hub got could meaningfully reduce friction without
   adding new capability.
3. **Onboarding wizard mobile pass** — the import preview / mapping
   tables (`min-w-[480-640px]`) force horizontal scroll on phones; a
   stacked-card alternative for small screens would meaningfully
   reduce cramping during go-live without changing the dependency-
   aware import contract.

Each is a self-contained product polish, not a new capability wave.
