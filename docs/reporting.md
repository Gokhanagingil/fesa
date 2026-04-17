# Reporting and command center

## Wave 12 — Reporting Experience Pack v2

Wave 12 builds on the v1 foundation so the reporting experience feels useful on
first load and powerful enough for everyday club operations — without turning
the product into a corporate BI console.

Everything in v2 sits inside the same files / endpoints / persistence layer
introduced in v1. There is no parallel module, no v2 catalog, and no new
saved-view table.

## Wave 12.1 — Reporting Experience Pack v2 Closure

The closure sprint intentionally stays inside the same reporting foundation and
polishes the product entry points instead of creating another reporting layer.

### What the closure sprint tightens

| Area | Closure change |
|------|----------------|
| **Frontend smoke protection** | `@amateur/web` now ships a lightweight Vitest + Testing Library smoke layer for reporting journeys. |
| **Reports page actionability** | The page now leads with "continue / open / group / save" actions instead of passive definition cards. |
| **Dashboard cohesion** | Selected dashboard stat cards and CTAs now land in reporting contexts where that helps staff investigate a signal quickly. |
| **Finance discoverability** | Finance now presents the reporting entry as a friendly finance explorer with starter shortcuts and calmer framing. |
| **Saved-view entry consistency** | Report Builder now hydrates starter links, preset links, and saved-view links from the same surface. |

### Frontend reporting smoke coverage

The web workspace now includes a lightweight smoke runner:

```bash
npm run frontend:smoke
```

That command runs `vitest` against `src/**/*.smoke.test.tsx` inside
`apps/web` and currently protects these reporting journeys:

- Report Builder landing renders.
- Curated starter panel loads and a starter can be opened.
- Grouping can be enabled and grouped results render.
- Saved-view flows cover save-as-new, duplicate-from-starter, and delete of an
  existing view.
- Dashboard drill-down links still point to the intended reporting context.

This is intentionally **not** a heavyweight browser E2E layer. The repo keeps:

- API / contract smoke in `scripts/reporting-smoke.mjs`
- UI / route smoke in `apps/web` via Vitest + Testing Library

so coverage stays fast and maintainable.

### Entry-flow notes

- `ReportsPage` now acts as a reporting launchpad: continue a saved view, open a
  starter, jump straight to grouped summaries, or enter the builder with a
  useful intent.
- `DashboardPage` keeps direct operational links where they still make sense,
  but overdue / outstanding / teamless / workload signals now more consistently
  drop staff into the report experience.
- `FinanceHubPage` now exposes the same reporting foundation as a "Finance
  explorer" with starter shortcuts and calmer onboarding copy.
- `ReportBuilderPage` now hydrates `?starter=`, `?preset=`, and
  `?savedView=` links from the same surface.

### What v2 adds

| Capability | Shape |
|------------|-------|
| **Curated starter reports** | New catalog of deterministic, tenant-safe reports surfaced in the Report Builder and Reports page so the experience is never "blank canvas". |
| **Lightweight grouping / aggregation** | One dimension + a small set of measures (`count`/`sum`/`avg`/`min`/`max`), capped at 200 groups. |
| **Dashboard → report drill-downs** | Dashboard cards open the Report Builder with a meaningful starter or a base64-encoded preset filter. |
| **Saved-view UX polish** | Owner / shared chips split, friendlier save dialog, explicit duplicate-vs-update mode, empty-state hint. |
| **Report Builder onboarding** | Welcome card, three calm steps, and the curated starter panel above the entity picker. |
| **Management Pack** | The `Reports` page now lists a curated, manager-friendly subset of the same starter catalog. |
| **Export polish** | CSV headers are humanised; grouped exports include a `-grouped-by-*` filename hint. |

### Starter / curated reports

Defined in `apps/api/src/modules/reporting/catalog.ts` as `STARTER_VIEWS` and
exposed via `listStarterViews()` / `getStarterView()`. Each entry is a small
JSON-shaped record (`StarterReportView`) that uses **only** real catalog fields
and the same filter grammar as the rest of the engine. Adding a new starter is
a one-place change:

1. Append a `StarterReportView` literal in `catalog.ts`.
2. Add `pages.reports.starter.<id>.title` / `description` keys in both `en/`
   and `tr/` locale JSON files.
3. (Optional) flag it `managementPack: true` to also surface it on the Reports
   page management-pack section.

The current set covers:

