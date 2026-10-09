-- 086 — DATA FIX: follow-up corrections to 085 (ST planter boxes, 2026-10-09).
--
-- ST19 Orange Currant Tomatoes valued like the other currant
-- tomato boxes ($1,800 season, LG pick ~4 days/wk — see 081). Migration 085
-- relabeled it from "Tomatoes" but kept the $900 lb/wk figure; Micheal
-- confirmed 2026-10-09 it should match. Rollback: set value_amount = 900.
UPDATE planter_box_plantings p
SET value_amount = 1800.00,
    notes = concat_ws(E'\n', p.notes,
              'Re-valued $900 → $1,800 2026-10-09 to match other currant tomatoes (migration 086).')
FROM planter_boxes b
WHERE p.box_id = b.id
  AND b.name = 'ST19'
  AND p.name = 'Orange Currant Tomatoes'
  AND p.status = 'active'
  AND p.value_amount <> 1800.00;

-- Also (Micheal, 2026-10-09): 085 removed two plantings that are still there,
-- in the back of their boxes. Restore them — both are perennials, so 085 left
-- value_amount untouched; only status / end_date go back to the 09-28 values.
WITH restores(box, old_name, new_name) AS (
  VALUES
    ('ST4', 'Bronze Fennel', 'Bronze Fennel'),
    ('ST6', 'Mint Hyssop',   'Hummingbird Mint Hyssop')
)
UPDATE planter_box_plantings p
SET status   = 'active',
    end_date = DATE '2026-11-22',
    name     = r.new_name,
    notes    = concat_ws(E'\n', p.notes,
                 'Restored 2026-10-09 (migration 086) — still growing in the back of the box.')
FROM restores r
JOIN planter_boxes b ON b.name = r.box
WHERE p.box_id = b.id
  AND p.name = r.old_name
  AND p.status = 'removed'
  AND p.end_date = DATE '2026-10-09';

INSERT INTO planter_box_activity (box_id, logged_at, note)
SELECT b.id, DATE '2026-10-09', 'Correction (migration 086): ' || v.note
FROM (VALUES
  ('ST4', 'bronze fennel still in the back — restored'),
  ('ST6', 'hummingbird mint hyssop still in the back — restored')
) AS v(box, note)
JOIN planter_boxes b ON b.name = v.box
WHERE NOT EXISTS (
  SELECT 1 FROM planter_box_activity a
  WHERE a.box_id = b.id AND a.note LIKE 'Correction (migration 086)%'
);
