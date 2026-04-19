# Communication & Follow-up

## Wave 13.2 — Communication & Follow-up Pack v1.2

This refinement layers on top of v1.1 without introducing a parallel
communication module.  The headline shifts again — slightly:

> from “we can comfortably manage and revisit follow-up work”
> to “follow-up feels mature, calmly aware of context, honestly
> reachable, and naturally connected to bulk operations.”

### What ships in v1.2

| Area | Change |
|------|--------|
| Token resolution | `{{branchName}}` is now resolved per recipient from the athlete's own sport branch (no more `null`/`—` when the audience spans multiple branches). `{{clubName}}` is resolved from the audience response `meta.clubName` (sourced from the active tenant) so club staff get warm, branded messages without manual editing. The token catalog itself is unchanged; we only made existing tokens fill more reliably. |
| Audience meta | `GET /api/communications/audiences` now returns a small `meta: { clubName }` block plus richer reach counts: `athletesWithEmailReach` and `athletesUnreachable` in addition to `athletesWithPhoneReach` and `athletesMissingPhone`.  Tenant scoping is unchanged. |
| Reachability honesty | The audience banner adds an unreachable chip when at least one family has no contact at all, plus a “All families on this list have a way to be reached” reassurance line when reach is total.  A new “Show reachable only” toggle filters the visible recipient list without losing the original audience.  The recipient-card chip is built from the new `classifyMemberReach()` helper so `whatsapp`, `phone`, `email`, and `unreachable` reads consistently across the page. |
| Stale draft awareness | The `GET /api/communications/templates` endpoint now returns `lifecycle.staleAfterDays` (default `5`).  Drafts older than that surface a calm “Still relevant?” chip in history rows, an info banner above the history list, and a soft amber hint at the top of the draft editor when an old draft is reopened.  No new lifecycle states, no scheduling, no nagging. |
| Lifecycle clarity | The status pill in the editor now also shows a relative “Drafted today / Drafted X days ago / Logged X days ago” line and a tooltip explaining the visibility rule (`Draft — only saved for you`, `Logged — visible to club staff`). |
| History filters | The history list adds three optional dropdowns — Template, Channel, Source — that operate client-side over the loaded items.  Combined with the existing status pills (`Active`, `Drafts`, `Logged`, `Archived`) staff can find a similar past follow-up much faster.  Empty filter state has its own warm copy. |
| Bulk → follow-up | The audience query now accepts `guardianIds[]`; supplying one resolves the audience through `athlete-guardians` so staff can flow naturally from the Guardians bulk selection into a warm draft.  GuardiansPage gains a `Prepare follow-up` bulk action that deep-links into `/app/communications` with `source=guardians_selection`, `primaryContactsOnly=true`, and the WhatsApp channel pre-selected.  AthletesPage already had `Prepare message`; both now share the same source-surface vocabulary. |
| Finance bridge | The Finance hub priority-collections list shows a dedicated `Prepare reminder` link per athlete, deep-linking into the overdue payment template with the right `source=finance_overdue` attribution. |
| Mobile UX | Channel and template chip rows scroll horizontally on small screens with comfortable 40 px tap targets while keeping their flex-wrap behaviour from `sm` upwards.  Tab buttons grew to 40 px.  The recipient card already had a stacked layout under `sm`; the audience banner gains a touch-friendly “Show reachable only” pill that lives inline with the chips. |
| Tone | Copy is calmer (“This draft has been waiting a few days. Refresh the audience or update the message before continuing.”) and avoids CRM language.  Stale wording is intentionally soft. |

### Token catalog (v1.2)

The catalog itself is unchanged from v1.1.  What v1.2 changes is *fill
reliability*:

- `{{branchName}}` — now read per recipient from the athlete's
  `sportBranch.name` first, then any draft-level fallback.
- `{{clubName}}` — read from `audiences.meta.clubName` (the active
  tenant name).
- All other tokens (`{{athleteName}}`, `{{guardianName}}`,
  `{{groupName}}`, `{{teamName}}`, `{{coachName}}`,
  `{{sessionLocation}}`, `{{nextSession}}`, `{{outstandingAmount}}`,
  `{{overdueAmount}}`) behave exactly as in v1.1; `{{name}}` remains an
  alias of `{{athleteName}}`.

Missing values still degrade to `—` and are aggregated into the “missing
for these recipients” warning so the operator can see the gap before
opening WhatsApp.

### Stale draft policy

