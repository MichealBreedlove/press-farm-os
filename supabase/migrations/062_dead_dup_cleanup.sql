-- ============================================
-- Press Farm OS — Migration 062: delete dead duplicate item stubs
--
-- Per Micheal 2026-05-31 (catalog-review "Bucket 1"). Removes ~26 stale
-- duplicate item rows — mostly lowercase casing leftovers (e.g. "alyssum"
-- vs "Alyssum") — that carry ZERO references anywhere: no deliveries,
-- availability, orders, plantings, seeds, microgreen crops, event requests,
-- price history, price catalog, and no child items. The Title-Case twin
-- holds all the real history.
--
-- Because every stub is reference-free, there is nothing to fold — they are
-- deleted outright. Deletion is driven by a self-evaluating predicate
-- (computed in the DB), not a hardcoded ID list, and each NOT EXISTS guard
-- means a row is removed ONLY if it is truly unreferenced. If any stub
-- unexpectedly had a reference, the predicate would simply skip it (and any
-- missed FK would raise rather than lose data).
--
-- Restricted to rows whose lower(name) is shared by another item, so a
-- unique item can never be deleted even if briefly unused.
-- ============================================

BEGIN;

DELETE FROM items i
WHERE
  -- has a case-insensitive twin (a canonical survivor exists)
  EXISTS (
    SELECT 1 FROM items j
    WHERE lower(j.name) = lower(i.name) AND j.id <> i.id
  )
  -- and is referenced by nothing
  AND NOT EXISTS (SELECT 1 FROM delivery_items   d WHERE d.item_id = i.id)
  AND NOT EXISTS (SELECT 1 FROM availability_items a WHERE a.item_id = i.id)
  AND NOT EXISTS (SELECT 1 FROM price_history     ph WHERE ph.item_id = i.id)
  AND NOT EXISTS (SELECT 1 FROM price_catalog     pc WHERE pc.item_id = i.id)
  AND NOT EXISTS (SELECT 1 FROM plantings         p WHERE p.item_id = i.id)
  AND NOT EXISTS (SELECT 1 FROM seeds             s WHERE s.item_id = i.id)
  AND NOT EXISTS (SELECT 1 FROM microgreen_crops  m WHERE m.item_id = i.id)
  AND NOT EXISTS (SELECT 1 FROM event_requests    e WHERE e.item_id = i.id)
  AND NOT EXISTS (SELECT 1 FROM items             c WHERE c.parent_item_id = i.id);

COMMIT;
