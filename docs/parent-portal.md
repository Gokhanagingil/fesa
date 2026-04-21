# Parent Access & Portal Foundation

Wave 17 establishes the first real **parent-facing** surface in amateur:
a calm, club-branded family portal that is intentionally distinct from the
admin/operator UX. It is built on top of the same multitenant platform —
sharing the same domain entities, the same tenant isolation, and the same
deployment — but it is shaped from the ground up around what a guardian
actually wants to see on a phone.

The portal is not a recycled admin page. It is the parent-facing face of
the club.

## Design pillars

| Pillar | What it means here |
|--------|--------------------|
| **Parent utility first** | The first screen answers "what do I need to know about my family right now?" — pending confirmations, balance, today's training. |
| **Club showcase second** | A subtle "From the club" panel surfaces the welcome message and (later) lightweight announcements without ever overpowering the utility layer. |
| **Gentle marketing third** | No banners, no popups, no marketing chaos. Promotional content stays opt-in and bounded. |
| **Branded shell, controlled core** | Each club appears with its own logo, display name, and primary/accent color, but layout, typography, spacing, component structure, and accessibility rules are shared across every tenant. |
| **Mobile first** | The shell is sized for one-handed mobile use first; desktop is just a wider window into the same surfaces. |

## Access model (v1)

The portal uses an **invitation-based, club-controlled** access model:

1. The guardian record already exists in the club's database (the staff
   admin or the imports surface created it).
2. Staff invite the guardian to the portal from the existing
   `Guardians → portal access` flow. The API issues a single-use,
   time-bounded `inviteToken` (hashed, 72-hour TTL).
3. The guardian opens the activation link, confirms their identity, and
   sets a password (minimum 8 characters; PBKDF2 with 120 000 iterations
   and a 16-byte salt).
4. After activation the guardian signs in with email + password against
   the same tenant. A 14-day, http-only, same-site `Lax` cookie holds the
   portal session; logout revokes the row.

Open self-signup is **not** available in v1 by design. Magic-link and
phone OTP flows are intentionally deferred — they each carry meaningful
identity-matching risk and are not necessary for the v1 product surface.

## Tenant branding (controlled)

Each tenant carries a small, controlled brand surface persisted on the
`tenants` table by the `Wave17ParentPortalTenantBranding` migration:

| Column | Purpose |
|--------|---------|
| `brandDisplayName` | Friendly club name shown in the portal header and welcome card. Falls back to `tenants.name`. |
| `brandTagline` | Short, one-line tagline shown under the display name. Optional. |
| `brandPrimaryColor` | 6/8-digit hex color used for the brand mark, primary CTA, and ambient washes. |
| `brandAccentColor` | 6/8-digit hex color used for soft surface washes and the today/announcement strip. |
| `brandLogoUrl` | Absolute `https://` URL or repo-root-relative path. Rendered inside a fixed-shape brand mark. |
| `brandWelcomeTitle` | Optional welcome title shown in the home greeting card. |
| `brandWelcomeMessage` | Optional welcome paragraph (max 400 chars) shown in the greeting + showcase strip. |
| `brandUpdatedAt` | Last time staff updated the brand payload. |

Things we **do not** brand per tenant: layout grid, typography stack,
spacing, component shapes, focus rings, system colors for danger /
success / warning, interaction patterns, accessibility rules. This is the
"branded shell, controlled product core" model called out in the sprint
brief.

The portal-side `resolveBrandingTokens` helper picks readable ink colors
against the configured brand color so contrast does not regress. Invalid
hex values and unsafe URLs (anything that isn't `https://` or a relative
`/…` path) are rejected at the API boundary.