| ID | Entity | Notes |
|----|--------|-------|
| `athletes.activeWithoutTeam` | athletes | Active athletes whose `teamCount` is 0. |
| `athletes.trialFollowUp` | athletes | Trialists awaiting decision. |
| `athletes.outstandingBalance` | athletes | `outstandingTotal > 0`, sorted desc. (mgmt) |
| `athletes.unpaidPrivateLessons` | athletes | Existence check on unpaid PL charges. |
| `athletes.femaleShirtSizeM` | athletes | Demo of multi-condition filtering. |
| `athletes.byGroup` | athletes | Grouped count by primary group. (mgmt) |
| `athletes.byGender` | athletes | Grouped count by gender. |
| `athletes.outstandingByGroup` | athletes | Count + sum(outstandingTotal) by group. (mgmt) |
| `guardians.contactGaps` | guardians | `contactComplete = false`. |
| `guardians.unlinked` | guardians | `notExists` on linked athletes. |
| `lessons.upcoming` | private_lessons | `status = planned`, sorted by date. |
| `lessons.unbilled` | private_lessons | `chargeStatus = unbilled`. |
| `lessons.byCoach` | private_lessons | Count + sum(chargeRemaining) by coach. (mgmt) |
| `finance.overdue` | finance_charges | `isOverdue = true`, sorted by remaining. (mgmt) |
| `finance.outstandingByItem` | finance_charges | Pending/partial grouped by item. (mgmt) |
| `finance.overdueByCategory` | finance_charges | Overdue grouped by category. |

### Lightweight grouping / aggregation

`ReportRunRequest.groupBy` was added (optional). Shape:

```jsonc
{
  "field": "athlete.primaryGroupName",
  "measures": [
    { "op": "count",  "alias": "athleteCount" },
    { "op": "sum",    "field": "athlete.outstandingTotal", "alias": "outstandingSum" }
  ],
  "sort": { "alias": "outstandingSum", "direction": "desc" },
  "limit": 50
}
```

Constraints kept on purpose:

- exactly one dimension; the field must declare `groupable: true` in the catalog;
- up to six measures, each `count|sum|avg|min|max`;
- non-`count` measures require a numeric/currency catalog field that lists the
  requested op in `aggregations`;
- ORDER BY is alias-based only (dimension or measure alias);
- soft cap of 200 groups (default 50);
- tenant isolation enforced by the same base query as row mode.

The grouping engine lives entirely inside `ReportingQueryCompiler.runGrouped`
in `query-compiler.ts`. Row-mode runs are unchanged. CSV export honours the
same `groupBy` payload.

Marking a field group/aggregate-friendly is a single-file change in
`catalog.ts`:

- Add `groupable: true` to dimension fields (low-cardinality enums / strings).
- Add `aggregations: ['sum', 'avg', 'min', 'max']` (subset OK) to numeric or
  currency fields you want to allow as measures.

### Dashboard drill-downs and the deep-link mechanism

There are two clean ways to deep-link into the Report Builder from anywhere
inside the app — no ad hoc URL hacks:

- `?starter=<id>` — opens the named starter view.
- `?preset=<base64-json>` — opens an arbitrary explorer state. The payload
  shape is `DeepLinkPreset` from `apps/web/src/lib/report-deep-link.ts` and
  may include `entity`, `filter`, `columns`, `sort`, `search`, `groupBy`, and
  a friendly `contextLabel`.

The Dashboard now uses the starter form for six drill-down cards (overdue
charges, outstanding balances, teamless athletes, upcoming lessons,
outstanding-by-group, lessons-by-coach). Tenant context is preserved because
the deep link only carries the report shape, not the tenant id — the
existing `TenantGuard` resolves the active club at request time.

### Saved view UX polish

Saved views still live in `saved_filter_presets`. v2 stores two extra
optional fields **inside the existing `payload` JSON column** so no migration
is required:

- `payload.groupBy` — when set, the view loads in grouped mode.
- `payload.derivedFromStarterId` — provenance for views forked from a starter.

Frontend changes:

- "Your views" and "Shared with the club" chips are now split for clarity.
- The save dialog has explicit `Save as new` / `Update this view` modes; when
  the explorer is showing a starter view, the dialog defaults to `Save as new`
  so the curated catalog is never accidentally overwritten.
- Visibility radios surface a one-line hint each (`Just for me` vs
  `Visible to every staff member in this club`).
- A first-run hint in the toolbar explains saved views in plain language for
  clubs that have never created one.

### Validation

- `npm run reporting:filter-tree:test` — pure validator unit smoke (v1).
- `npm run reporting:starter-views:test` — new in v2; loads the compiled
  starter catalog and asserts every entry references real catalog fields,
  the filter validates, and grouping/aggregation declarations match.