- A draft becomes “stale” when its `updatedAt` (or `createdAt`) is
  `staleAfterDays` or more days in the past.
- The default window is `COMMUNICATION_DRAFT_STALE_AFTER_DAYS = 5` and is
  exposed via `GET /api/communications/templates`'s new
  `lifecycle.staleAfterDays` field so the UI never has to hard-code it.
- Stale drafts surface in three places:
  1. A summary chip / `InlineAlert` above the history list.
  2. A `Still relevant?` chip on the matching history rows.
  3. A small amber notice at the top of the editor when the operator
     reopens a stale draft.
- Logged or archived rows are never marked stale.  The hint never blocks
  any action.

### Reachability honesty

`classifyMemberReach(member, channel)` returns one of:

| State | Meaning |
|-------|---------|
| `whatsapp` | a phone is on file and the operator picked WhatsApp |
| `phone` | a phone is on file and the operator picked the call channel |
| `email` | only an email is on file (or the operator switched to email) |
| `unreachable` | no guardian, or no usable contact at all |

The audience banner exposes:

- `phoneReachable` (existing) — guardians reachable on WhatsApp
- `phoneMissing` (existing) — families with no phone on file
- `reachUnreachable` (new) — families with no contact on file at all
- `reachAllReachable` (new) — reassurance line when reach is total
- `Show reachable only` — toggle that filters out unreachable rows from
  the recipient list without dropping them from the saved audience

### Bulk → follow-up integration

| Surface | Bulk action | Source key |
|---------|-------------|------------|
| Athletes (existing, polished) | `Prepare message` | `source=athletes_selection`, `primaryContactsOnly=true` |
| Guardians (new) | `Prepare follow-up` | `source=guardians_selection`, `primaryContactsOnly=true`, navigates with `guardianIds[]` resolved through `athlete-guardians` |
| Finance hub priority list | `Prepare reminder` | `source=finance_overdue`, `template=overdue_payment_reminder`, scopes to a single `athleteIds` |

The audience builder DTO was extended with a `guardianIds[]` parameter,
resolved server-side under `TenantGuard` so guardians from another
tenant are quietly ignored.  No new endpoint, no parallel module.

### Validation surface

- `npm run build` — full TS build (covers the new audience meta + DTO).
- `npm run lint` — clean.
- `npm run i18n:check` — locale parity preserved (TR + EN).
- `npm run repo:guard` — workspace structure unchanged.
- `npm run reporting:filter-tree:test` and
  `npm run reporting:starter-views:test` — green.
- `npm run frontend:smoke` — adds `communication.smoke.test.tsx`
  (token resolution, reach classification, lifecycle helpers) and
  extends `CommunicationsPage.smoke.test.tsx` (stale-draft surface,
  template filter, reachable-only toggle).

### Intentionally deferred (still)

- Real WhatsApp Business API delivery.
- Scheduled / recurring follow-ups.
- Reply tracking and inbox surfaces.
- Custom templates / template management UI.
- A multi-step workflow engine (review queues, approvals, etc.).
- Bulk follow-up bridges from Inventory and Training session selections
  — they are in scope for a later wave once the bulk-bar wording on
  those surfaces stabilises further.

---

## Wave 13.1 — Communication & Follow-up Pack v1.1

This refinement layers on top of v1 without introducing a parallel
communication module.  The headline shifts:

> from “we can prepare a WhatsApp-first follow-up”
> to “we can comfortably manage, revisit, refine, and reuse follow-up
> work in daily club operations.”

### What ships in v1.1

