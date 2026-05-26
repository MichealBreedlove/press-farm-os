# Chef Forecast — Design

**Date:** 2026-05-26
**Status:** Approved, ready for implementation plan

## Goal

A chef-facing page at `/order/forecast` showing what's available from Press Farm across a full year — past, current, and seasonally typical. Read-only. No ordering integration.

## Scope

**Page:** new route `/order/forecast` (server component, chef-auth-only).

**Time range:** data spans ±52 weeks from today. UI navigation spans **current calendar year ± 1** — so if today is May 26 2026, year header lets the chef switch between 2025, 2026, and 2027. Year-edge months show partial data (e.g., 2025 has past actuals only, 2027 has Jan–May seasonal hints only).

**Audience:** authenticated chefs (`restaurant_users`-mapped users). Same auth gate as `/order`.

**Out of scope:**
- Year navigation past current year ± 1
- Yield/quantity estimates per item
- Ordering integration (no "add to order" affordance — calendar is purely informational)
- Push notifications on item entering concrete zone
- Chef-side preferences (category filter, hide-microgreens)
- Admin bulk-edit for `seasonal_months`
- Tasks 4 (individual chef accounts) and 11 (audit trail) — already landed on origin/main via parallel PRs

## Data sources

Three zones, each with its own data source, unioned in the UI layer.

| Zone | Range from today | Source | Granularity |
|---|---|---|---|
| Past | -52w to 0 | `delivery_items` JOIN `deliveries` for chef's restaurant | Per ISO week |
| Concrete | 0 to ~+8w | existing `src/lib/forecasting/` lib (`getCalendarEvents`) | Per ISO week |
| Seasonal | ~+8w to +52w | new `items.seasonal_months` int[] column | Per month |

The concrete-zone upper bound isn't a fixed 8 weeks — it's whatever the forecasting lib can actually return given current plantings + open microgreen batches. The UI treats "no concrete data for this week" as the dividing line and falls back to the seasonal layer.

## Schema change

Migration **059 — `items.seasonal_months`**:

```sql
ALTER TABLE items ADD COLUMN seasonal_months int[] DEFAULT '{}' NOT NULL;
ALTER TABLE items ADD CONSTRAINT seasonal_months_valid
  CHECK (seasonal_months <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]);
```

No RLS change — `items` is already chef-readable.

**One-time seed (in the same migration):** populate `seasonal_months` for each item from the past 12 months of `delivery_items`. For each item, the months where it was delivered ≥2 times become its default. Items with no history get `'{}'` and admin fills them in.

```sql
-- Pseudo: actual SQL during implementation
UPDATE items
SET seasonal_months = (
  SELECT array_agg(DISTINCT extract(month from deliveries.delivery_date)::int)
  FROM delivery_items di JOIN deliveries ON ...
  WHERE di.item_id = items.id
  AND deliveries.delivery_date >= now() - interval '12 months'
  GROUP BY di.item_id HAVING count(*) >= 2
);
```

## Library

New file **`src/lib/forecasting/yearView.ts`** with pure compute functions:

- `historicalWeeks(from: string, to: string, deliveryItems: DeliveryItemRow[]): WeekBucket[]` — buckets past delivery_items by ISO week
- `monthDensity(year: number, sources: {past, concrete, seasonal}): MonthDensity[]` — produces 12-element array for the year, count + zone label per month
- `monthSeasonalItems(month: 1..12, items: SeasonalItemRow[]): GroupedItems` — filters items where `seasonal_months` contains the month, groups by category

Extensions to **`src/lib/forecasting/fetch.ts`**:

- `fetchHistoricalDeliveries(from: string, to: string, restaurantId: string)` — uses admin client, scopes to restaurant
- `fetchSeasonalItems()` — pulls all items with non-empty `seasonal_months`

Existing exports from `src/lib/forecasting/` (`getCalendarEvents`, `availabilityBuckets`, etc.) are unchanged.

## UI

### Page anatomy (top to bottom)

```
EditorialHero                "Press Farm Forecast" / subtitle
Year header                  "2026" + ← prev / next →
Month tabs                   Jan Feb Mar Apr [May] Jun Jul ... (horiz scroll)
Week strip (conditional)     Visible only when selected month is past/concrete
Detail drawer                Zone-specific content
```

### Month tab visual states

| State | Background | Dots |
|---|---|---|
| Current month | farm-green fill, white text | yes |
| Past month | cream, gold text | yes (= actuals count) |
| Concrete future month | cream, farm-green text | yes (= concrete count) |
| Seasonal future month | faded cream, italic | smaller dots (= seasonal count) |
| Empty month | gray, no text emphasis | none |