## API surface

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/portal/tenants` | public | Lists the controlled brand payload per tenant for the parent login/activation surfaces. No member counts, no operational data. |
| `GET /api/portal/tenants/:tenantId` | public | Single-tenant brand payload. |
| `GET /api/tenant/branding` | staff (`TenantGuard`) | Staff fetch of the active tenant's brand payload. |
| `PUT /api/tenant/branding` | staff (`TenantGuard`) | Staff update of the controlled brand fields with input validation. |
| `GET /api/guardian-portal/activate/:token` | public | Returns guardian + tenant + brand payload for the activation form. |
| `POST /api/guardian-portal/activate/:token` | public | Sets the password and starts the portal session. |
| `POST /api/guardian-portal/login` | public | Email + password login against a chosen tenant. |
| `GET /api/guardian-portal/me` | guardian session | Parent home payload (linked athletes, attention items, today, finance summary, brand). |
| `POST /api/guardian-portal/logout` | guardian session | Revokes the session row and clears the cookie. |

All guardian endpoints continue to enforce tenant isolation through the
`GuardianPortalGuard`: the session row carries the tenant id, and every
home/action read is scoped to the guardian's own tenant.

## Information architecture (parent home)

The home is a single, calmly-scrollable page on mobile:

1. **Greeting card** — a warm, brand-colored card with the family's first
   name, the club display name, and (if configured) the welcome message.
2. **What needs your attention** — only renders when something actually
   does. Lists up to three pending family-action items, the count of
   in-review items, and a one-line finance summary when there's an open
   balance. When everything is clear, the card flips to a calm
   "All caught up" message.
3. **Today** — a quietly hidden-when-empty list of today's training
   sessions and private lessons across the family.
4. **My family** — one card per linked athlete with relationship,
   group, balance summary, and the next training/lesson.
5. **All requests** — the full family-action list when the family has any
   history.
6. **From the club** — a subtle, dashed-border showcase strip carrying
   the brand welcome message. This is the entire club-showcase surface
   in v1; no banners, no popups, no marketing chaos.

Bottom-of-screen mobile navigation gives the parent two large, comfortable
tap targets (Home, My family, Updates) without ever leaving the page.

## What is intentionally out of scope (v1)

- Open guardian self-signup, magic links, phone-based OTP.
- Editable announcements/news CMS for clubs (the portal renders only the
  bounded brand welcome copy in v1).
- Per-club typography, layout, spacing, or system-color overrides.
- Direct payment capture by guardians.
- Push notifications.

These each have a clear path forward in later waves; the v1 scope keeps
the surface area small enough to stay calm, secure, and trustworthy.

## v1.1 — Brand Admin v1.1 + Club Updates layer (Wave 18)

Wave 18 builds on the Wave 17 foundation with two small, controlled
additions and a UX polish pass on the parent home. There is no new
authentication model, no new tenant boundary, and no new operational
data exposed to guardians.

### Brand Admin v1.1

A polished staff-side surface is now embedded directly in **Settings →
Club branding**. The same controlled brand fields stay in place
(display name, tagline, two colours, logo, welcome copy); on top of
those we added:

- **A live preview card.** A faithful "what parents will see"
  preview re-renders as fields change, so club staff don't have to
  guess how their colour or copy choice will land.
- **A logo upload flow on top of the existing media foundation.** Clubs
  can now upload a small logo (PNG/JPG/WEBP, ≤ 1 MB) directly through
  staff branding, served back through a tenant-scoped, cache-busted
  route at `GET /api/portal/tenants/:tenantId/branding/logo`. The
  free-form `brandLogoUrl` is preserved for clubs that prefer to host
  their own; the uploaded asset takes precedence when both are set.
- **A contrast advisory.** The brand payload now includes a
  WCAG-style contrast ratio for primary and accent colours. The portal
  itself still picks the readable ink colour automatically — the
  advisory is purely a hint so staff know when a colour choice would
  feel hard to read.

The full controlled surface stays the same: layout, typography,
spacing, component structure, focus rings, and system colors for
danger / success / warning are still **not** brandable, on purpose.

| New tenant column | Purpose |
|-------------------|---------|
| `brandLogoAssetFileName` | Per-tenant uploaded logo file name. |
| `brandLogoAssetContentType` | Stored mime type for the uploaded asset. |
| `brandLogoAssetSizeBytes` | Stored file size (bytes). |
| `brandLogoAssetUploadedAt` | Used for cache-busting on replace. |

### Club Updates layer

A small new `club_updates` table backs a calm "From the club" strip on
the parent portal home. The intent is "a helpful note from the club" —
not a CMS, not a marketing channel, not a comment thread.

| Field | Purpose |
|-------|---------|
| `category` | `announcement` · `event` · `reminder` |
| `status` | `draft` · `published` · `archived` |
| `title`, `body` | Plain text only — short title, one paragraph |
| `linkUrl`, `linkLabel` | Optional safe link (https:// or `/…` path) |
| `publishedAt` | Auto-set when first published |
| `expiresAt` | Parent UI hides expired cards |
| `pinnedUntil` | Keeps a card on top of the strip for a window |

Hard caps protect the parent surface:

- the API never returns more than **5 cards** to parents;
- staff can manage at most **50 cards** in the staff list;
- only `published`, in-window cards reach the parent payload.

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/club-updates` | staff (`TenantGuard`) | List the staff-side updates queue. |
| `POST /api/club-updates` | staff | Create a new update. |
| `GET /api/club-updates/:id` | staff | Single card. |
| `PATCH /api/club-updates/:id` | staff | Update fields, transition status. |
| `POST /api/club-updates/:id/publish` | staff | Set status to `published`, stamp `publishedAt` if needed. |
| `POST /api/club-updates/:id/archive` | staff | Move out of the parent strip without deleting history. |
| `DELETE /api/club-updates/:id` | staff | Delete the card. |

The guardian portal home payload (`GET /api/guardian-portal/me`) now
includes the same parent-safe slice via a new `clubUpdates` field, so
the portal can render the strip without an extra request.

### Parent home polish

The home is unchanged in structure (greeting → attention → today →
family → all requests → from the club). The "From the club" strip is
now backed by real club updates: each card has a calm category pill,
the title and body the club authored, and an optional brand-coloured
link. The previous fallback (welcome message + reassurance line) still
appears when the club has not published anything yet.

### Validation additions

- `npm run tenant:branding:test` now also covers the contrast
  advisory helper.
- `npm run club:updates:test` is a new pure-Node validator smoke for
  the club-updates normalization rules and parent-side filtering.
- `apps/web` smokes now include a `clubUpdates`-rendering case for
  `GuardianPortalHomePage`.
- `npm run i18n:check` parity is extended to cover the new
  `pages.brandAdmin`, `pages.clubUpdates`, `app.nav.clubUpdates`, and
  `portal.home.clubUpdate*` keys.

## Validation

- `npm run lint` — covers the new branding service, controllers, DTO, and
  portal pages, plus the Wave 18 club-updates module and the staff Brand
  Admin / Club Updates surfaces.
- `npm run i18n:check` — protects locale parity for the parent portal
  copy and (since Wave 18) the staff `pages.brandAdmin` and
  `pages.clubUpdates` surfaces.
- `npm run repo:guard` — workspace hygiene (existing).
- `npm run tenant:branding:test` — pure-Node validator smoke for the
  brand color and URL normalization rules used by
  `TenantBrandingService.updateBranding` plus the Wave 18 contrast
  advisory helper (no database required).
- `npm run club:updates:test` — pure-Node validator smoke for the
  club-updates normalization rules and parent-side filtering
  (Wave 18, no database required).
- `npm run frontend:smoke` — covers the `GuardianPortalHomePage` and
  `GuardianPortalLoginPage` smokes (now including the club-updates
  strip case) alongside the existing reporting, imports, inventory,
  and communications smokes.

The existing `npm run api:boot:smoke`, `npm run dashboard:smoke`, and
`npm run reporting:smoke` checks remain unchanged and still gate the API.

## v1.2 — Targeted Announcements, Family Utility Refinement, and Parent Recovery UX (Wave 20)

Wave 20 keeps the v1.1 shape and adds three small, parent-facing
improvements: club updates can be quietly targeted at the families
they actually concern, the parent home becomes more useful in everyday
family life, and a calm "I lost access" surface gives parents a way
back in without inventing a brand new auth method.

### Targeted announcements

Club updates pick up a tiny audience model. The default scope is
`all` — every linked guardian sees the card — and on top of that
clubs can quietly target a single sport branch, group, or team. There
is **no audience builder, no list of names, and no per-family
targeting** — three controlled scopes are enough for the relevance asks
clubs actually have ("just the U14 girls", "only volleyball families")
without turning announcements into a CMS.

