-- 082 — DATA FIX: companion to 081 — re-rate the remaining planter-box plantings
-- to the same daily-chef-pick model (~4 picks/wk, a SM each, no ×2.5), per
-- Micheal 2026-09-28. Catalog SM prices, same producing windows as before:
--   Egyptian Star Flower / Orange + Yellow Bidens (7): SM $12 (Egyptian
--     Starflower) × 4/wk × May 1–Nov 22 (29.43 wk) = $1,412.57 each
--     (was $840.82 = $200/wk combined ÷ 7)
--   Tomatoes (3): SM $12.50 × 4/wk × mid-Jul–Nov (18 wk) = $900 (was $675)
--   Pumpkins (3): ~3 fruit × 10 lb × $4 = $120 + tendrils/tips SM $7.50
--     × 4/wk × 18 wk = $540 → $660 (was $375)
-- Table grapes are left alone: they're bulk-harvested fruit valued from a
-- season total, and a pick-rate model would LOWER them.
-- Idempotent (only rows still carrying the 9/26 note change). Old value is
-- kept in the note; rollback is the same statement as in 081.

UPDATE planter_box_plantings
SET notes = 'Est. 2026-09-28: chefs pick ~4 days/wk, '
            || CASE WHEN notes ILIKE '%pumpkin%' THEN 'tendrils/tips SM each + ~3 fruit'
                    ELSE 'SM each' END
            || ', no ×2.5 per Micheal (was $' || value_amount::text || '). Prev: ' || notes,
    value_amount = CASE
      WHEN notes ILIKE '%$200/wk combined%' THEN 1412.57
      WHEN notes ILIKE '%lb/wk%'            THEN 900
      WHEN notes ILIKE '%pumpkin%'          THEN 660
    END
WHERE notes LIKE 'Est. 2026-09-26%'
  AND (notes ILIKE '%$200/wk combined%' OR notes ILIKE '%lb/wk%' OR notes ILIKE '%pumpkin%');