Density: distinct-item count for the month, deduplicated across the three zones (an item that's both concrete-forecast and seasonal-typical counts once). Buckets: `≤2 = quiet · 3-4 = normal · 5+ = peak`.

### Week strip (conditional)

Shown only when the selected month falls in the past or concrete zone. 4-5 cards horizontal scroll. Each card: week-start date (e.g., "Jun 9"), week label ("Wk 2"), density indicator. Selected week is gold-bordered.

For seasonal-zone months, the week strip is hidden and the detail drawer shows month-level content directly.

### Detail drawer

Three content shapes by zone:

**Past week:**
- Heading: "Delivered week of May 19"
- Single ungrouped list of `delivery_items` for chef's restaurant
- Row: name, "5 lb", or "3 LG + 2 SM" depending on unit_type

**Concrete week:**
- Heading: "Harvesting week of Jun 9"
- Two subsections: "Field crops" and "Microgreens"
- Field crop row: name, "opens Jun 9 – Jun 13", category badge
- Microgreen row: name, "harvest Jun 11", tray count (always shown for microgreens; informational, not orderable)

**Seasonal month (no week selected):**
- Heading: "Typically available in August"
- Grouped by category (Flowers / Greens / Roots / etc)
- Row: name + small "typical" badge (gold border, uppercase 9px)
- No window dates

### Empty states

- Chef's restaurant has zero past deliveries → past months grayed, caption "No delivery history yet"
- A month has zero data in any zone → "No items planned or typical for [Month] — check back later"

### Mobile-first

- Month tabs scroll horizontally; current month auto-scrolled into view on mount
- Week strip max 5 cards × ~60px each, fits 320px viewports with side padding
- Detail drawer is full-width below — no side-by-side
- Tap targets ≥44px

### Brand

All colors/typography from `src/emails/_shared.ts` (farm-green `#5a8033`, gold `#c9a14a`, cream `#fff8ec`, Bank Gothic wordmark in hero). Same visual language as the availability-forecast email so the calendar reads as the same product.

## Admin entry for `seasonal_months`

Single addition to `/admin/items` editor: a row of 12 month chips (Jan…Dec) on each item edit form. Tap toggles inclusion. Saves to `items.seasonal_months`. No new admin page, no peak-month or shoulder-season nuance in v1.

## Testing

### Pure compute (Vitest)

- `historicalWeeks` — correct ISO-week bucketing, restaurant filter, empty input
- `monthDensity` — counts unioned across zones, no double-counting when item appears in both concrete and seasonal
- `monthSeasonalItems` — month filter, category grouping, sort stability

### Page smoke (Vitest + RSC test helpers)

- Unauthenticated → redirects to `/login`
- Authenticated chef without `restaurant_users` mapping → graceful "No restaurant" message (pattern reused from `/order/page.tsx`)
- Authenticated chef with restaurant → renders month tabs for current year, current month auto-selected

No Playwright. If the page proves flaky in production, browser tests can be added then.

## Component file map

New files:

- `src/app/order/forecast/page.tsx` — server component, auth + data fetch
- `src/app/order/forecast/ForecastClient.tsx` — client component, holds selected month/week state
- `src/components/order/forecast/YearMonthTabs.tsx` — horizontal tab strip
- `src/components/order/forecast/WeekStrip.tsx` — horizontal week strip
- `src/components/order/forecast/DetailDrawer.tsx` — zone-aware drawer (renders one of three children below)
- `src/components/order/forecast/PastWeekDetail.tsx`
- `src/components/order/forecast/ConcreteWeekDetail.tsx`
- `src/components/order/forecast/SeasonalMonthDetail.tsx`
- `src/lib/forecasting/yearView.ts` — pure compute
- `tests/lib/forecasting/yearView.test.ts`
- `tests/app/order/forecast/page.test.tsx`
- `supabase/migrations/059_items_seasonal_months.sql`

Modified files:

- `src/lib/forecasting/fetch.ts` — add `fetchHistoricalDeliveries`, `fetchSeasonalItems`
- `src/lib/forecasting/index.ts` — export new lib surface
- `src/lib/forecasting/types.ts` — add new row types (`HistoricalDeliveryRow`, `SeasonalItemRow`, `WeekBucket`, `MonthDensity`)
- `src/app/admin/items/<editor file>` — add 12-chip month selector
- `src/types/database.ts` — extend `items` type with `seasonal_months`

## Open implementation questions

These get resolved during writing-plans, not here:

- Exact name of the admin items editor file (need to grep)
- Whether `WeekBucket` should reuse `ForecastCalendarEvent` or be its own type
- ISO-week math: reuse `dates.ts` helpers or import a tiny date library