| Audience scope | What it does |
|----------------|--------------|
| `all` | Every linked guardian sees the card. |
| `sport_branch` | Only families with at least one athlete in the chosen sport branch see the card. |
| `group` | Only families with at least one athlete whose primary group is the chosen group. |
| `team` | Only families with at least one athlete on the chosen team's roster. |

Three things keep this safe:

1. **Server-side validation.** The targeting id (branch / group / team)
   must belong to the resolving tenant; mismatched ids are rejected at
   save time.
2. **Server-side filtering.** Parents never receive the full list — the
   guardian portal computes the parent's audience set (the union of
   each linked athlete's branch, primary group, and open team
   memberships) and intersects it against every card before deciding
   what to render. Tenant isolation still flows through the existing
   `where: { tenantId, status: 'published' }` clause.
3. **No leaked audiences.** The parent UI shows a calm "For …" hint when
   a card is targeted, but never the full list of families.

A new tiny endpoint backs the staff editor:

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/club-updates/audience-options` | staff (`TenantGuard`) | Lists the small in-tenant catalog of sport branches, groups, and teams the staff editor uses to pick a targeting handle. |

Existing club-updates endpoints (`GET/POST/PATCH/DELETE /api/club-updates`,
`POST /api/club-updates/:id/publish` and `…/archive`) are unchanged in
shape and still hard-cap the parent-facing list at 5 cards.

### Family utility refinement on the home

The home gains two small surfaces, both designed to hide when empty so
the page stays calm:

- **"This week" digest.** A merged, time-sorted preview of the next
  five training sessions and private lessons across the family. Built
  from the same data sources as the per-athlete cards — no extra
  permissions, no new aggregation table.
- **"Kit in hand" per athlete.** When the inventory module records open
  assignments for an athlete, the family card now shows the active
  items the family currently has (item name + variant + quantity, up
  to five entries per athlete). When the club doesn't track inventory
  this section is invisible.

The existing greeting → attention → today → family → all requests →
from the club ordering is preserved on purpose. New surfaces slot in
between "today" and "family" (this-week digest) and inside the family
card (kit in hand), so parents aren't asked to learn a new layout.

### Parent recovery UX

Parents who forget their password or change devices now have a calm
public surface to ask for help, without exposing a brand-new public
reset flow:

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /api/guardian-portal/recover` | public | Records that a family asked for help signing in. The response is intentionally identical for "match" and "no match" cases so we never leak account existence. |

When the email matches an existing access row in the chosen tenant
(or any tenant, if the parent skipped the club selector) we stamp two
new columns on `guardian_portal_accesses` — `recoveryRequestedAt` and
`recoveryRequestCount`. Staff see this on the existing
**Guardians → portal access** surface as an amber hint with the
exact wording "This family asked for help signing in on …".

Resending the invite from that same surface clears the recovery flag
and sends the family a fresh, time-bounded activation link. The reset
itself still flows through the existing invite path — that keeps
recovery safely under club control without forcing us to ship magic
links or phone OTP in v1.2. The seam is in place: a future wave can
swap the "ask the club" copy for a self-serve reset link without
re-thinking the data model.

### Mobile-first polish

- The parent home explicitly anchors `today`, `this-week`, `family`,
  and `updates` so the bottom nav scroll-targets always work.
- The "Lost access?" link sits next to the calm `recoveryHint` on the
  login surface so the parent never feels stranded.
- Targeted-audience hints render as a single pill on the club update
  card, never as a banner — no extra row, no shouted colours.
- The recovery page reuses the login page chrome so the parent stays in
  a familiar, branded surface.

### Schema additions

A new migration `Wave20ParentPortalV12` adds the small audience columns
on `club_updates` (`audienceScope`, `audienceSportBranchId`,
`audienceGroupId`, `audienceTeamId`) and the recovery observability
columns on `guardian_portal_accesses` (`recoveryRequestedAt`,
`recoveryRequestCount`). Existing rows default to `audienceScope = 'all'`
and `recoveryRequestCount = 0`, so the schema upgrade is non-breaking.

### Validation additions for v1.2

- `npm run club:updates:test` now also covers the audience-matching
  rule against an empty and a populated parent audience set.
- `npm run i18n:check` parity is extended to `pages.clubUpdates.audience`,
  `portal.home.thisWeekTitle`, `portal.home.inventoryTitle`,
  `portal.home.clubUpdateAudienceFor`, `portal.login.forgotAccess`,
  `portal.login.recoveryHint`, and the entire `portal.recovery` block.
- `apps/web` smokes pick up a new
  `GuardianPortalRecoveryPage.smoke.test.tsx`, an extended
  `GuardianPortalHomePage.smoke.test.tsx` case for the targeted
  audience pill, this-week digest, and kit-in-hand surface, and a
  `GuardianPortalLoginPage.smoke.test.tsx` assertion that the calm
  "Lost access?" link is present.

### What is intentionally still out of scope (v1.2)

- A full audience builder (multiple branches, multiple groups, age
  bracket arithmetic, "everyone except…" scopes).
- Magic-link or phone-OTP recovery — the recovery surface intentionally
  keeps the loop inside the club's invite path.
- Per-family overrides (mute, snooze, "don't show me this") on club
  updates.
- A separate parent-side notification feed — announcements still live
  inside the home strip on purpose.

## v1.3 — Family Activation & Landing Pack (Wave 21)

Wave 21 closes the gap between "the club has migrated into the
platform" and "families are actually inside the platform and using it".
The product principle is intentionally narrow: this is **not** a CRM
funnel and not a marketing surface. It is a calm, operational adoption
layer that helps clubs land families confidently and helps families
find their feet in the first session after activation.

### Staff-side activation visibility

A new `Activation` view sits on the existing **Guardians** page (next
to the `List` and `Advanced` views). The view answers two operational
questions at a glance:

1. _Where do families stand right now?_ — a calm totals strip with the
   activation rate, the count of open invites (and how many have sat
   for more than a week), the count of guardians who are ready to
   invite, and the count of families that recently asked for help.
