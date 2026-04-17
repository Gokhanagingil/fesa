# Reporting and command center

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
