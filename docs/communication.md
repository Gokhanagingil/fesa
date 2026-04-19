# Communication & Follow-up

## Wave 16 — WhatsApp Cloud API Live Delivery Pack

This wave turns the v15 readiness scaffolding into real WhatsApp
Cloud API delivery — carefully, honestly, and without removing the
assisted WhatsApp-first flow operators rely on.

> from "we are architecturally and operationally ready to support
> real WhatsApp delivery safely and honestly"
> to "clubs configured for direct send actually send via the
> WhatsApp Cloud API, while assisted WhatsApp remains a first-class
> calm fallback."

### What ships in v16

| Area | Change |
|------|--------|
| Live Cloud API client | New `WhatsAppCloudApiClient` wraps a single `POST /{phoneNumberId}/messages` per recipient.  Injectable fetcher seam for tests via the explicit `WHATSAPP_CLOUD_API_FETCHER` token (registered in `CommunicationModule` with `defaultWhatsAppFetcher` as the production value), never throws, masks recipient phone numbers in logs, classifies failures into a tiny operator-friendly vocabulary (`token_invalid`, `rate_limited`, `transport_error`, `provider_unavailable`, `provider_rejected`, `unknown`).  Extracts the Meta `wamid.*` provider message id when present. |
| Real direct send | `WhatsAppCloudApiProvider.attemptCloudApiSend()` is no longer a stub — it calls the live Cloud API per recipient.  Aggregate state stays honest: all delivered → `sent`, mixed batch → `sent` with detail `partial_sent:X_of_Y` (per-recipient outcomes still preserved), all failed → `failed`. |
| Honest orchestrator behaviour | `CommunicationDeliveryService.deliver()` lets partial-sent flow through as `sent` (the row IS the audit trail of a real send), and falls back to assisted only when the direct attempt fails end-to-end or readiness is no longer `direct_capable`. |
| Per-attempt counts | `OutreachService.attemptDelivery` now records `audienceSnapshot.lastDeliveryAttempt = { attempted, sent, failed }` so history rows can render an honest "Sent to X of Y" chip without inventing values. |
| Live readiness check | New `mode: 'live'` option on `POST /api/communications/readiness/whatsapp/validate`.  Performs a single read-only Cloud API request against the configured `phoneNumberId`; the call is rejected on the recipient (we deliberately use an invalid probe number) but accepted on the credentials.  This is what flips the validation chip to `ok` and the readiness state to `direct_capable`.  The default `local` mode stays side-effect free. |
| Validation safeguard | The classifier now requires an explicit `validation.state === 'ok'` to promote a tenant to `direct_capable`.  Any config edit drops validation back to `never_validated`, so direct send always pauses after edits until the operator re-runs the readiness check.  Local checks accept the configuration shape; live checks confirm Meta accepts the credentials. |
| Stricter local validation | Two new readiness issue codes — `phone_number_id_invalid` and `business_account_id_invalid` — fire when the configured ids are not pure digits.  The access token reference scheme is also tightened (`env:NAME` only with `[A-Z][A-Z0-9_]*` names). |
| UX for live delivery | `Send via WhatsApp` becomes a real direct-send button when `direct_capable`.  Outcomes render as calm `InlineAlert`s — `directSent`, `directPartial` (warm amber), `directFallback`, `directFailed` — with no provider jargon.  Assisted controls stay first-class alongside. |
| Settings polish | The readiness panel adds a `Run live readiness check` action sitting next to the existing local check, plus a one-line warm hint explaining what the live check does and a translated validation message under the badge. |
| History honesty | Each row that had a partial direct send shows a "Sent to X of Y" chip in warm amber instead of plain "Sent directly", so operators can tell at a glance which batches need a follow-up nudge. |
| Tone | Every new copy string is calm, club-friendly, and avoids enterprise/CRM language.  Provider/error codes are translated through a dedicated `validationMessages` namespace, so raw codes never reach the operator UI. |

### Live Cloud API delivery surface

The live send path is intentionally tiny and disciplined:

1. `OutreachService.attemptDelivery` resolves recipients from the
   request payload, calls `CommunicationDeliveryService.deliver`,
   and persists the aggregate state + per-attempt counts on the row.
2. `CommunicationDeliveryService.deliver` checks the WhatsApp Cloud
   API capability for the tenant.  Only a `direct_capable` tenant
   gets a real send; every other state degrades to assisted with a
   calm honest detail.
3. `WhatsAppCloudApiProvider.attemptCloudApiSend` performs one HTTP
   call per recipient via `WhatsAppCloudApiClient`.  Each per-
   recipient outcome is `sent` (with the optional `wamid.*`) or
   `failed` (with one of our short classification codes).
4. The provider rolls outcomes up:
   - all `sent` → `state: 'sent'`, detail `delivered_X_of_X`
   - mixed     → `state: 'sent'`, detail `partial_sent:X_of_total`
   - all failed → `state: 'failed'`, detail = first failure code
5. The orchestrator returns the provider result for `sent` (partial
   or otherwise), or replaces it with an `assisted` deep-link build
   plus a `state: 'fallback'` aggregate when nothing went through.

The Cloud API request itself is `POST graph.facebook.com/v19.0/
{phoneNumberId}/messages` with a plain `text` payload.  No
templates, no media, no broadcast — that surface area is
deliberately deferred until the live send path is proven.

### Readiness validation modes

| Mode | What it does | Side-effects |
|------|--------------|--------------|
| `local` (default) | Local consistency check + token reference resolves in this environment. | None. |
| `live` | Same, plus a single read-only Cloud API request against the configured `phoneNumberId` to verify Meta accepts the credentials.  We use an obviously invalid probe recipient so no real message is sent. | One outbound HTTPS call to `graph.facebook.com`. |

The chip on the readiness panel only flips to `Direct send ready`
when `validation.state === 'ok'`.  Saving a config field always
drops validation back to `never_validated`, so direct send pauses
after every edit until the operator re-runs the check — this is the
core trust safeguard for live delivery.

### Honest delivery state vocabulary

The lifecycle stays the same tiny set, with one new nuance.

| State | Meaning |
|-------|---------|
| `prepared` | Assisted draft is ready (no real send happened). |
| `sent`     | Direct send succeeded for at least one recipient.  When detail starts with `partial_sent:` the per-recipient list still carries the failures verbatim, so the UX can show "Sent to X of Y" and offer assisted follow-up for the gaps. |
| `failed`   | Direct send was attempted and no recipient delivered. |
| `fallback` | Direct send was attempted, failed end-to-end, and the assisted deep-link was prepared instead. |

We deliberately did not introduce a `partial` lifecycle state — the
whole point of the per-attempt counts is to keep the vocabulary
calm and let warm copy carry the nuance.

### API endpoints (deltas in v16)

- `POST /api/communications/readiness/whatsapp/validate` now accepts
  `{ "mode": "local" | "live" }` (defaults to `local`).
- `POST /api/communications/outreach/:id/deliver` is unchanged on
  the wire but now produces real `sent` outcomes when readiness is
  green.

### Configuration & secret handling

- The token reference contract is unchanged — `env:NAME` is the
  only supported scheme.  Names must match `[A-Z][A-Z0-9_]*` so we
  never feed a sloppy reference to `process.env`.
- Deployments wire up the secret by exporting the referenced env
  var on the API process (eg. `WHATSAPP_CLOUD_API_TOKEN=...` in the
  systemd unit / docker compose / k8s secret).  The platform never
  stores the token itself — only the reference.
- `apps/api/.env.example` keeps the commented `WHATSAPP_CLOUD_API_TOKEN`
  hint so operators know which env var to set.

### Operator runbook

To enable live direct WhatsApp delivery for a tenant:

1. Provision a WhatsApp Cloud API number for the club (Meta
   Business → WhatsApp Business Account → Phone numbers).
2. Export the long-lived access token on the API host as
   `WHATSAPP_CLOUD_API_TOKEN` (or any other `env:NAME` you choose
   to advertise to the admin form).
