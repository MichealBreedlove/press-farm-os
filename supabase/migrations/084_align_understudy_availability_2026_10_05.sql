-- 084 — DATA FIX: Under-Study availability for 2026-10-05 onward
--
-- Every Under-Study date from 10/05 on was a frozen snapshot from late
-- September (materialized by a chef page view / Copy last cycle before the
-- admin's later publishes — see 083), so the list showed 23–24 available
-- while Press / Events / Press Bar carried the intended 13. The same 10
-- items differed on every date: Basil, Fennel, Fennel Flowers, Gem
-- Marigold, Gem Marigold Leaf, Genovese Basil, Lemon Verbena, Patty Pan
-- Squash, Tomatoes, Tulsi Basil — all "available" for Under-Study, all
-- limited/unavailable (or absent) for Press.
--
-- Sets each Under-Study row on those dates to Press's status + limited_qty
-- for the same item/date ('unavailable' where Press has no row).
--
-- Rollback: set status = 'available', limited_qty = NULL for those 10 items
-- on Under-Study 2026-10-05 / 10-08 / 10-10 / 10-17.

UPDATE public.availability_items us
SET status      = COALESCE(p.status, 'unavailable'),
    limited_qty = p.limited_qty,
    updated_at  = now()
FROM public.availability_items us2
LEFT JOIN public.availability_items p
  ON p.item_id = us2.item_id
 AND p.delivery_date = us2.delivery_date
 AND p.restaurant_id = (SELECT id FROM public.restaurants WHERE name = 'Press')
WHERE us.id = us2.id
  AND us.restaurant_id = (SELECT id FROM public.restaurants WHERE name = 'Under-Study')
  AND us.delivery_date >= DATE '2026-10-05'
  AND us.status IS DISTINCT FROM COALESCE(p.status, 'unavailable');
