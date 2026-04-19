# Inventory & Assignment Pack v1

Codename: **amateur** · Sprint: **Inventory & Assignment Pack v1**

This document describes the inventory capability shipped in Wave 14. It is
intentionally lightweight: amateur sports clubs need to manage *physical
items* (jerseys, sweatshirts, balls, cones, bibs, equipment) and the
athletes who currently hold them — without inheriting warehouse-management
complexity.

## Goals

- Make stock visibility obvious: how many do we have, what is assigned,
  what is running low.
- Make athlete assignment / return frictionless from one place.
- Keep an honest, append-only history so questions like *"who had jersey
  #12 last season?"* stay answerable.
- Reuse existing reporting infrastructure rather than build a parallel
  reporting path.
- Stay calm and mobile-friendly — the inventory surface is meant to be
  used in the field, not from a dense desktop spreadsheet.

## Non-goals

- Multi-location warehouse semantics.
- Procurement / purchase orders.
- Per-unit serial tracking.
- Auto-generated finance charges from assignments. Finance integration is
  deliberately deferred to keep v1 focused; an `inventoryItemId` linkage
  on charges is *not* added in this wave.

## Domain model

Tables introduced by `Wave14InventoryAssignmentPack` (migration timestamp
`1746000000000`):

| Table | Purpose |
|-------|---------|
| `inventory_items` | Catalogue entry: name, category, optional sport branch, low-stock threshold, flags. |
| `inventory_variants` | Stockable units (size / number / colour, plus a `default` variant for pooled items). |
| `inventory_assignments` | Athlete ↔ variant link with optional return; open assignments have `returnedAt = null`. |
| `inventory_movements` | Append-only audit trail (`stock_added`, `stock_removed`, `stock_adjusted`, `assigned`, `returned`, `retired`). |

Each table is keyed by `tenantId`; foreign keys cascade on tenant deletion
and indexes match the most common queries (active items, low-stock variants,
open assignments per athlete, movements per item).

### Item flags

- `hasVariants`: true when the item carries meaningful variants. A
  pooled item (`hasVariants = false`) still owns one auto-generated
  *default* variant so stock math is uniform across all items.
- `trackAssignment`: true when athletes can be individually assigned a
  variant (e.g. numbered match jerseys). When an item is assignment-tracked
  the API rejects duplicate single-quantity assignments of the same variant
  to the same athlete.
- `lowStockThreshold`: zero disables the low-stock cue; a positive value
  flags variants whose available count drops to or below the threshold.
  Each variant may override the parent item's threshold.

### Stock math

Three numbers govern visibility, all on `inventory_variants`:

```
stockOnHand   — total physical units owned
assignedCount — sum of open assignments (recomputed on every assignment / return)
available     — max(stockOnHand - assignedCount, 0)
```

`available` is the number that drives "low stock" / "out of stock" cues.
The service prevents stock from going negative or below the assigned
count, so users get clear errors instead of mysterious deductions.

## API surface

All endpoints are tenant-scoped via `TenantGuard` (X-Tenant-Id header).

| Method | Path | Purpose |
|--------|------|---------|
| `GET`    | `/api/inventory/items` | Paginated list with summary counts (active / low / out / assignments / per-category). |
| `POST`   | `/api/inventory/items` | Create catalogue entry, optionally with variants and initial stock. |
| `GET`    | `/api/inventory/items/:id` | Item detail + active assignments + recent movements (last 50). |
| `PATCH`  | `/api/inventory/items/:id` | Update name, category, branch, thresholds, active flag. |
| `DELETE` | `/api/inventory/items/:id` | Delete (rejected if open assignments still exist). |
| `GET`    | `/api/inventory/items/:id/movements` | Last 100 movements for the item. |
| `GET`    | `/api/inventory/items/:id/assignments` | Active assignments (or all if `?includeReturned=true`). |
| `POST`   | `/api/inventory/items/:id/variants` | Add a new variant. |
| `PATCH`  | `/api/inventory/variants/:variantId` | Update variant size / number / colour / threshold / active flag. |
| `DELETE` | `/api/inventory/variants/:variantId` | Delete (rejected if open assignments or default variant). |
| `POST`   | `/api/inventory/variants/:variantId/stock-adjustments` | Apply a signed `delta` (with optional `note`). |
| `POST`   | `/api/inventory/assignments` | Assign a variant to an athlete (rejected when out of stock). |
| `POST`   | `/api/inventory/assignments/:assignmentId/return` | Close an open assignment. |
| `GET`    | `/api/inventory/athletes/:athleteId/assignments` | Athlete's active (or all) inventory holdings. |

### Validation guarantees

- Tenant isolation is enforced on every query.
- Stock cannot drop below zero or below the currently assigned count.
- A second open assignment of the same variant to the same athlete is
  blocked when the parent item has `trackAssignment = true`.
- Deleting items or variants with open assignments is rejected with a
  clear error.
- Movements are written for stock adjustments, assignments, returns —
  the history view stays honest by construction.

## Reporting integration

Reporting v1 receives a new entity, `inventory_variants`, with a small,
focused field catalog:

- **String / enum**: item name, category, sport branch, size, number, colour.
- **Number**: stock on hand, assigned, available, low-stock threshold.
- **Boolean**: low-stock flag, out-of-stock flag, active flag.

Three starter views ship out of the box (Inventory category in the Report
Builder):

| Starter | Purpose |
|---------|---------|
| `inventory.lowStock` | Variants whose available stock is at or below the threshold. *(management pack)* |
| `inventory.outOfStock` | Variants where the entire stock is currently assigned. |
| `inventory.byCategory` | Grouped count + summed stock + assigned per category. *(management pack)* |
| `inventory.assignedBySize` | Where the kit demand sits — sizes that are currently in use. |

These reuse the existing report builder, exports, and saved-view machinery;
no parallel reporting path was introduced.

## UX notes

- A new `Inventory` sidebar entry routes to `/app/inventory`.
- The page lists items as a calm card grid with summary counts (active,
  low, out, assigned).
- Each card opens an inline detail panel: variants with adjust-stock
  inputs, an assignment form, the active-assignment list with return
  buttons, and recent movement history with movement-type badges.
- Athlete detail gains a *Club inventory in their hands* section. Any
  open assignment can be returned in one tap from the athlete page.
- Form layouts collapse to a single column on small screens; tap targets
  are sized for thumb use.

## Demo seed

`runInventoryDemoSeed` runs after `runDemoSeedExpansion` and is fully
idempotent. For every demo club it creates:

- Match jersey (numbered) — 5 variants, several assigned.
- Club sweatshirt (sized) — 4 variants including a deliberately low-stock
  size to exercise the low-stock cue.
- Training balls — pooled stock.
- Cones — pooled stock, intentionally below threshold to demonstrate the
  low-stock signal.
- Training bibs — pooled stock.

Athletes from the existing demo cohort receive a few open assignments so
the athlete-detail integration shows real data.

## What is intentionally deferred

- Finance linkage (auto-charge an athlete when an item is assigned).
- Per-unit serial numbers and supplier metadata.
- Multi-warehouse / room-level stock locations.
- Bulk import / export tooling for the catalog.
- Communications-side inventory templates ("please return your jersey").
- Inventory-aware action-center surfacing.

These are sensible follow-up sprints once the v1 surface has lived with
real club operations for a while.