2. _Who should I follow up with next?_ — a segmented bucket list that
   never lists more than 25 families per bucket and links each row
   straight back to the existing Guardian detail surface.

| Bucket | Means |
|--------|-------|
| `recovery` | The family used the public "I lost access" form and a fresh invite hasn't been sent yet. Sorted by most recent request. |
| `invited` | The invite has been sent but the family has not yet activated. Sorted oldest-invite-first so stale invites surface naturally. |
| `notInvited` | A guardian record exists with at least one linked athlete and an email on file, but no portal access row yet. |
| `dormant` | Activated, but not seen in the last **60 days**. Surfaced as "quiet", never as "lapsed". |
| `active` | Activated and seen recently — counted in the totals, listed only briefly. |
| `disabled` | Staff has paused this access on purpose. |

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/guardian-portal/staff/activation-overview` | staff (`TenantGuard`) | Returns the calm bucketed overview. Tenant isolation flows through the same `where: { tenantId }` clauses as the existing access summary. |

The view also surfaces a **Prepare reminder** button that hands the
selected follow-up cohort (recovery + invited + notInvited + dormant)
to the existing communications surface as a deep link, with the new
`activation_reminder` template pre-selected. No message is ever sent
on the club's behalf.

### Audience slices for activation follow-up

`ListCommunicationAudienceQueryDto` picks up two new optional booleans:

| Filter | Means |
|--------|-------|
| `portalNotActivatedOnly` | Keep the families that have either no access row or an outstanding `invited` row. |
| `portalRecoveryOnly` | Keep the families that recently used the public "I lost access" form (and whose access is not disabled). |

Both flags are honoured server-side in `getCandidateAthleteIds` and
in the per-item filter, so they compose naturally with the existing
group / team / financial / readiness filters. The same flags are
plumbed through the **Communications** UI as two new calm checkboxes
in the filters panel.

A new **`activation_reminder`** template sits in the existing template
library next to the family follow-up template. The copy is
deliberately warm and honest: it never threatens removal, never invents
urgency, and never pretends the family "must" act. The default channel
is WhatsApp, matching the rest of the v1 catalog.

### Parent first-landing & calm essentials

`GET /api/guardian-portal/me` now also returns a small `landing` block:

| Field | Purpose |
|-------|---------|
| `firstLanding` | True for the first session after activation, inside a 14-day window. |
| `windowDays` | The first-landing window length (14). |
| `essentials` | A bounded list of the few things that genuinely matter to a freshly-landed family (`confirm_phone`, `review_children`, `open_pending_action`, `check_balance`). Each entry carries a `severity` (`info` / `attention`) and a `done` flag. |
| `essentialsAttentionCount` | The number of attention entries — useful for telemetry and tests. |

The parent home renders two new calm surfaces from this block:

- **First-landing welcome.** A warm "you're in, &lt;name&gt; — welcome
  to &lt;club&gt;" card sits between the greeting and the attention
  card on the very first session after activation, then quietly stops
  rendering once the parent has come back at least once.
- **Calm essentials strip.** A tiny strip with **at most three**
  attention entries, or a single soft acknowledgement when the family
  has nothing pending. The strip is ruthless about hiding entries
  that aren't actionable: `check_balance` only shows when there is
  actually an open balance, and `open_pending_action` only shows when
  the family genuinely has a pending request from the club.

There is no progress bar, no checklist scoring, and no nagging.
Returning, settled families never see this surface at all.

### Mobile-first details

- The Activation view on the Guardians page uses card-first layouts
  with comfortable tap targets, an overflow-scroll bucket-pill row
  that fits any screen width, and a single primary action at the top
  ("Prepare reminder for N").
- The first-landing welcome and essentials strip both anchor with
  scroll targets (`#welcome`, `#essentials`) so the existing bottom
  nav can route to them on mobile without inventing new shell
  scaffolding.
- The essentials strip uses round status pills (✓ for done, · for
  attention) sized for touch and never shows more than three rows.

### Validation additions

- `npm run family:activation:test` is a new pure-Node validator smoke
  for the bucketing rules in `getActivationOverview` and the calm
  essentials picker in the parent home.
- `npm run i18n:check` parity is extended to cover
  `pages.guardians.activationViewToggle`, the entire
  `pages.guardians.activation` block, the new
  `pages.communications.portalNotActivatedOnly` /
  `pages.communications.portalRecoveryOnly` checkboxes, and the new
  `portal.home.landingBadge` / `portal.home.landingTitle` /
  `portal.home.landingTitleClub` / `portal.home.landingBody` /
  `portal.home.essentialsTitle` / `portal.home.essentialsHint` /
  `portal.home.essentials` keys.
- `apps/web` smokes pick up a new
  `FamilyActivationOverview.smoke.test.tsx` and an extended
  `GuardianPortalHomePage.smoke.test.tsx` case for the first-landing
  welcome and the calm essentials strip.

### What is intentionally still out of scope (v1.3 — Wave 21 baseline)

- An automated "send a reminder for me" workflow — the platform helps
  staff prepare the message; sending stays a human action.
- A growth-funnel dashboard with conversion charts, cohort analysis,
  or marketing analytics.
- A long parent profile-completion gauntlet — essentials stay capped
  at three attention rows on purpose.
- Self-serve password reset on the public surface — recovery still
  flows through the staff resend-invite path, the same as in v1.2.

## v1.3 — Family Communication Continuity, Payment Readiness & Trust Layer (Wave 22)

Wave 22 builds on the Wave 21 activation/landing foundation. It does
**not** introduce a new auth model, a new tenant boundary, a separate
inbox, or any payment-processing capability. It refines what the parent
portal carries between sessions and how calmly it explains family
finance — so the home feels more useful over time, not just on first
landing. The product principles for this wave are explicit:

- continuity, not noise;
- payment **readiness** and clarity, not collections pressure;
- trust through restraint, not through more sections.

### Family Communication Continuity layer

The parent home now renders a small **Recent from the club** strip
between the calm essentials and the "what needs your attention" card.
The strip is a single, sorted, capped list of the most recent
club→family **moments** the parent should be aware of:

| Moment kind     | Source                                                     | Surfaced when                                             |
|-----------------|------------------------------------------------------------|-----------------------------------------------------------|
| `club_update`   | A published, in-window club update the family is allowed to see (already audience-filtered upstream). | Published in the last **30 days**.                        |
| `family_request`| A family-action request the guardian is associated with.   | Status is ongoing (`open`, `pending_family_action`, `submitted`, `under_review`) **or** decided in the last 30 days. |

Hard limits keep the surface calm:

- the API never returns more than **5 moments** in the strip;
- summaries are clamped to **140 characters** before being shown;
- closed/completed moments older than the 30-day window are quietly
  hidden — they would only feel like noise to a returning family;
- staff workflow noise is never exposed to parents (no internal status
  beyond what the parent already had visibility into through the
  family-action surface, no audit trail, no internal authorship).

Moments deep-link back into surfaces the family already has access to:
`club_update` moments scroll to the existing `From the club` strip,
`family_request` moments link into the existing `/portal/actions/:id`
detail page. We never invent a new conversation surface.

A small `hasOpenFamilyRequest` flag accompanies the moments so the UI
can render a single, calm "we'll keep this gently visible until the
club has heard back" footer when a request is genuinely waiting on the
family.

### Payment Readiness layer

A new **Payment readiness** card replaces the previous one-liner
finance summary in the attention card. The intent is calmer family
finance clarity — never a collections / dunning surface.

The API computes the parent-safe slice from the same
`listAthleteFinanceSummaries` call already used by staff finance, then
projects three states the UI uses to choose its tone:

| Tone        | When                                                     | Visual treatment                                  |
|-------------|----------------------------------------------------------|---------------------------------------------------|
| `clear`     | No open charges (cancelled and paid never count).        | Soft "all clear" acknowledgement, no list.        |
| `open`      | Open charges, none past due.                             | Calm informational card with a "next up" hint.    |
| `attention` | One or more charges are past due.                        | Same calm card, slightly more prominent border, a "if something looks off, just reach out" footer instead of pressure copy. |

What the card actually carries:

- a single resolved currency (defaulting to `TRY` when no charge has
  one yet) so the UI never has to invent one mid-list;
- the family's outstanding total and overdue total, formatted via the
  existing money helpers;
- a `nextDue` slot — the earliest non-overdue charge in the next
  **14 days** — so the parent immediately understands what's coming;
- a list of open charges, grouped by athlete and ordered "overdue
  first, then by earliest due date, then no-due-date last", **hard-capped
  at six entries** for the whole family;
- a per-athlete totals slice for the existing family cards so the
  finance hint there can stay consistent.

Three guarantees keep this safe:

1. The portal still does not process payments. The footer copy makes
   that explicit ("we don't process payments in the portal — your
   club handles that the way you're used to") so families never expect
   a checkout flow that doesn't exist.
2. Cancelled and paid charges are filtered out before the projection
   runs — they would only confuse a calm finance card.
3. Tenant isolation flows through the same
   `where: { tenantId, … }` clauses already used by the finance and
   guardian-portal services. No new query path was added.

### Club-to-Family Trust layer (UX hierarchy refinements)

The home order is now intentional and explicit, mobile-first:

1. Branded greeting (unchanged).
2. First-landing welcome (unchanged from Wave 21).
3. Calm essentials strip (unchanged from Wave 21).
4. **Recent from the club** continuity strip (new in Wave 22).
5. **Payment readiness** card (new in Wave 22).
6. "What needs your attention" / "All caught up" (unchanged).
7. Today (unchanged).
8. This week (unchanged from v1.2).
9. My family (unchanged, with kit-in-hand from v1.2).
10. All requests (unchanged).
11. From the club (unchanged).

Trust improvements made without adding new sections:

- The Payment readiness card uses the existing `--portal-ring-soft`
  CSS variable for its border accent so the calm "attention" tone
  honours per-tenant branding without breaking readability.
- Status pills in the continuity strip reuse the same brand-coloured
  primary-soft surface the existing club-update pill uses, so the
  brand chrome stays consistent without inventing a new colour.
- All new copy is written warm-and-clear and avoids "you must",
  "urgent", "action required" patterns. The strongest language used
  on the finance surface is "may need a closer look".
- Empty/clear states are first-class: the Payment readiness card
  collapses to a single soft acknowledgement and the continuity strip
  hides itself entirely when there is nothing to surface.

### Mobile-first details

- Both new sections anchor with `#continuity` and `#payment` so the
  existing bottom-nav scroll model keeps working.
- The continuity moments use a stacked layout (badge row + title +
  summary + context line) so each moment is comfortably tappable on a
  phone.
- The Payment readiness card uses a two-column header (title + total)
  on every viewport so the parent's eye lands on the total
  immediately, then scans down through the next-due hint and the
  capped list.
- The "Past due" pill uses an amber tone, never red, so the surface
  stays calm even in the `attention` tone.

### API additions

`GET /api/guardian-portal/me` is unchanged in shape but now also
returns two optional blocks alongside the existing `landing`:

| Field              | Purpose                                                           |
|--------------------|-------------------------------------------------------------------|
| `paymentReadiness` | Calm, family-facing finance projection (see table above).         |
| `communication`    | The capped continuity strip + `hasOpenFamilyRequest` flag.        |

Both blocks are tenant-isolated through the same session/access path
and never include staff-only metadata.

### Validation additions for v1.3 (Wave 22)

- `npm run parent:portal:v1.3:test` is a new pure-Node validator
  smoke. It mirrors the projection rules in `getPortalHome` for the
  v1.3 surfaces (charge filtering, ordering, tone derivation, hard
  caps, continuity windowing) so we can gate every CI run without
  needing a database.
- `npm run i18n:check` parity is extended to cover the full
  `portal.home.continuity*` and `portal.home.payment*` key sets so
  EN/TR copy can never silently drift.
- `apps/web` smokes pick up two new
  `GuardianPortalHomePage.smoke.test.tsx` cases — one for the v1.3
  continuity strip + payment readiness in the `attention` tone, one
  for the calm `clear` state — so the parent-facing rendering is
  protected on every CI run.
- The existing `npm run lint`, `npm run build`, `npm run repo:guard`,
  `npm run tenant:branding:test`, `npm run club:updates:test`,
  `npm run family:activation:test`, and `npm run frontend:smoke`
  checks all stay green.

### What is intentionally still out of scope (v1.3 / Wave 22)

- A full inbox, threading, or read/unread theatre for parent
  communication — the continuity strip is deliberately a strip, not a
  feed.
- Live payment collection, card capture, or online checkout — the
  Payment readiness card stays a clarity surface, not a transaction
  surface.
- Per-family notification routing, mute/snooze controls, or
  preference centers — the strip caps and tones do the work instead.
- An admin "communication CRM" view of the continuity moments —
  staff already see the underlying club updates and family-action
  requests on their own surfaces and we deliberately don't double
  the data here.

## Stabilization & Productization Gate updates

Between v1.3 and the next major capability wave, the
[Stabilization & Productization Gate](./stabilization-gate.md) sprint
hardened the portal's trust surfaces without adding new sections:

- **Refresh-on-focus**: `GuardianPortalHomePage` now refetches
  `/api/guardian-portal/me` whenever the tab becomes visible again,
  so a parent returning from `/portal/actions/:id` after submitting
  sees up-to-date attention counts and continuity strip without a
  hard refresh. The page also honours an incoming `#family` /
  `#updates` / `#payment` / `#continuity` / `#this-week` hash on
  landing so the bottom-nav shortcut from a non-home route always
  scrolls to the right section.
- **Past requests, not duplicate requests**: the lower section of
  the home is now `portal.home.pastRequestsTitle` ("Past requests")
  and only renders resolved / closed / submitted history. Active
  items (`open`, `pending_family_action`, `rejected`) are left
  exclusively to "What needs your attention" so the page stops
  repeating the same CTA.
- **Calm club-updates empty state**: the empty `ClubUpdatesStrip`
  no longer echoes the branding welcome copy. The hero card at the
  top of the page already carries that message; repeating it inside
  an "Updates from the club" surface made the page feel pasted.
- **Action page no longer auto-redirects**: submitting a request
  keeps the parent on the request, refetches it so the status badge
  and history reflect what they just sent, and shows a clear success
  alert. The explicit "Back to home" link is the exit. The previous
  700ms auto-redirect threw the parent at a stale home before they
  could read the confirmation.
- **Activation invalid-link recovery**: `GuardianPortalActivationPage`
  now offers an explicit `Recover an existing account` /
  `Sign in` pair when the invite token can't be resolved (expired,
  used, malformed, or missing). Previously the parent was left at a
  card whose only escape was the brand link in the header.
