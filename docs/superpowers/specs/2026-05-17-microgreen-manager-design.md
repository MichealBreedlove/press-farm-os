# Microgreen Manager — Design Spec

**Date:** 2026-05-17
**Status:** Draft — pending user review
**Owner:** Micheal Breedlove
**Reference:** [microgreenmanager.com](https://microgreenmanager.com)

## Summary

A new `/admin/microgreens` production module for Press Farm OS that solves "what do I sow today?" by working backward from upcoming demand. Includes a variety library, weekly demand targets, sow-plan algorithm, tray-level operations through soak/blackout/light/harvesting stages, harvest event logging, calendar view, and an auto-forecast sanity check.

Microgreens are tray-based, day-cycle production — fundamentally different from Press Farm's existing field-crop `plantings` table (bed-based, month-cycle). The microgreen module gets its own tables; the only link to the existing system is `microgreen_crops.item_id → items.id` so chefs can still order microgreens through the unchanged chef-order flow.

## Architecture

### Module placement

- **New top-level admin section:** `/admin/microgreens`. Slotted between `Crop Plan` and `Forecast` in the admin nav (bottom-nav on mobile, sidebar on desktop).
- **Existing pages untouched:** `/admin/items`, `/admin/plantings`, `/admin/orders`, `/admin/deliveries`, `/order/*` (chef flow).
- **Single integration point:** `microgreen_crops.item_id` is a nullable FK to `items.id`. When set, a microgreen crop is also a sellable item that chefs see in the existing order flow.
- **Sibling module:** the parallel `seeds` inventory spec (migration 043) is being built independently. Both modules link to `items.id`. v1 of microgreens does not write to `seeds`; integration is Phase 2.

### Data flow

```
demand (manual weekly targets + 8-wk rolling forecast)
        │
        ▼
   sow plan ──► daily task list (dashboard)
                       │
                       ▼
            sow batch ──► N tray rows (status='soaking' or 'blackout')
                                       │
                                       ▼
                       trays advance through stages
                                       │
                                       ▼
              harvest event ──► optional delivery_items link
                                (operator assigns at harvest)
```

### Module concerns

1. **Crops** — variety library with grow params (presoak/presprout hrs, blackout/light days, seed density, expected yield, continuous-harvest flag).
2. **Demand** — weekly targets per (crop × restaurant × day-of-week) + auto-forecast sidebar from historical `delivery_items`.
3. **Sow plan** — server-side algorithm that produces today's task list and feeds the calendar view.
4. **Tray ops** — individual tray rows that move through stages; harvest events log yield (one tray → many harvest events for continuous-harvest crops).

## Data Model

### Migration 044 — `044_microgreens_module.sql`

Five new tables, all admin-only via RLS `is_admin()` (matching the existing `plantings` pattern). All tables get `updated_at` triggers where applicable.

### `microgreen_crops` — variety library

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `farm_id` | uuid FK → farms | NOT NULL |
| `item_id` | uuid FK → items | NULLABLE — links to sellable item |
| `name` | text | NOT NULL |
| `variety` | text | NULLABLE |
| `seed_density_g_per_tray` | numeric | NOT NULL |
| `presoak_hours` | int | default 0 — cold-water soak in vessel |
| `presprout_hours` | int | default 0 — in colander after presoak |
| `bury_seed` | boolean | default false |
| `weight_during_blackout` | boolean | default false |
| `blackout_days` | int | default 0 |
| `keep_in_blackout` | boolean | default false — corn/popcorn never advance to light |
| `ideal_harvest_day` | int | NOT NULL — total days from sow to harvest (matches spreadsheet "Microgreens Harvest Time" / "Ideal Harvest" convention). Must be ≥ `blackout_days`. |
| `harvest_min_days` | int | NULLABLE — display range (e.g., 8 for "8-12 D") |
| `harvest_max_days` | int | NULLABLE — display range (e.g., 12 for "8-12 D") |
| `expected_yield_oz_per_tray` | numeric | NOT NULL |
| `is_continuous_harvest` | boolean | default false |
| `productive_life_days` | int | NULLABLE — only when continuous |
| `growing_medium` | text[] | subset of {soil, hydroponic} |
| `preferred_medium` | text | NULLABLE |
| `tray_size` | text | default '10x20' |
| `notes` | text | NULLABLE |
| `is_active` | boolean | default true |
| `created_at` / `updated_at` | timestamptz | |

**Derived (not stored):** total grow days = `ideal_harvest_day` (it's already total days from sow to harvest). `blackout_days` is the operational split — how many of those days are spent in blackout before moving to light. Constraint: `blackout_days ≤ ideal_harvest_day`. Presoak/presprout treated as within-day operations in v1 (don't shift `sow_date`).

### `microgreen_demand` — weekly targets

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `crop_id` | uuid FK → microgreen_crops | NOT NULL |
| `restaurant_id` | uuid FK → restaurants | NULLABLE (null = farm-wide / surplus) |
| `day_of_week` | int (0–6) | NOT NULL — JS convention (Sun=0, Thu=4, Sat=6, Mon=1) |
| `target_oz` | numeric | NOT NULL |
| `effective_from` | date | NULLABLE |
| `effective_to` | date | NULLABLE |
| `notes` | text | NULLABLE |

**Unique constraint:** `(crop_id, restaurant_id, day_of_week, effective_from)`.

### `microgreen_batches` — a sow event

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `crop_id` | uuid FK → microgreen_crops | NOT NULL |
| `sow_date` | date | NOT NULL |
| `soak_started_at` | timestamptz | NULLABLE |
| `planned_blackout_end` | date | NULLABLE — computed at sow time |
| `planned_harvest_date` | date | NOT NULL — computed at sow time |
| `tray_count` | int | NOT NULL CHECK > 0 |
| `seed_lot` | text | NULLABLE — free text in v1 |
| `notes` | text | NULLABLE |
| `created_at` | timestamptz | |

### `microgreen_trays` — individual tray rows

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `batch_id` | uuid FK → microgreen_batches | NOT NULL |
| `tray_label` | text | NOT NULL — auto-generated, editable: "BR-0517-01" |
| `status` | enum `microgreen_tray_status` | NOT NULL |
| `sow_date` | date | NOT NULL — denormalized from batch |
| `blackout_start` | date | NULLABLE — auto-set on status transition |
| `light_start` | date | NULLABLE — auto-set on status transition |
| `harvesting_start` | timestamptz | NULLABLE — auto-set on first harvest event |
| `terminated_at` | timestamptz | NULLABLE |
| `lost_reason` | text | NULLABLE — required when status='lost' |
| `location` | text | NULLABLE — e.g., "Rack A, Shelf 2" |
| `notes` | text | NULLABLE |

**Enum `microgreen_tray_status`:** `soaking`, `blackout`, `light`, `harvesting`, `terminated`, `lost`.

**Transitions:**
- `soaking → blackout` (after presoak_hours + presprout_hours elapsed)
- `blackout → light` (after blackout_days elapsed; skipped if `keep_in_blackout=true`)
- `light → harvesting` (on first harvest event)
- `harvesting → terminated` (manual; auto for single-cut crops after first harvest)
- `any → lost` (manual)

### `microgreen_harvests` — harvest event log

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `tray_id` | uuid FK → microgreen_trays | NOT NULL |
| `harvested_at` | timestamptz | NOT NULL default now() |
| `yield_oz` | numeric | NOT NULL CHECK ≥ 0 |
| `unit` | text | default 'oz' |
| `delivery_id` | uuid FK → deliveries | NULLABLE — operator assigns optionally |
| `restaurant_id` | uuid FK → restaurants | NULLABLE — for mid-week harvests not yet on a delivery |
| `notes` | text | NULLABLE |

One tray → many harvest rows. Single-cut crops typically get 1 row + terminated. Continuous-harvest crops (nasturtium, wheatgrass-second-cut, pea-shoot-multi-pull) get N rows over the productive life.

### Indexes

- `microgreen_trays(status, sow_date)` — dashboard "in flight" queries
- `microgreen_batches(sow_date)`, `microgreen_batches(planned_harvest_date)` — calendar queries
- `microgreen_harvests(harvested_at)`, `microgreen_harvests(tray_id)` — log + per-tray history
- `microgreen_demand(crop_id, day_of_week)` — demand lookup

### Seed data

Migration 044 seeds `microgreen_crops` from the variety spreadsheet pasted by the user (~70 rows: amaranth through wheatgrass). Ambiguous range values (e.g., "5-6 D blackout", "8-12 D harvest") use midpoint as the stored value; original strings preserved in `notes`. Suspected drag-fill / typo rows (Basil 5-7, 6-7, 7-7; Shiso 72-96 D) are output to `tmp_microgreen_seed_review.csv` for human review before migration runs.

## Sow Plan Algorithm

### Inputs

1. **Manual demand** rows in `microgreen_demand`, filtered by `effective_from/to` covering today + 21 days.
2. **Forecast demand** — rolling 8-week average of `delivery_items.quantity_oz` for `items.id` matching `microgreen_crops.item_id`, bucketed by day-of-week.
3. **Existing batches** — trays in flight (any status except `terminated`/`lost`) so we don't double-sow.

### Per-day expected demand

For each crop × future delivery_date (within next 21 days):

```
manual_oz   = sum of microgreen_demand.target_oz matching (crop, restaurant, day_of_week)
forecast_oz = 8-week rolling avg of delivery_items.quantity_oz for the same crop + dow
expected_oz = manual_oz   (manual is the floor)
warning     = forecast_oz > manual_oz * 1.25   (surface as yellow banner)
```

If no manual target exists for a crop, forecast is used as a fallback (no warning, just informational).

### Backward schedule

For each (crop × delivery_date) with `expected_oz > 0`:

```
sow_date       = delivery_date − ideal_harvest_day
trays_needed   = ceil(expected_oz / expected_yield_oz_per_tray)
trays_in_flight = count of trays in batches where
                  crop_id = this crop
                  AND planned_harvest_date = delivery_date
                  AND status NOT IN ('terminated', 'lost')
trays_to_sow   = max(0, trays_needed − trays_in_flight)
```

Computed batch fields at sow time:
- `planned_blackout_end = sow_date + blackout_days`
- `planned_harvest_date = sow_date + ideal_harvest_day`

For continuous-harvest crops, `trays_in_flight` includes `harvesting` status trays still within `productive_life_days` of `harvesting_start`.

### Today's tasks (dashboard output)

For `today`, three task buckets:

1. **Sow** — `(crop, delivery_date)` where `sow_date == today` AND `trays_to_sow > 0`. Action: opens a sow modal pre-filled with tray count, creates a `microgreen_batches` row + N `microgreen_trays` rows with status = `soaking` (if presoak/presprout > 0) or `blackout` (if no soak phase).

2. **Advance** — trays where next stage transition is today:
   - `status='soaking'` AND `now() − soak_started_at ≥ presoak_hours + presprout_hours` → `blackout`
   - `status='blackout'` AND `sow_date + blackout_days == today` AND `keep_in_blackout=false` → `light`

3. **Harvest** — trays at `sow_date + ideal_harvest_day == today` AND `crop.is_continuous_harvest=false` (single-cut, ready to fully harvest) OR `status='harvesting'` AND `crop.is_continuous_harvest=true` (continuous, ongoing check). For single-cut, action creates one harvest event per tray and terminates the trays. For continuous, action creates a harvest event without terminating; tray auto-terminates only when operator marks it or `harvesting_start + productive_life_days < today`.

### Edge cases

- **Overdue:** sow/advance/harvest tasks dated in the past appear in a red "Overdue" banner above today's tasks.
- **No matching delivery date:** if demand exists but `delivery_dates` has no row for the target date, skip silently (admin sets delivery dates manually elsewhere).
- **Restaurant-specific + farm-wide:** demand rows with `restaurant_id=null` are added to crop totals (treated as surplus/farm-wide).
- **Lost trays:** decrement `trays_in_flight`, so the next sow-plan run will schedule replacements if there's still time before the delivery date.

### Caching

Sow plan recomputed on demand (cheap — 3 small joins). Cached for 60s in the route handler.

## Pages & UI

All under `/admin/microgreens/`. Uses existing `EditorialHero`, `FloralCorners`, `farm-*` and `pf-*` design tokens. Mobile-first 375px. Touch targets ≥ 44px.

### Routes

```
/admin/microgreens/                       Dashboard (default landing)
/admin/microgreens/crops/                 Variety library list
/admin/microgreens/crops/[id]             Crop detail / editor
/admin/microgreens/demand/                Weekly targets editor
/admin/microgreens/calendar/              Day/week/month view
/admin/microgreens/trays/                 All trays list + filters
/admin/microgreens/trays/[id]             Tray detail + harvest history
/admin/microgreens/batches/[id]           Batch detail
/admin/microgreens/harvests/              Harvest event log
```

### Dashboard `/admin/microgreens` (primary mobile screen)

`EditorialHero` (eyebrow: "Production", title: "Microgreens").

Three task cards (vertical stack):
1. **Sow today** — "Sow 4 trays of Broccoli for Sat May 23." Button: `Mark sown`.
2. **Advance** — "Move 6 sunflower trays blackout → light." Button: `Advance`.
3. **Harvest** — single-cut + continuous-harvest grouped. Buttons: `Log harvest`.

Above: red **Overdue** banner if any tasks were missed.
Right rail / collapsible: **Forecast warnings** (crops where rolling forecast > manual floor × 1.25).

### Crops list & detail

List: card grid with filters (status, medium, continuous). Search by name.

Detail editor sections:
- Identity — name, variety, linked `items.id`
- Seed — density g/tray, presoak hrs, presprout hrs, bury seed
- Growth — blackout days, ideal harvest day, harvest min/max, weight during blackout, keep in blackout
- Medium — growing_medium (chips), preferred_medium
- Yield — expected_yield_oz_per_tray, is_continuous_harvest, productive_life_days (conditional)
- Notes — multi-line

### Demand grid

Rows = crops, columns = (restaurant × day-of-week) tuples. Inline-editable `target_oz`. Below each row: italic rolling-8wk forecast; yellow if >25% above manual floor. Second tab: "Farm-wide" targets (restaurant_id=null).

Mobile fallback: per-crop card form (no horizontal table).

### Calendar

Month/week/day toggle. Color-coded events: sow (blue), blackout (gray), light (yellow), harvest (green), overdue (red). Click → drills to crop/batch/tray. **Dependency check before adding any new calendar lib.**

### Trays list & detail

List: filterable table by status / crop / sow_date. Bulk actions (advance, terminate, mark lost).

Tray detail:
- Header: label, status badge, days-since-sow
- Stage timeline (visual)
- Harvest events table with "Add harvest" button
- Lost reason / location editor
- Link to batch

### Harvest event log

Sortable by date/crop/yield. Useful for reconciling against deliveries.

### Admin nav

New bottom-nav (mobile) + sidebar (desktop) entry: "Micro" with a flower icon. Slotted between `Crop Plan` and `Forecast`.

## Out of Scope (Phase 2)

- **Printable QR tray labels** — `tray_label` already exists; add `/print/[id]` route + QR lib later.
- **Blends/Mixes** — new `microgreen_blends` + `microgreen_blend_components` tables; demand math splits across components.
- **Recurring standing orders** — chef-subscribable; auto-creates `orders` rows. New chef UX.
- **Seed inventory integration** — there is a parallel `seeds` module spec (migration 043) that tracks on-hand seed grams, suppliers, packed-for-year, and sowing audit trail per `items.id`. The two modules are complementary: `seeds` = what's in the drawer, `microgreen_crops` = how to grow it. Future integration: when a microgreen sow event is created, optionally write a corresponding sowing audit row to the `seeds` module to decrement on-hand quantity. v1 of microgreens does not write to `seeds`.
- **Yield/profitability reports** — slot into existing `/admin/reports`.
- **Soak as full-day stage** — if soak ever exceeds 24h regularly, revisit shifting `sow_date`.
- **Lost-tray analytics** — pattern detection / waste reporting.

## Implementation Notes

### Migration

- **Migration 044 — `044_microgreens_module.sql`** — full schema + RLS + indexes + seed data. (043 is taken by the parallel `seeds` inventory spec.)
- Per the project workflow, Micheal runs the migration in the Supabase web SQL editor — no CLI access.
- Ship migration + code together. Page reads will fail with "column does not exist" until migration runs.

### Code structure

```
src/
  app/admin/microgreens/
    page.tsx                          Dashboard
    crops/page.tsx                    Variety list
    crops/[id]/page.tsx               Crop editor
    demand/page.tsx                   Demand grid
    calendar/page.tsx                 Calendar
    trays/page.tsx                    Tray list
    trays/[id]/page.tsx               Tray detail
    batches/[id]/page.tsx             Batch detail
    harvests/page.tsx                 Harvest log
  app/api/microgreens/
    crops/                            CRUD
    demand/                           CRUD
    sow-plan/                         GET — computed plan
    batches/                          POST sow event
    trays/[id]/advance/               POST stage transition
    trays/[id]/terminate/             POST
    harvests/                         POST + GET log
  components/admin/microgreens/
    TaskCard.tsx                      Sow / advance / harvest cards
    StageTimeline.tsx                 Visual stage indicator
    HarvestEventForm.tsx              Harvest log modal
    DemandGrid.tsx                    Inline-edit grid
    CalendarView.tsx                  Calendar component
  lib/microgreens/
    sowPlan.ts                        Backward-schedule algorithm
    stages.ts                         Stage transition helpers
    forecast.ts                       Rolling 8-wk demand
    seed.ts                           Variety library seed data
  types/
    database.ts                       Add Microgreen* types
    index.ts                          App-level enriched types
```

### Testing

- **Unit tests for `sowPlan.ts`** — highest-risk math, full coverage of edge cases (overdue, no matching delivery, restaurant-specific vs farm-wide, continuous-harvest tray accounting).
- **Integration test for tray status transitions** — soak → blackout → light → harvesting → terminated, plus `keep_in_blackout=true` path.
- **Manual checks** — seed dataset loads cleanly, dashboard renders today's tasks, harvest events link to deliveries correctly, mobile dashboard touch targets.

### Risks & gotchas

- **Seed data quality** — ~70 crop rows from the spreadsheet need human review. The migration outputs `tmp_microgreen_seed_review.csv` for ambiguous rows before commit.
- **Sow plan is the most complex piece** — heavily unit-tested.
- **New top-level admin nav** — per CLAUDE.md this needs explicit approval (approved by user during brainstorm).
- **Calendar library** — confirm any new dependency before adding.
- **`(supabase as any)` casts acceptable** where generated types lag (per CLAUDE.md).
- **No chef-side changes** — chef order flow continues to work unchanged.

## Acceptance Criteria

1. New admin nav entry "Micro" appears on bottom-nav and sidebar.
2. `/admin/microgreens` dashboard renders three task cards (sow/advance/harvest) plus overdue banner + forecast warnings.
3. Variety library at `/admin/microgreens/crops` lists seeded crops; can create/edit/deactivate.
4. Demand grid at `/admin/microgreens/demand` lets admin set weekly targets per (crop × restaurant × dow) with forecast sidebar.
5. Clicking "Mark sown" on a sow task creates a batch + N tray rows with correct initial status.
6. Stage advance buttons correctly transition tray status and set the corresponding stage-start date.
7. Harvest event modal creates a `microgreen_harvests` row; single-cut crops auto-terminate their trays.
8. Continuous-harvest crops accept multiple harvest events without terminating.
9. Calendar view renders sow/blackout/light/harvest events color-coded.
10. Sow plan algorithm produces correct task counts for fresh demand and accounts for trays in flight.
11. Chef order flow continues to work unchanged (regression check).
12. No new dependencies added without confirmation.
