-- Migration 091: Radish + Turnip sow → Quadrant 1 (radish rows 4-5, turnip rows 6-7)
--
-- DATA FIX (Micheal 2026-10-11): "Radish turnip and tiny carrots will now go
-- into quadrant 1 rows 4-9" — radish 4-5, turnip 6-7, carrot 8-9. They were
-- in Quadrant 2 (radish rows 2-3, turnip row 4). Only the "Where" changes;
-- cadence (14d) and method (direct seed every 1/2 inch) from 088 stay.
-- Rewrites the recurring notes (future generated tasks) and the open tasks
-- already on the list. Safe to re-run.
--
-- NOT included: the tiny French carrot task (Quadrant 1 rows 8-9). Its
-- update was cancelled at apply time three times and is still pending
-- Micheal's call on the carrot method/cadence.

UPDATE items SET
  recurring_sow_notes = 'Where: Quadrant 1, rows 4-5. How: Direct seed one seed every 1/2 inch (no broadcasting). How much: 5 feet of row. ES: Sembrar los rabanos en el cuadrante 1, hileras 4-5, directo, una semilla cada media pulgada (no al voleo).',
  updated_at = now()
WHERE id = 'eedb9e62-5ad6-4044-88cf-1e11b3f6bdca';  -- Radish

UPDATE items SET
  recurring_sow_notes = 'Where: Quadrant 1, rows 6-7. How: Direct seed one seed every 1/2 inch (no broadcasting). How much: 5 feet of row. ES: Sembrar los nabos en el cuadrante 1, hileras 6-7, directo, una semilla cada media pulgada (no al voleo).',
  updated_at = now()
WHERE id = 'b9e401a4-b7c7-4dc6-886c-d4eb483fb90f';  -- Turnip

UPDATE farm_tasks t SET
  description = i.recurring_sow_notes
FROM items i
WHERE i.id = t.item_id
  AND t.source = 'recurring-item'
  AND t.status IN ('open', 'snoozed')
  AND t.item_id IN ('eedb9e62-5ad6-4044-88cf-1e11b3f6bdca', 'b9e401a4-b7c7-4dc6-886c-d4eb483fb90f');