3. As a club admin, open Settings → WhatsApp delivery readiness:
   - fill in `Phone number ID`, `Business account ID`, and
     `Access token reference` (eg. `env:WHATSAPP_CLOUD_API_TOKEN`),
   - save the form,
   - click `Run live readiness check`.
4. Once the chip flips to `Direct send ready`, the Communications
   page exposes a `Send via WhatsApp` primary action.  `Open
   WhatsApp` stays available as a calm fallback link.

To pause direct send temporarily, untick `Enable direct send for
this club` on the same panel — the platform will degrade to
assisted mode without losing any history.

### Validation surface

- `npm run lint` — clean.
- `npm run build` — full TS build (covers the new client / provider
  changes and the partial-sent path).
- `npm run i18n:check` — locale parity preserved (TR + EN).
- `npm run repo:guard` — workspace structure unchanged.
- `npm run frontend:smoke` — extends `CommunicationsPage.smoke.test.tsx`
  with assisted vs direct rendering, partial-sent notice, and
  fallback notice scenarios.
- `npm run whatsapp:delivery:test` (new) — pure node smoke covering
  Cloud API client error classification, provider aggregation
  (`sent` / `failed` / partial), orchestrator fallback, the
  "no client call when readiness is paused" guarantee, and a
  Nest container regression check that `WhatsAppCloudApiClient`
  resolves through the `WHATSAPP_CLOUD_API_FETCHER` token (guards
  against the boot-time DI failure that the function-typed fetcher
  parameter caused before the explicit `@Inject(...)` wiring).
- `npm run api:boot:smoke` — Nest boot validates the live
  `CommunicationModule` provider graph end-to-end against the
  configured Postgres instance.

### Intentionally deferred

- Webhook / read-receipt tracking (we record the `wamid.*` so a
  future inbound webhook handler can correlate, but the inbound
  pipeline is out of scope here).
- WhatsApp message templates (`template` payload) and media —
  the live send is plain text only in v16.
- Inbox / reply UI.
- Direct send for channels other than WhatsApp.
- Per-tenant rate-limit dashboards (failures are still surfaced
  honestly per row, but there is no aggregated analytics surface).

---

## Wave 15 — WhatsApp Integration Readiness / Cloud API Pack

This wave does **not** ship live WhatsApp delivery.  It ships the
architecture, state model, readiness layer and UX honesty needed for
real WhatsApp Cloud API delivery to plug in cleanly later — without
breaking the assisted, WhatsApp-first flow that operators rely on
today.

> from "we can prepare a WhatsApp-first follow-up"
> to "we are architecturally and operationally ready to support real
> WhatsApp delivery safely and honestly"

### What ships in v15