- **PortalShell bottom-nav off-home navigation**: the **Family** and
  **Updates** mobile shortcuts now navigate to `/portal/home#…`
  when the parent is on a non-home route (`/portal/actions/:id`),
  instead of relying on a `#…` href that did nothing.

New regression protection:

- `apps/web/src/pages/GuardianPortalActivationPage.smoke.test.tsx`
  covers the calm activation form, the new Recover / Sign-in
  escapes, and a successful password submission.
- `npm run stabilization:gate:test` is a pure-Node validator that
  fails if any of the above contracts regresses (action-center
  error surfacing, charge-item delete confirm, portal past-requests
  separation, activation recovery escape, settings deep-link
  anchors, portal bottom-nav off-home navigation).

## Parent Invite Delivery & Access Reliability Pack

The previous waves established the parent invitation, activation,
recovery, and session model. This pack closes the **delivery** gap —
the real-world reason a guardian record can be created and an invite
"triggered" without the family ever receiving anything. The product
principle is explicit: **truth over illusion**. The platform never
implies an invite was delivered without a real provider response, and
when delivery is unavailable it offers a calm, professional manual
fallback rather than hiding the problem.

### What was actually broken

- `inviteGuardian` minted a token and persisted an access row, but
  there was no email-dispatch path at all.
- The staff UI rendered a success toast that referenced an i18n key
  (`pages.guardians.portalAccess.inviteSuccess`) which did not exist
  in either the EN or TR locale, so staff saw the raw key — and at
  the same time, no email was actually being sent.
- There was no "delivery is unavailable, share manually" fallback,
  no copyable link surface, no truthful per-row delivery state, and
  no provider readiness indicator anywhere.

### What this pack adds (smallest strong strategy)

This pack does **not** introduce a second auth model, a second
activation flow, or a separate notification platform. It extends the
existing guardian-portal module and the existing
`guardian_portal_accesses` row with a tiny, honest delivery seam.

#### Truthful delivery state on the access row

A new migration `Wave21ParentInviteDeliveryReliability` adds a small
set of columns to `guardian_portal_accesses` so every (re)issue carries
the honest outcome of the most recent attempt. Existing rows stay safe
— every column is nullable / has a sensible default.

| Column | Purpose |
|--------|---------|
| `inviteDeliveryState` | `pending` · `sent` · `failed` · `shared_manually` · `unavailable` — the staff UI renders this verbatim. |
| `inviteDeliveryProvider` | Provider that produced the state (`smtp` / `manual`). |
| `inviteDeliveryDetail` | Operator-friendly short note (e.g. `provider_accepted:<id>`, `smtp_not_configured`, `550 mailbox unavailable`). |
| `inviteDeliveryAttemptedAt` | Stamp of when the most recent dispatch was attempted. |
| `inviteDeliveredAt` | Stamp of when the provider accepted the message (only stamped on `sent`). |
| `inviteSharedAt` | Stamp of when staff explicitly used the manual fallback. |
| `inviteAttemptCount` | Increments on every (re)issue so we can spot families that needed multiple invites. |

Every fresh invite resets the delivery columns so the staff UI never
carries a stale "sent" badge across attempts. The activation token,
its expiry, the recovery flag, and the session model are unchanged.

#### Tiny `InviteDeliveryService` (SMTP via nodemailer)

Email is the primary channel — it is the lowest-trust-bar provider
every club already has access to (their own provider, a transactional
service, even a workspace mailbox in dev) and the activation page
already expects an email-style invite. The service is intentionally
small and never doubles as a generic notification platform.