- `npm run reporting:smoke` — exercises catalog, run, export, saved-view
  CRUD, **starter-view listing**, **grouped run**, **bad groupBy rejection**,
  **grouped saved-view round-trip**, and **grouped CSV export** across every
  accessible tenant.

### Intentionally still deferred (v2)

- Multi-axis pivot tables (one dimension is enough today).
- Calculated fields beyond the catalog.
- Scheduled report delivery.
- Server-side dashboards / charts.

---

## Wave 11 — Executive Demo & Reporting Foundation Pack v1

Wave 11 turns the amateur platform's operational backbone into a real reporting
foundation while sharpening the executive demo on the dashboard.

The platform now ships a single, reusable filtering / reporting spine:

- **Reportable Field Catalog** — metadata-driven definitions of every field that
  can be filtered, selected, sorted, or exported. One file, one source of truth:
  `apps/api/src/modules/reporting/catalog.ts`.
- **Filter Tree Grammar** — a JSON tree with AND / OR groups, NOT, leaf
  conditions, and explicit relation existence/non-existence checks. Validated
  per entity by `apps/api/src/modules/reporting/filter-tree.ts`.
- **Safe Query Compiler** — translates the validated tree into TypeORM
  `SelectQueryBuilder` SQL, always tenant-scoped and always parameterised:
  `apps/api/src/modules/reporting/query-compiler.ts`.
- **Saved views** — persisted in the existing `saved_filter_presets` table
  (`surface = 'report:<entity>'`) so we don't introduce a parallel persistence
  layer. Owned by a staff user, optionally `shared` with the rest of the club.
- **CSV export** — `/api/reporting/export` honours the same filter/sort/columns
  payload, scoped by tenant and capped per-entity by `exportRowLimit`.

Both the existing report cards (`/api/reporting/definitions`) and the
command-center summary (`/api/reporting/command-center`) keep their existing
behaviour. The new endpoints sit alongside them; nothing was rebuilt from
scratch.

### v1 entities

| Entity key            | What it represents                                               |
|-----------------------|------------------------------------------------------------------|
| `athletes`            | Athlete roster, with derived guardian / team / charge metadata.  |
| `guardians`           | Guardian directory, with athlete count and contact completeness. |
| `private_lessons`     | Private lessons joined to coach / athlete / charge.              |
| `finance_charges`     | Athlete charges joined to charge item / payments / overdue.      |

Each entity exposes:

- selectable + sortable columns,
- relation existence checks (e.g. `athlete.guardiansExist`,
  `athlete.unpaidPrivateLessonChargesExist`),
- enum / number / date / currency / boolean operators,
- safe joins (no arbitrary path traversal — joins are explicit per field).

### Filter tree shape

```jsonc
{
  "type": "group",
  "combinator": "and",
  "children": [
    { "type": "condition", "field": "athlete.gender", "operator": "is", "value": "female" },
    { "type": "condition", "field": "athlete.shirtSize", "operator": "is", "value": "M" },
    { "type": "condition", "field": "athlete.teamId", "operator": "isNot", "value": "<team-uuid>" },
    { "type": "condition", "field": "athlete.guardiansExist", "operator": "exists" },
    { "type": "condition", "field": "athlete.privateLessonsExist", "operator": "exists" },
    { "type": "condition", "field": "athlete.unpaidPrivateLessonChargesExist", "operator": "exists" }
  ]
}
```

The combinator is `and` / `or`; groups can be inverted with `not: true` to
express "athletes whose entire group of conditions fails". Nesting is capped at
6 levels and 64 nodes total.

### Operator catalog

| Operator          | Notes                                                               |
|-------------------|---------------------------------------------------------------------|
| `is` / `isNot`    | Equality (uses `IS DISTINCT FROM` to handle NULLs).                 |
| `in` / `notIn`    | Array membership; `notIn` also matches NULL rows.                   |
| `contains` / etc. | Case-insensitive substring matches for `string` fields.             |
| `gt`/`gte`/`lt`/`lte` / `between` | Number, currency, date, datetime fields.            |
| `isEmpty` / `isNotEmpty` | NULL / empty-string checks.                                  |
| `exists` / `notExists` | Relation existence (e.g. has guardians, has unpaid charges).    |

Invalid operator/field combinations short-circuit with a `400 Bad Request` and
a descriptive message; the frontend surfaces the same message inline.

### Tenant safety

Tenant isolation is enforced unconditionally inside
`ReportingQueryCompiler.buildBaseQuery`. The base alias's `tenantId` is the
first WHERE clause and the same `tenantId` is propagated into every relation
subquery (e.g. `EXISTS (SELECT 1 FROM athlete_guardians ag_sub WHERE
ag_sub."tenantId" = a."tenantId")`). The filter tree itself is not allowed to
mention `tenantId`.

