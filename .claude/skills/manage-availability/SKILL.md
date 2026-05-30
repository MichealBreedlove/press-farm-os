---
name: manage-availability
description: >
  Add catalog items and change order-form availability for Press Farm — for
  one restaurant, several, or all of them. TRIGGER when Micheal asks to "add
  an item", "add X to the availability list / order form", "make X available",
  "mark X limited / unavailable / sold out", "take X off the menu", "change
  availability for Press / Under-Study / Events / Press Bar", "set a price on
  X", or "use this image for X". Covers the items table, the availability_items
  table, menu-visibility flags, the rollover-anchor trick, and images.
---

# Manage Availability & Items

Fast path for the two things Micheal asks for constantly: **adding items** and
**changing what's available** to which restaurants. Default to doing it live and
instantly via the Supabase MCP; only fall back to a migration file when a new
**image asset** is involved (see [Images](#images)).

## 0. Setup — find the live SQL tool

These changes are pure data, so run them directly against the live DB.

- Supabase project ref: **`rxdfjaseilmjvcwamqyk`**
- The tool: `ToolSearch` → `select:` the Supabase MCP `execute_sql` (and
  `apply_migration` for DDL). The server ID changes per session, so search for
  it each session: `ToolSearch query "supabase execute_sql apply_migration"`.
- `execute_sql` autocommits. There is no undo. For anything that could mark many
  items unavailable, show Micheal the exact SQL (or a count of affected rows)
  and confirm before running.

## 1. The mental model (read once)

There are **two layers**. Both usually need touching.

**Layer A — the catalog item** (`items` table). Defines the thing and, via three
independent boolean flags, **which restaurants' menus it can appear on**:

| Flag | Restaurant(s) it exposes the item to |
|------|--------------------------------------|
| `show_in_regular_menu` | **Press** + **Under-Study** (Regular section) |
| `is_event_item`        | **Events** (also shows in an Events section on Press/Under-Study forms) |
| `is_press_bar_item`    | **Press Bar** |

"Available for **all** restaurants" = all three flags `true`.
The flags are additive — an item can be in any combination of sections.

**Layer B — per-date availability** (`availability_items`, unique on
`(item_id, restaurant_id, delivery_date)`, status `available | limited | unavailable`).
The order form **only shows items that have an availability_items row** for that
restaurant + date (status ≠ `unavailable`, when the form hides unavailable).
Flags alone are not enough — a row must exist.

### The rollover-anchor trick (important)

A delivery date with **no** availability_items rows **inherits** them from the
**latest prior date that has rows** (the order form's rollover). So you do **not**
write a row for every future Thu/Sat/Mon. Write to the **anchor date** — the most
recent date that already has rows — and every later empty date inherits it.

Find the anchor date:

```sql
SELECT max(delivery_date) AS anchor FROM availability_items;
```

Write availability changes to that anchor date. (If Micheal wants a change for one
specific future date that already has its own rows, write to that date instead.)

### Reference data

Restaurants (resolve by slug in SQL so IDs never need hardcoding):
`press`, `understudy`, `events`, `press-bar`.

Pricing/units convention — most flowers use `unit_type = 'lg,sm'` with
`unit_prices = {"lg": <p>, "sm": <p/2>}` and a matching `default_price`.
Look at a sibling before inventing numbers:

```sql
SELECT name, category, unit_type, default_price, unit_prices
FROM items WHERE name ILIKE '%marigold%' AND is_archived = false;
```

Valid `category` values live in `src/lib/constants.ts` (`flowers`,
`micros_leaves`, `herbs_leaves`, `fruit_veg`, `kits`, `family_meal`). Valid units:
`ea, sm, lg, gb, lbs, bu, qt, bx, cs, pt, kit`.

## 2. Recipes (run via `execute_sql`)

Replace the CTE in the WHERE clause / VALUES to match the request. All recipes are
idempotent (safe to re-run).

### A. Add a new item, available to ALL restaurants

```sql
-- Catalog row
INSERT INTO items (
  farm_id, name, category, unit_type, default_price, unit_prices,
  is_event_item, is_press_bar_item, show_in_regular_menu, is_archived
)
SELECT f.id, 'ITEM NAME', 'flowers', 'lg,sm', 12, '{"lg":12,"sm":6}'::jsonb,
       true, true, true, false
FROM farms f WHERE f.name = 'Press Farm'
ON CONFLICT (farm_id, name, category) DO UPDATE SET
  unit_type=EXCLUDED.unit_type, default_price=EXCLUDED.default_price,
  unit_prices=EXCLUDED.unit_prices, is_event_item=EXCLUDED.is_event_item,
  is_press_bar_item=EXCLUDED.is_press_bar_item,
  show_in_regular_menu=EXCLUDED.show_in_regular_menu, is_archived=false,
  updated_at=now();

-- Publish it as available, all restaurants, on the anchor date (rolls forward)
INSERT INTO availability_items (item_id, restaurant_id, delivery_date, status)
SELECT i.id, r.id, (SELECT max(delivery_date) FROM availability_items), 'available'
FROM items i CROSS JOIN restaurants r
WHERE i.name = 'ITEM NAME' AND i.category = 'flowers'
ON CONFLICT (item_id, restaurant_id, delivery_date)
  DO UPDATE SET status='available', updated_at=now();
```

For a NEW image, do the catalog INSERT **with** `image_url` — see [Images](#images).

### B. Make an EXISTING item available — specific restaurant(s)

```sql
INSERT INTO availability_items (item_id, restaurant_id, delivery_date, status)
SELECT i.id, r.id, (SELECT max(delivery_date) FROM availability_items), 'available'
FROM items i CROSS JOIN restaurants r
WHERE i.name = 'ITEM NAME'
  AND r.slug IN ('press','understudy')          -- ← pick restaurants
ON CONFLICT (item_id, restaurant_id, delivery_date)
  DO UPDATE SET status='available', updated_at=now();
```

For ALL restaurants, drop the `r.slug IN (...)` filter.

### C. Mark limited / unavailable (sold out)

```sql
UPDATE availability_items SET status='unavailable', updated_at=now()  -- or 'limited'
WHERE delivery_date = (SELECT max(delivery_date) FROM availability_items)
  AND restaurant_id IN (SELECT id FROM restaurants WHERE slug IN ('press','understudy'))
  AND item_id = (SELECT id FROM items WHERE name='ITEM NAME' AND is_archived=false);
```

`limited` can carry a cap: also set `limited_qty = <n>`.

### D. Change which restaurants' MENUS an item can appear on (flags)

```sql
UPDATE items
SET show_in_regular_menu = true,   -- Press + Under-Study
    is_event_item        = true,   -- Events
    is_press_bar_item    = true,   -- Press Bar
    updated_at = now()
WHERE name = 'ITEM NAME' AND is_archived = false;
```

Turning a flag off removes the item from that section but does **not** delete its
availability rows.

### E. Adjust price

```sql
UPDATE items
SET default_price = 12, unit_prices = '{"lg":12,"sm":6}'::jsonb, updated_at = now()
WHERE name = 'ITEM NAME' AND is_archived = false;
```

Price is financial — confirm the numbers with Micheal before running.

## 3. Images

The agent **cannot** upload to the Supabase `item-photos` storage bucket (no
storage tool / credentials). Two ways to attach a NEW uploaded image:

1. **Repo asset (what the agent can do).** Copy the upload to
   `public/assets/pressfarm/items/<kebab-name>.jpg`, commit it, and set
   `image_url = '/assets/pressfarm/items/<kebab-name>.jpg'` on the item. The order
   form renders it via a plain `<img>`, so a relative path is fine — **but the
   file only exists on prod after this branch is merged to `main` and Vercel
   deploys.** So when a new image is involved, prefer shipping a **migration**
   (commit asset + `NNN_*.sql`) and have Micheal deploy then run it, rather than
   inserting `image_url` live into prod where it would 404 until deploy.
2. **Micheal uploads via `/admin/items/photos`** (real storage URL), then the
   agent just sets `image_url` to that URL live — no deploy needed.

Items with no `image_url` auto-match a brand illustration by name via
`src/lib/flower-images.ts` if the name maps; otherwise they show the wreath
placeholder.

## 4. When to also write a migration

- **Pure availability toggle / price / flag change:** run live via `execute_sql`.
  No migration needed (it's transient operational data).
- **Adding a new item, especially with a new image asset:** commit the asset and
  add a numbered `supabase/migrations/NNN_*.sql` (next number = `ls
  supabase/migrations | tail`) capturing the same INSERTs, so the catalog stays
  reproducible from the repo. With a new repo-asset image, the migration is the
  primary delivery (deploy → Micheal runs it); see Images above.

## 5. Verify

After any change, read it back so the report is grounded:

```sql
SELECT i.name, i.show_in_regular_menu, i.is_event_item, i.is_press_bar_item,
       i.default_price, i.unit_prices,
       a.delivery_date, r.slug AS restaurant, a.status
FROM items i
LEFT JOIN availability_items a ON a.item_id = i.id
  AND a.delivery_date = (SELECT max(delivery_date) FROM availability_items)
LEFT JOIN restaurants r ON r.id = a.restaurant_id
WHERE i.name = 'ITEM NAME'
ORDER BY r.slug;
```

Then tell Micheal: what changed, which restaurants, which date (and that forward
dates inherit via rollover), plus any deploy/migration step still pending.