- **No SMTP configured** → `unavailable`. The activation link is still
  minted; staff use the manual share fallback.
- **SMTP configured but provider rejects** → `failed`. The detail line
  carries the provider error verbatim (truncated to 480 chars).
- **SMTP accepts the message for delivery** → `sent`, with the
  provider message id captured in the detail line.

Secret material stays in the host environment (`SMTP_HOST`,
`SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`,
`PORTAL_PUBLIC_ORIGIN`). The service never persists credentials. The
outgoing email body is bilingual (EN / TR) and follows the existing
calm parent-portal tone — no provider jargon, no scary copy.

#### New staff endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `GET /api/guardian-portal/staff/invite-delivery/readiness` | staff (`TenantGuard`) | Calm "can the platform actually deliver invite emails right now?" answer. Renders as the truthful `Email delivery configured` / `Email delivery unavailable` chip in the staff UI. |
| `POST /api/guardian-portal/staff/invite-delivery/verify` | staff (`TenantGuard`) | Opt-in live SMTP `verify()` roundtrip. Failures are reported truthfully; the readiness chip never auto-promotes. |
| `PATCH /api/guardian-portal/staff/access/:accessId/mark-shared` | staff (`TenantGuard`) | Stamps the access row with `shared_manually` after staff have copied / shared the activation link themselves. The existing invite token continues to be the activation source of truth — no second token is minted. |

The existing `POST /api/guardian-portal/staff/guardians/:guardianId/access`
(invite + resend) and `PATCH /api/guardian-portal/staff/access/:accessId/enable`
endpoints are unchanged in shape; their responses now also carry the
truthful `delivery` summary plus an `absoluteInviteLink` so the staff
UI can show the full, copyable link without reconstructing it from
`window.location.origin` after the fact.

#### Staff-side UX

The Guardian detail page **Portal access** card now answers the three
questions a staff user actually asks during an invite flow:

1. _Can the platform send an email at all right now?_ — a calm
   readiness chip (with an optional `Test delivery` button) renders
   above the actions, both before and after the invite has been
   issued.
2. _What actually happened with the most recent attempt?_ — a calm,
   truthful inline alert explains the latest state in plain language
   (`Email sent`, `Email failed`, `Email unavailable`, `Shared
   manually`, `Preparing`). We never write "sent" without a real
   provider response.
3. _How do I get the parent into the portal right now?_ — a dashed
   "Activation link" panel exposes the absolute single-use link with
   a `Copy link` button (clipboard API + textarea fallback), a
   `Mark as shared with family` action when delivery was
   `unavailable` / `failed` / `pending`, and a calm one-line hint
   ("Share over a channel the family already trusts, then mark as
   shared"). The link itself is rendered in a tappable, mobile-safe
   monospace block.

The previous "resend invite", "enable", and "disable" actions stay in
place — none of them mint a parallel auth model.

#### Parent-side activation reliability

The parent activation page is functionally unchanged because it was
already correct: it accepts the invite token, lets the parent set a
password, and lands them in the portal. The Stabilization Gate work
already added explicit `Recover an existing account` /
`Sign in` escapes when the token can't be resolved (expired, used,
malformed, or missing). What this pack changes is upstream of that:
the activation link the parent receives is now backed by a truthful
delivery contract, so we no longer hand families dead invites.

When a parent receives the activation link via the manual share path,
they land on exactly the same calm, branded activation page they
would have landed on from a real email — there is no second flow.

#### Mobile-first touches

- The readiness chip and the activation-link panel both stay above
  the fold on a phone.
- `Copy link`, `Mark as shared with family`, and `Resend invite` use
  comfortable 44px tap targets, never cluster more than three
  actions per row, and wrap calmly on narrow widths.
- The link itself is rendered with `break-all` so a single-handed
  user can read the whole link without horizontal scroll.
- The `Copy link` action emits a tiny inline `Copied` acknowledgement
  rather than a system toast, keeping the page calm.

### Validation additions for this pack

- `npm run parent:invite:delivery:test` is a new pure-Node validator
  smoke. It guards readiness classification (`SMTP_HOST` /
  `SMTP_FROM` boundary cases), the delivery-state projection
  (no silent re-classification of `unavailable` / `failed` to
  `sent`), the resend semantics (every (re)issue resets stale
  delivery columns), the staff-facing tone-key mapping (so the UI
  never silently regresses to raw key copy), and the manual fallback
  rule (`mark-shared` refuses to stamp when there is no active
  invite token).
- `npm run i18n:check` parity is extended to cover the entire new
  `pages.guardians.portalAccess.deliveryStateLabel`,
  `pages.guardians.portalAccess.deliveryTone`, and
  `pages.guardians.portalAccess.deliveryReadiness` blocks plus the
  new `inviteIssued`, `delivery*`, `share*`, `copy*`, and
  `markShared` keys.
- `npm run lint`, `npm run build`, `npm run repo:guard`,
  `npm run frontend:smoke`, `npm run family:activation:test`,
  `npm run club:updates:test`, `npm run tenant:branding:test`,
  `npm run parent:portal:v1.3:test`, `npm run stabilization:gate:test`,
  `npm run finance:clarity:test`, `npm run onboarding:imports:test`,
  and `npm run onboarding:readiness:test` all stay green on top of
  the new validator.

### Configuration (operator-facing)

Add the following to `apps/api/.env` to enable real delivery:

```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=invitations@example.com
SMTP_PASSWORD=changeme
SMTP_FROM="Amateur Club <invitations@example.com>"
PORTAL_PUBLIC_ORIGIN=https://portal.example.com
```

When unset, the platform stays in the truthful `Email delivery
unavailable` state — no env var has a fake-success default. Running
the API without SMTP configured is fully supported and is the
expected developer / demo mode: every invite falls back to the
manual-share path, which is itself a legitimate operational surface,
not a workaround.

### What is intentionally still out of scope

- Webhook-based bounce / delivery receipts. We claim `sent` only when
  the provider accepts the message; deeper post-acceptance state is
  intentionally deferred.
- A per-tenant SMTP override (the env-resolved provider is
  platform-wide for now).
- A magic-link / phone-OTP recovery surface — recovery still flows
  through the staff resend-invite path, the same as in v1.2.
