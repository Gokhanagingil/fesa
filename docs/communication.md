# Communication & Follow-up

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
chat opens with a personalized message ready.

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
link that re-hydrates the audience source and the template.

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