The `TenantGuard` middleware still resolves the active club; `req.tenantId` is
required for every reporting endpoint.

### API endpoints

| Method | Path                                  | Purpose                                                         |
|--------|---------------------------------------|-----------------------------------------------------------------|
| `GET`  | `/api/reporting/definitions`          | (Existing) Live "report cards" with i18n keys.                  |
| `GET`  | `/api/reporting/command-center`       | (Existing) Manager dashboard summary.                           |
| `GET`  | `/api/reporting/catalog`              | New. Returns the Reportable Field Catalog.                      |
| `POST` | `/api/reporting/run`                  | New. Runs a filter tree, returns rows + total + paging.         |
| `POST` | `/api/reporting/export`               | New. CSV export of the same payload (UTF-8 BOM for Excel).      |
| `GET`  | `/api/reporting/saved-views`          | New. Lists saved views (own + shared in this tenant).           |
| `POST` | `/api/reporting/saved-views`          | New. Creates a saved view.                                      |
| `GET`  | `/api/reporting/saved-views/:id`      | New. Reads a saved view (scoped by visibility).                 |
| `PATCH`| `/api/reporting/saved-views/:id`      | New. Updates the view (owner only).                             |
| `DELETE`| `/api/reporting/saved-views/:id`     | New. Removes the view (owner only).                             |

### Adding a new reportable field

1. Add a `ReportFieldDefinition` to `ATHLETES` / `GUARDIANS` / `PRIVATE_LESSONS` /
   `FINANCE` in `apps/api/src/modules/reporting/catalog.ts`.
2. Add a SQL projection in `query-compiler.ts` (`FIELD_TABLE`).
3. If the field requires a join, register it in `JOIN_DEFS` and reference it in
   the field's `joins` array.
4. If the field is a relation existence check, add a subquery in
   `RELATION_EXISTS` and set `relationCheck: true` in the catalog entry.
5. (Optional) add an i18n label under `pages.reports.fields.*` in both `en` and
   `tr` locales.

### Saved views (persistence)

The existing `saved_filter_presets` table now also stores Reporting v1 saved
views. Wave 11 adds:

- `entity` (varchar 64) — logical entity key (`athletes` etc.).
- `description` (varchar 500) — optional manager-facing context.
- `filterTree` (jsonb) — full validated filter tree.
- `columns` (jsonb) — selected column keys.
- `sort` (jsonb) — `[{ field, direction }]`.
- `visibility` (varchar 16) — `private` (owner only) or `shared` (club-wide).
- `ownerStaffUserId` (uuid) — owning staff user; FK to `staff_users`.

Legacy "communications" presets continue to work via the existing `payload`
column; the surface name discriminates rows.

### Export

Wave 11 standardises on **CSV with a UTF-8 BOM**:

- The BOM makes Turkish characters render correctly when the file opens in
  Excel without forcing the operator to import or change encoding.
- CSV avoids a heavy dependency (no XLSX writer in the API) and remains
  trivially diffable / scriptable.
- Excel can still save back to XLSX; clubs that need spreadsheet workflows lose
  nothing while we keep the API thin.

Operators see "Export CSV" in the explorer and the Report Builder; the
generated file is named `amateur-<entity>-YYYY-MM-DD.csv`.

### Frontend surfaces

- `/app/report-builder` — entity-pickable explorer (the Report Builder v1).
- `/app/athletes?view=advanced`, `/app/guardians?view=advanced`,
  `/app/private-lessons?view=advanced`, and `/app/finance` (collapsible card)
  embed the same `DataExplorer` so operators get one consistent advanced
  filtering experience.
- The Dashboard now renders an "Today's headline" card that interprets the
  current state (overdue → attention, calm → green) and links into the
  builder, action center, and overdue queue.

### Validation

- `npm run reporting:filter-tree:test` runs a Node smoke for the validator
  (no DB required).
- `npm run reporting:smoke` exercises the catalog, run, export, and saved-view
  endpoints against a running API across every accessible tenant.
- The existing `npm run dashboard:smoke` still covers the original sidebar
  endpoints (including `/api/reporting/command-center`).

## Wave 10 conventions still apply

(unchanged)

The single-truth, deep-link-first, no-vanity-notification conventions from
Wave 10 still govern the dashboard, command center, action center, and
communications surfaces.

## Intentionally still deferred

- Scheduled report delivery (CSV is on-demand only).
- Pivot tables / charts — Report Builder v1 is rows + columns only.
- Custom user-defined fields beyond the catalog.
- Email / SMS / WhatsApp delivery infrastructure.