| Area | Change |
|------|--------|
| Delivery state model | `OutreachActivity` gains four small columns: `deliveryMode` (`assisted` / `direct`), `deliveryState` (`prepared` / `sent` / `failed` / `fallback`), `deliveryProvider` (eg. `whatsapp_cloud_api`), and a tight set of attempt/completion timestamps and a free-form `deliveryDetail` for short, calm operator-friendly notes.  Existing rows backfill to `assisted` / `prepared` so the v1.x history view continues to read as "we prepared a follow-up". |
| Provider abstraction | New `DeliveryProvider` interface in `apps/api/src/modules/communication/delivery/types.ts` with two implementations: `AssistedDeliveryProvider` (the historical wa.me deep-link path) and `WhatsAppCloudApiProvider` (the future direct path).  A thin `CommunicationDeliveryService` orchestrator routes a single delivery request to the most appropriate provider and runs an honest assisted fallback when direct fails or is not ready. |
| Readiness model | New `tenant_communication_configs` table (1:1 with `tenants`) records intent + configuration shape.  `WhatsAppReadinessService` classifies each tenant as `not_configured`, `assisted_only`, `partial`, `direct_capable`, or `invalid`.  Secrets are **never stored** — the access token lives behind an opaque reference (`env:WHATSAPP_CLOUD_API_TOKEN`) so the host environment supplies the actual credential. |
| Honest fallback | `CommunicationDeliveryService.deliver()` always returns one of `prepared` / `sent` / `failed` / `fallback`.  Direct failure followed by assisted preparation emits the unique `fallback` state, which the UX surfaces calmly ("Direct send didn't go through — assisted fallback is ready.") so we never imply a real send when there wasn't one. |
| API surface | New endpoints under `/api/communications`, all behind `TenantGuard`: `GET /readiness?channel=whatsapp` returns the current capability plan; `PUT /readiness/whatsapp` saves the configuration shape; `POST /readiness/whatsapp/validate` runs the lightweight readiness check; `POST /outreach/:id/deliver` executes the orchestrator's deliver path against an existing follow-up row.  `GET /outreach`, `GET /outreach/:id`, `POST /outreach`, `PUT /outreach/:id`, `PATCH /outreach/:id/status` continue to work unchanged. |
| Mode-aware UX | `/app/communications` loads readiness on mount and renders a small mode banner near the WhatsApp action ("Assisted" or "Direct send" with a one-line hint).  When direct send is configured the operator sees a primary `Send via WhatsApp` button alongside the existing assisted controls; assisted mode keeps `Open WhatsApp` as the primary action.  Direct attempts attach delivery state to the persisted follow-up row and surface a calm fallback notice when direct couldn't go through. |
| Honest history | Each row in the Recent follow-ups list shows a delivery state chip (`Prepared`, `Sent directly`, `Direct send failed`, `Used assisted fallback`).  The chip is colour-toned but never alarmist; tooltips carry the short provider detail. |
| Admin readiness surface | The Settings page gains a calm `WhatsApp delivery readiness` panel that shows the current state, the operator-facing fallback note, and a club-friendly form for the configuration shape (phone number id, business account id, access token reference, optional display number) plus a `Run readiness check` button.  No raw secrets are ever rendered back; instead a "●●●●" hint appears next to fields that are already on file. |
| Tone | Every new copy string is warm, calm, and operator-friendly.  No CRM lifecycle states, no provider jargon, no fake "delivered" claims. |

### Delivery mode + state vocabulary

The lifecycle stays intentionally tiny.

| Mode | When it applies |
|------|-----------------|
| `assisted` | Operator opens WhatsApp via a deep link or copies the message — the platform itself does NOT send. |
| `direct`   | The platform attempted delivery via a real provider (eg. WhatsApp Cloud API). |

| State | Meaning |
|-------|---------|
| `prepared` | Assisted draft is ready (no real send happened). |
| `sent`     | Direct send succeeded. |
| `failed`   | Direct send was attempted and failed. |
| `fallback` | Direct send was attempted, failed, and assisted preparation was used instead. |

`fallback` is the keystone: it lets the system degrade gracefully
without ever lying.  Operators can immediately see in history that the
message was *prepared* through the assisted path, not sent.

### Provider abstraction

`DeliveryProvider` is a tiny contract:

- `key` — stable identifier persisted on every row that goes through it.
- `mode` — `assisted` or `direct`.
- `capability(tenantId, channel)` — returns whether the provider can
  handle this tenant + channel right now.
- `deliver(request)` — performs (or simulates) the actual send and
  returns a `DeliveryResult` with per-recipient outcomes.

Today there are exactly two providers:

- `assisted_whatsapp` — always available; `deliver()` returns
  `prepared` per recipient (the operator opens the message).
- `whatsapp_cloud_api` — `direct` mode; `capability()` only reports
  `direct_capable` when readiness is green; `deliver()` returns
  `failed` with `provider_not_live` until the live integration ships.

`CommunicationDeliveryService` is the only application-layer entry
point.  It calls the right provider, runs the assisted fallback when
direct fails or is unavailable, and never leaks provider identifiers
into the operator UX.

### Readiness model

`tenant_communication_configs` (1:1 with `tenants`) stores:

- `whatsappCloudApiEnabled` — operator intent.  Even with all fields
  filled, direct send stays paused while this is `false`.
- `whatsappPhoneNumberId`, `whatsappBusinessAccountId` — Cloud API
  identifiers required for direct send.
- `whatsappAccessTokenRef` — opaque reference (eg.
  `env:WHATSAPP_CLOUD_API_TOKEN`).  The actual secret is never stored.