| Area | Change |
|------|--------|
| Lifecycle | `OutreachActivity` gains a lightweight `status` column (`draft` / `logged` / `archived`). Existing rows are backfilled to `logged`; the previous "log a follow-up" button still works exactly as before. |
| Endpoints | `GET /api/communications/outreach/:id`, `PUT /api/communications/outreach/:id`, and `PATCH /api/communications/outreach/:id/status` join the existing list/log endpoints, all behind `TenantGuard`. List filtering accepts `?status=draft|logged|archived`. |
| Tokens | Template body interpolation now supports a curated catalog: `{{athleteName}}`, `{{guardianName}}`, `{{groupName}}`, `{{teamName}}`, `{{coachName}}`, `{{branchName}}`, `{{sessionLocation}}`, `{{nextSession}}`, `{{outstandingAmount}}`, `{{overdueAmount}}`, `{{clubName}}`. Missing values fall back to `—` and are flagged in the recipient card before the operator opens WhatsApp. The catalog is exposed via `GET /api/communications/templates` (`tokens` field) so the client can render a chip palette. |
| History / reuse | The history tab now offers status filters (`Drafts` / `Logged` / `Archived`), a “Continue this draft” / “Reuse this context” button per row, and re-hydrates the audience source, channel, template, message body, and saved audience filters when reopened. |
| Reachability honesty | The audience source banner now includes a one-line reach summary, and each `RecipientCard` shows a colour-coded reach chip (`Reachable on WhatsApp` / `No phone on file` / `No email on file` / `No guardian linked`). |
| Mobile UX | Tabs use a clearer pressed-state pill style; recipient cards have larger tap targets and a stacked layout under `sm`; the attendance roster (also touched by the bug fix) uses a card-per-row layout with one-tap status pills and a sticky save bar on mobile. |
| Copy / tone | Strings reframed for warmth (“Draft saved — you can come back anytime.”, “Pick up where you left off.”) without dropping the WhatsApp-first bias. |

### Lifecycle states

| State | Meaning | Default visibility |
|-------|---------|--------------------|
| `draft` | The operator is still preparing; safe to come back to. | Listed under Active + Drafts; never archived automatically. |
| `logged` | The assisted “sent” state; outreach intent recorded. | Listed under Active + Logged. |
| `archived` | Superseded or no longer relevant. | Hidden by default; visible under the Archived filter. |

The lifecycle is intentionally tiny.  We deliberately avoided building a
workflow engine — there is no scheduled state, no required approver,
and no implicit transition.  The operator decides via the `Save as
draft`, `Save to follow-up log`, and `Archive` actions on the draft
panel, plus `PATCH .../status` on the API.

### Token resolution

Tokens are resolved client-side per recipient using
`renderTemplate(...)` in `apps/web/src/lib/communication.ts`.  The
function:

- replaces every `{{token}}` with the resolved value or `—` when
  missing;
- returns the list of `missing` token names so the UI can warn the
  operator before they open WhatsApp;
- treats `{{name}}` as an alias of `{{athleteName}}` (v1 contract).

Tokens that depend on the audience build context (`coachName`,
`sessionLocation`, `nextSession`) come from the currently-selected
training session or coach filter.  We never invent values; if the
context cannot fill a token we degrade to `—` and surface the gap
clearly rather than send a placeholder-looking message.

### Training attendance bug fix

The attendance surface used to surface the raw API error
`limit must not be greater than 200` whenever a training session was
opened with a roster larger than the global athletes-list page cap.

**Root cause:** `apps/web/src/pages/TrainingSessionDetailPage.tsx`
fetched the roster with `?limit=500` to load the entire group, but the
shared `ListAthletesQueryDto` (used everywhere — paginated lists, audience
builders, attendance) restricted `limit` to `Max(200)`.  TypeORM's
ValidationPipe rejected the request, and the UI rendered the validation
message verbatim.

**Fix:** raise the DTO cap to 500 (matching the legitimate roster need
of the only call-site that requests above 200), keep all other
list-page consumers unchanged (they request ≤50 by default), and add a
soft `rosterTruncatedHint` banner in the attendance UI when a session's
group really would exceed 500 athletes — so we never silently truncate
a roster.  The `ATTENDANCE_ROSTER_LIMIT` constant in the page makes the
guardrail discoverable in code, and the DTO's docblock explains why
this single endpoint has a slightly larger cap.

### Migration

`Wave13CommunicationFollowUpV1_1` adds the `status` column with a
default of `'logged'` and an index on `(tenantId, status)`.  Existing
rows are backfilled to `logged` so the v1 history view is unchanged.

### What is intentionally deferred (still)

- Real WhatsApp Business API delivery.
- Scheduled / recurring follow-ups.
- Reply tracking and inbox surfaces.
- Custom templates / a template management UI.
- A multi-step workflow engine (review queues, approvals, etc.).

---

## Wave 13 — Communication & Follow-up Pack v1

The Communication & Follow-up Pack is the first real product capability for
turning club operations into a warm follow-up message. It builds on the
existing reporting/audience surface — there is no parallel "audience engine".

### Product intent

Amateur sports clubs talk to families on WhatsApp. The product is
designed to make that habit feel native:

- **WhatsApp is the primary channel** in the UI and in every deep-link.
- **Email is optional** — never required and never the default.
- **Audiences are derived** from existing reports / watchlists /
  segments. There is no separate audience model and no campaign builder.
