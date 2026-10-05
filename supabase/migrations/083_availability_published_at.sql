-- 083 — availability_items.published_at
--
-- Distinguishes rows the admin actually PUBLISHED (Save in the availability
-- editor) from rows written automatically ahead of time:
--   * materializeRollover — a chef opening the order form for a future date
--     writes that date's rows from the most recent prior date
--   * "Copy last cycle" — snapshots the most recent prior date
--
-- Before this column the two were indistinguishable, so a future date that
-- got materialized early became a frozen snapshot: later edits to earlier
-- dates never reached it, and rollover / copy-last-cycle kept picking that
-- stale snapshot as their source. (2026-10-05: every date from 10/05 on was
-- carrying a late-September snapshot — Under-Study showed 24 available when
-- the latest publish had 13.)
--
-- NULL = carried over / auto-written. Set by POST /api/availability.
-- Publishing a date now also re-syncs every LATER date that is still only
-- carried over (up to the next published date), and rollover sources prefer
-- published dates.

ALTER TABLE public.availability_items
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- Backfill: past (restaurant, date) sets that look like real editor saves —
-- the editor always writes the full catalog (~295 rows), while
-- materializations are sparse (orderable rows only). Future dates are left
-- NULL: none of them have been saved from the editor.
UPDATE public.availability_items ai
SET published_at = ai.updated_at
FROM (
  SELECT restaurant_id, delivery_date
  FROM public.availability_items
  WHERE delivery_date < DATE '2026-10-05'
  GROUP BY restaurant_id, delivery_date
  HAVING count(*) >= 100
) full_sets
WHERE ai.restaurant_id = full_sets.restaurant_id
  AND ai.delivery_date = full_sets.delivery_date
  AND ai.published_at IS NULL;

-- Rollback:
--   ALTER TABLE public.availability_items DROP COLUMN published_at;