- `whatsappDisplayPhoneNumber` — optional display string surfaced to
  staff so they can verify which line will deliver direct messages.
- `whatsappValidationState` / `whatsappValidationMessage` /
  `whatsappValidatedAt` — outcome of the lightweight readiness check.

`WhatsAppReadinessService.classify()` derives one of:

| State | Meaning |
|-------|---------|
| `not_configured` | No row, or no fields filled.  Direct paused. |
| `assisted_only`  | Operator declined direct send intentionally; setup may be partial. |
| `partial`        | Direct send enabled but configuration is incomplete or unresolved. |
| `direct_capable` | Direct send enabled, configuration complete, validation succeeded. |
| `invalid`        | Direct send enabled but validation rejected the configuration. |

Only `direct_capable` lets a delivery attempt go through the Cloud API
path.  Every other state flows through assisted with the appropriate
honest copy.

### Token resolution & security boundaries

- `whatsappAccessTokenRef` is an opaque reference, NOT the secret.
- `WhatsAppReadinessService.resolveAccessToken()` only supports the
  `env:NAME` scheme today (returns `null` for any other scheme,
  treating it as "not yet supported").
- Future iterations can plug in a real secret-manager resolver by
  extending that single function — no schema changes required.
- The admin UX never reads back the token reference; it shows a
  "●●●●" badge next to fields that are already on file.

### Mode-aware UX

| Surface | Behaviour |
|---------|-----------|
| Communications draft panel | Loads readiness once on mount and renders a small mode banner above the action row.  When `direct_capable`, the primary `Send via WhatsApp` button appears alongside `Open WhatsApp` (which becomes "Open WhatsApp instead"). |
| Direct send action | Persists the row first if it isn't yet saved, then calls `POST /outreach/:id/deliver` with `mode: 'direct'`.  Result state (`sent` / `fallback` / `failed`) drives a calm `InlineAlert` so the operator immediately sees what happened. |
| History | Each row shows a delivery state chip with the short provider detail in the tooltip.  History filters and lifecycle filters from v1.2 keep working unchanged. |
| Settings | Adds the readiness panel — current mode, fallback note, save form for the configuration shape, and a `Run readiness check` button. |

### API endpoints (new in v15)

All behind `TenantGuard`:

- `GET  /api/communications/readiness?channel=whatsapp` — capability plan + WhatsApp summary.
- `PUT  /api/communications/readiness/whatsapp` — save configuration shape (intent + identifiers + token reference + display number).
- `POST /api/communications/readiness/whatsapp/validate` — run readiness check (local resolution + token-ref check).
- `POST /api/communications/outreach/:id/deliver` — orchestrator-driven delivery attempt with auto-fallback.

### Migration

`Wave15WhatsAppIntegrationReadiness1746100000000` adds:

- the seven new `delivery*` columns on `outreach_activities` with safe
  defaults (`assisted` / `prepared`) and an index on
  `(tenantId, deliveryState)` for future delivery dashboards;
- the `tenant_communication_configs` table with a unique index on
  `tenantId` and a `FK ... ON DELETE CASCADE` to `tenants`.

Existing rows backfill to `deliveryMode='assisted'` /
`deliveryState='prepared'`, preserving the v1.x meaning of every
historical row.

### Validation surface

- `npm run lint` — clean.
- `npm run build` — full TS build (covers the new entity / DTOs / providers / orchestrator).
- `npm run i18n:check` — locale parity preserved (TR + EN).
- `npm run repo:guard` — workspace structure unchanged.
- `npm run frontend:smoke` — extends `communication.smoke.test.tsx` with delivery-mode resolution and delivery-state copy/tone tests.

### Intentionally deferred (still)

- A live WhatsApp Cloud API integration that actually flips
  `deliveryState` to `sent` (the orchestrator + provider stub are
  ready to host it).
- Per-recipient delivery dashboards and provider failure analytics.
- A real secret-management plane (only `env:NAME` references resolve
  today; the resolver function is the single seam to extend).
- Inbox / reply tracking.
- Direct send for channels other than WhatsApp.

---

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
