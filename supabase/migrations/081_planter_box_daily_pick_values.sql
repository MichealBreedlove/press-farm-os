-- 081 — DATA FIX: re-rate planter-box production values for daily chef picking
--
-- The 2026-09-26 estimates assumed one pick a week (or every other week)
-- and then applied a flat ×2.5. Per Micheal (2026-09-28): chefs pick most
-- days — a SM to-go of this and that, not every item every day; only basil
-- and currant tomatoes go at a LG rate. New model, same season windows:
--   * 4 picks/week, SM each (LG for basil + currant tomatoes)
--   * ×2.5 dropped (the cadence now carries the difference)
-- Untouched (not pick-frequency based): grapes, pumpkins, the lb/wk
-- tomatoes and the Star Flower + Bidens $200/wk combined figure.
--
-- Per planting: new = old × (4 / old_picks_per_wk) × size_factor / 2.5
--   old_picks_per_wk: 0.5 for "every other wk", else 1
--   size_factor: 2 basil/currant (SM→LG) and "½ SM" rows (→ full SM),
--                0.5 Bay Leaf (LG→SM), else 1
-- Idempotent: only rows whose notes still start 'Est. 2026-09-26' change.
-- The old value is kept in the note: rollback =
--   UPDATE planter_box_plantings SET value_amount = substring(notes from 'was \$([0-9.]+)')::numeric,
--     notes = substring(notes from 'Prev: (.*)$') WHERE notes LIKE 'Est. 2026-09-28%';

WITH f AS (
  SELECT id, value_amount AS old_v, notes AS old_notes,
    (CASE WHEN notes ILIKE '%every other wk%' THEN 8 ELSE 4 END)
    * (CASE WHEN name ILIKE '%basil%' OR name ILIKE 'currant%' THEN 2
            WHEN notes ILIKE 'Est.%½ SM%' THEN 2
            WHEN name = 'Bay Leaf' THEN 0.5
            ELSE 1 END)
    / 2.5 AS factor,
    CASE WHEN name ILIKE '%basil%' OR name ILIKE 'currant%' THEN 'LG' ELSE 'SM' END AS pick
  FROM planter_box_plantings
  WHERE notes LIKE 'Est. 2026-09-26%'
    AND notes NOT ILIKE '%pumpkin%'
    AND notes NOT ILIKE '%lb/wk%'
    AND notes NOT ILIKE '%$200/wk combined%'
)
UPDATE planter_box_plantings p
SET value_amount = round(f.old_v * f.factor, 2),
    notes = 'Est. 2026-09-28: chefs pick ~4 days/wk, ' || f.pick || ' each, no ×2.5 per Micheal (was $'
            || f.old_v::text || '). Prev: ' || f.old_notes
FROM f
WHERE p.id = f.id;