- **Follow-ups are assisted, not sent**. The platform never delivers
  WhatsApp messages itself; instead it produces `wa.me` deep-links and
  copy-friendly per-family drafts.

### What ships in v1

| Surface | What it does |
|---------|--------------|
| `CommunicationService` | Existing audience derivation, extended with WhatsApp/email reach counts. |
| `OutreachService` (new) | Stores assisted follow-up activity rows so staff can see what was prepared, by whom, and from where. |
| `OutreachActivity` (new) | Lightweight entity (`outreach_activities` table) with channel, source, template, audience snapshot, optional note. |
| Templates catalog | Six warm operational templates (overdue payment, trial follow-up, attendance check-in, session reminder, group announcement, family follow-up). Returned by the API but rendered/edited in the client via i18n. |
| `/app/communications` | Redesigned WhatsApp-first surface: quick scenarios, audience source chip, channel switcher, template chips, draft + per-recipient WhatsApp deep-links, follow-up log. |
| Deep links | Action center, dashboard, reports, finance hub, and athlete detail now pass `source`, `sourceKey`, `template`, and `channel` so the destination feels intentional. |

### WhatsApp deep-link strategy

The client builds `https://wa.me/<phone>?text=<encoded>` per recipient,
using `lib/communication.ts` helpers:

- `buildWhatsAppLink(phone, message)` — single recipient (used per family card).
- `buildWhatsAppShareLink(message)` — no phone, opens the WhatsApp share sheet.
- `buildPhoneLink(phone)` — `tel:` link for calls.
- `buildMailtoLink(email, subject, body)` — only used when the operator
  switches the channel to email.

`{{athleteName}}` is the only supported template token in v1; it is
replaced per recipient before the link is generated, so the WhatsApp
chat opens with a personalized message ready.  v1.1 expands this to a
curated catalog (see above) while keeping `{{athleteName}}` and
`{{name}}` working unchanged.

### Outreach activity log

Saving a follow-up POSTs to `/api/communications/outreach`, persisting:

- channel, source surface, source key, template key
- topic and (optionally) the message preview
- recipient + reachable-guardian counts
- a compact audience snapshot (`athleteIds`, `guardianIds`,
  `audienceSummary`) for context
- the operator's staff user id and an optional note

The log shows up under the **Recent follow-ups** tab on
`/app/communications`. Each row also offers a "re-open the original list"
link that now re-hydrates the saved audience filters in addition to the
source and template, so staff land back on the same real list instead of
an approximate lookalike.

### Audience derivation

`/api/communications/audiences` is unchanged in spirit but now also
returns `guardiansWithPhone`, `guardiansWithEmail`,
`athletesWithPhoneReach`, and `athletesMissingPhone` so the UI can show
honest reachability counts before any message is sent. Tenant scoping
remains tied to the request `tenantId` exactly as before.

### Templates

`/api/communications/templates` returns:

```json
{
  "channels": ["whatsapp", "phone", "email", "manual"],
  "items": [{ "key": "...", "defaultChannel": "whatsapp", ... }]
}
```

Templates are stable, hard-coded, and warm. The localized title, body,
subject, and hint live under `pages.communications.templates.*` in the
EN and TR locale files (`apps/web/src/i18n/locales/{en,tr}/communication-follow-up.json`).

### Tenant isolation

All new endpoints are guarded by `TenantGuard`:

- `OutreachService.list` filters by `tenantId` from the request.
- `OutreachService.log` writes the request's `tenantId` and `staffUserId`
  on every row.
- The `outreach_activities` migration installs a `FK ... ON DELETE
  CASCADE` to the `tenants` table.

### What is intentionally deferred

- Real WhatsApp Business API delivery (no API integration in v1).
- Multi-token templates / advanced personalization beyond `{{athleteName}}`.
- Scheduled / recurring follow-ups.
- Reply tracking and inbox surfaces.
- Template management UI (the catalog is curated, not user-edited).

### Validation surface

- `npm run build` — full TS build (covers the new entity / DTOs / service).
- `npm run lint` — no new warnings.
- `npm run i18n:check` — locale parity preserved.
- `npm run repo:guard` — workspace structure unchanged.
- `npm run frontend:smoke` — adds `CommunicationsPage.smoke.test.tsx` with
  four scenarios (rendering, deep-link hydration, save-to-log, history tab)
  and keeps the existing reporting smoke green.