- A general-purpose notification platform / outbox — the seam is
  bounded to parent invite delivery on purpose.

## Parent Access + Family Journey Stabilization Pass

This pass does not open a new breadth wave. The wave above (Parent
Invite Delivery & Access Reliability Pack) shipped a real, working
end-to-end family journey. This pass exists to make that chain more
trustworthy in actual use:

```
staff issues invite
  → delivery state is truthful
    → staff can verify or manually share
      → parent receives / opens activation link
        → parent activates successfully
          → parent lands in a useful first experience
            → family activation visibility updates correctly
              → recovery / continuity remain coherent
```

### What this pass actually changed

#### Coherence between activation and the recovery / delivery surfaces

Before this pass, a family that:

1. used the public *I lost access* form (which stamped
   `recoveryRequestedAt` on their access row), and then
2. activated via the freshly-resent invite,

still appeared to staff with a *“asked for help”* banner on the
guardian detail surface and inside the **Asked for help** bucket of the
family activation overview. The truth was the opposite — they were
already inside the portal.

`GuardianPortalService.activate()` now clears the recovery flag
(`recoveryRequestedAt`, `recoveryRequestCount`) and the stale invite
delivery state (`inviteDeliveryState`, `inviteDeliveredAt`,
`inviteSharedAt`, …) on success. The activated row graduates out of the
*“did the invite reach them?”* and *“are they still locked out?”*
questions entirely. The staff overview, the delivery badge on the
guardian detail page, and the recovery banner all flip in lockstep with
the parent's actual reality.

#### Truthful, code-tagged activation errors

`getActivationStatus()` and `activate()` used to throw a single
`UnauthorizedException('Invite link is invalid or expired')` for three
materially different states. The activation page rendered the same
*“no longer valid”* copy for all of them.

Both endpoints now return a stable `code` on the 401 envelope:

| Code                       | Meaning                                                   |
|----------------------------|-----------------------------------------------------------|
| `invite_link_invalid`      | The token did not match any row (typo / truncated link).  |
| `invite_link_expired`      | The token matched but the 72h window elapsed.             |
| `portal_access_disabled`   | The row exists but staff paused this access on purpose.   |

The activation page picks warmer per-reason wording from
`portal.activate.errors.{missing,invalid,expired,disabled,network}` and
the matching `…Hint` keys. We never leak account existence — the wording
stays calm and gives the parent two warm escape paths (Recover / Sign
in) on every error.

`apps/web/src/lib/api.ts` exposes the parsed `code` on `ApiError.code`
so any future surface can route on the same contract without re-parsing
the envelope.

#### Staff-side UX coherence on the guardian detail page

The portal-access section on the guardian detail page used to render
**Disable** + **Resend invite** as two equal ghost buttons regardless
of state, leaving staff guessing which one was the primary path. The
section now picks a single primary action per state:

- **disabled** → *Re-enable portal* (only path).
- **invited / recovery flag set** → *Resend invite* primary, *Disable*
  secondary.
- **active and no recovery** → *Disable* primary; a quiet *Send fresh
  link* ghost stays available for the rare case where a family asked
  for one through a side channel.

The activation link panel surfaces the manual-share path as the
primary CTA exactly when the email path is not working
(`pending` / `unavailable` / `failed`) and demotes it to a calmer
ghost in the `sent` state. Once a row is `shared_manually` we hide the
fallback button entirely so staff never re-stamp by accident.

The link itself is hidden on activated rows — they no longer need it,
and showing it would imply the parent still hadn't joined.

All buttons in this surface guarantee a 44 px tall touch target so
staff can manage access reliably from a phone.

#### Calmer truthful copy across the delivery badges

The previous wave landed *“Email sent”* / *“The invitation email was
accepted by the provider”* as the success copy. That implied a
stronger guarantee than SMTP can offer (the provider can accept and
still bounce silently). The badge now reads *“Email handed off”* and
the tone copy is *“Handed off to the email provider — we cannot
confirm the inbox, just the handoff.”* (TR mirrored). The truthful
delivery model itself is unchanged.

#### Activation rate denominator excludes paused rows

`getActivationOverview` used to compute the activation-rate percentage
against every access row including `disabled` ones. That deflated the
truthful rate and made the staff overview feel pessimistic. The
denominator now clamps to non-paused rows, keeping the recovery
families counted (they are mid-help, not paused). The clamp prevents a
divide-by-zero on tenants where every access is paused.

#### Parent recovery — explicit *what happens next*

The recovery confirmation page now renders a small *Next step* line
under the success message so the parent knows the request reached
their club and what to expect. The truthful-delivery discipline is
preserved (we still never confirm whether their email is on file).

### Validation additions

A new pure-Node validator
[`scripts/parent-access-stabilization.test.mjs`](../scripts/parent-access-stabilization.test.mjs)
gates four contracts on every CI run, with no database required:

1. The three activation error codes are mapped exactly the way the
   activation page expects them.
2. `applyActivation()` clears the recovery flag and the stale
   invite-delivery state.
3. The activation-rate denominator excludes paused rows and clamps to
   zero on the all-paused edge.
4. The InviteLinkPanel CTA hierarchy promotes / demotes the manual
   fallback in lockstep with the delivery state.

The CI workflow now also explicitly runs the existing pure-Node
parent-portal validators alongside the stabilization gate so any
regression in the parent/family journey is caught at PR time:

- `parent:invite:delivery:test`
- `family:activation:test`
- `parent:portal:v1.3:test`
- `club:updates:test`
- `parent:access:stabilization:test`

Two new vitest smokes cover the activation page error reasons (expired
vs disabled wording) and the new recovery *Next step* line.

### What is intentionally still out of scope

- A new public reset / magic-link / OTP recovery flow. Recovery still
  goes through the staff resend-invite path on purpose.
- A second family-action / invite / follow-up engine. The pass
  hardens the existing surfaces in place.
- Webhook-based bounce / delivery receipts. *Sent* still means the
  provider accepted the handoff — never more.
- A redesigned staff operations console for invite delivery. The
  existing access summary + activation overview surfaces remain the
  single staff entry point.
