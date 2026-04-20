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

## Validation

- `npm run lint` — covers the new branding service, controllers, DTO, and
  portal pages.
- `npm run i18n:check` — protects locale parity for the new portal copy.
- `npm run repo:guard` — workspace hygiene (existing).
- `npm run tenant:branding:test` — pure-Node validator smoke for the
  brand color and URL normalization rules used by
  `TenantBrandingService.updateBranding` (no database required).
- `npm run frontend:smoke` — covers the new `GuardianPortalHomePage` and
  `GuardianPortalLoginPage` smokes alongside the existing reporting,
  imports, inventory, and communications smokes.

The existing `npm run api:boot:smoke`, `npm run dashboard:smoke`, and
`npm run reporting:smoke` checks remain unchanged and still gate the API.
