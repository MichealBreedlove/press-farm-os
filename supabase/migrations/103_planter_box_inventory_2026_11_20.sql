-- 103 — DATA FIX: planter-box inventory refresh (Micheal's 2026-11-20 list).
--
-- The planter records had not been touched since the 10/25 clear-out, so the
-- order sheet's "In the Planter Beds" card was still showing October: summer
-- tomatoes and lemon basil that are gone, and none of the fall flowers or the
-- tank roots. This brings them to what Micheal dictated on 2026-11-20:
--
--   ST1  Peruvian mint (unchanged)          ST12 Radish (new)
--   ST2  Chamomile (new)                    ST13 Violas (marigolds out)
--   ST3  Yellow Bidens (unchanged)          ST14 Marigold (new)
--   ST4–7 Egyptian star flower (unchanged)  ST15 empty (lemon basil out)
--   ST8  Yellow dahlias (unchanged)         ST16 Marigold (unchanged)
--   ST9  Bay leaf (unchanged)               ST17 Turnip (new)
--   ST10 Kumquat (unchanged)                ST18 Marigold (new)
--   ST11 Fava (marigolds out)               ST19 Flowering kale (tomatoes out)
--   ST20 Marigold (new)                     ST21 Tiny carrots (tomatoes out)
--   ST22 Kumquat (unchanged)
--
--   U5–U6 Viola (new)      U12 U14 U16 U18 Calendula (new)
--   U15 Dianthus (Verbena bonariensis out)   U20 Chrysanthemum (new)
--   U21 Violet (alyssum out)                 U22 empty (tomatoes out)
--   U1–U4, U7–U11, U13, U17, U19, U23 and G1–G4 unchanged.
--
-- Removals follow 085/092: status 'removed', end_date 2026-11-20, annual totals
-- prorated to the days grown, old value kept in notes.
-- New plantings: value $0 until real values are entered. planted_date is the
-- day they were recorded (2026-11-20), not the day they went in, and the
-- annuals' end_date 2027-03-31 is a placeholder — neither was given.
-- U5/U6 as the viola boxes is inferred from the walking order, not confirmed.
-- Data-only; re-running is a no-op.

-- 1. Removals ---------------------------------------------------------------
WITH removals(box, planting) AS (
  VALUES
    ('ST11', 'Yellow, White & Orange Marigolds'),
    ('ST13', 'Orange Marigolds'),
    ('ST15', 'Lemon Basil'),
    ('ST19', 'Orange Currant Tomatoes'),
    ('ST21', 'Red Currant Tomatoes'),
    ('U15',  'Verbena bonariensis'),
    ('U21',  'Alyssum'),
    ('U22',  'Tomatoes')
)
UPDATE planter_box_plantings p
SET status       = 'removed',
    end_date     = DATE '2026-11-20',
    value_amount = CASE
      WHEN p.lifecycle = 'annual' AND p.end_date > DATE '2026-11-20'
        THEN round(p.value_amount
                   * ((DATE '2026-11-20' - p.planted_date) + 1)
                   / ((p.end_date - p.planted_date) + 1), 2)
      ELSE p.value_amount
    END,
    notes = concat_ws(E'\n', p.notes,
              'Removed, recorded 2026-11-20 (migration 103); was $' || p.value_amount
              || ' through ' || coalesce(p.end_date::text, 'open') || '.')
FROM removals r
JOIN planter_boxes b ON b.name = r.box
WHERE p.box_id = b.id
  AND p.name = r.planting
  AND p.status = 'active';

-- 2. New plantings ------------------------------------------------------------
WITH adds(box, planting, lifecycle) AS (
  VALUES
    ('ST2',  'Chamomile',      'annual'),
    ('ST11', 'Fava',           'annual'),
    ('ST12', 'Radish',         'annual'),
    ('ST13', 'Violas',         'annual'),
    ('ST14', 'Marigold',       'annual'),
    ('ST17', 'Turnip',         'annual'),
    ('ST18', 'Marigold',       'annual'),
    ('ST19', 'Flowering Kale', 'annual'),
    ('ST20', 'Marigold',       'annual'),
    ('ST21', 'Tiny Carrots',   'annual'),
    ('U5',   'Viola',          'annual'),
    ('U6',   'Viola',          'annual'),
    ('U12',  'Calendula',      'annual'),
    ('U14',  'Calendula',      'annual'),
    ('U15',  'Dianthus',       'perennial_evergreen'),
    ('U16',  'Calendula',      'annual'),
    ('U18',  'Calendula',      'annual'),
    ('U20',  'Chrysanthemum',  'annual'),
    ('U21',  'Violet',         'annual')
)
INSERT INTO planter_box_plantings
  (box_id, name, lifecycle, planted_date, end_date, value_amount, value_basis, status, notes)
SELECT b.id,
       a.planting,
       a.lifecycle::planting_lifecycle,
       DATE '2026-11-20',
       CASE WHEN a.lifecycle = 'annual' THEN DATE '2027-03-31' END,
       0,
       CASE WHEN a.lifecycle = 'annual' THEN 'total' ELSE 'monthly' END,
       'active',
       'Added from Micheal''s 2026-11-20 list (migration 103). Value TBD; planted date = date recorded'
         || CASE WHEN a.lifecycle = 'annual' THEN '; end date 2027-03-31 is a placeholder.' ELSE '.' END
         || CASE WHEN a.box IN ('U5', 'U6') THEN ' Box placement inferred from walking order — confirm.' ELSE '' END
FROM adds a
JOIN planter_boxes b ON b.name = a.box
WHERE NOT EXISTS (
  SELECT 1 FROM planter_box_plantings p
  WHERE p.box_id = b.id AND p.name = a.planting AND p.status = 'active'
);

-- 3. Activity log -------------------------------------------------------------
INSERT INTO planter_box_activity (box_id, logged_at, note)
SELECT b.id, DATE '2026-11-20', 'Inventory refresh (migration 103): ' || v.note
FROM (VALUES
  ('ST2',  'now chamomile'),
  ('ST11', 'now fava; marigolds removed'),
  ('ST12', 'now radish'),
  ('ST13', 'now violas; orange marigolds removed'),
  ('ST14', 'now marigold'),
  ('ST15', 'empty; lemon basil removed'),
  ('ST17', 'now turnip'),
  ('ST18', 'now marigold'),
  ('ST19', 'now flowering kale; orange currant tomatoes removed'),
  ('ST20', 'now marigold'),
  ('ST21', 'now tiny carrots; red currant tomatoes removed'),
  ('U5',   'now viola (placement inferred, confirm)'),
  ('U6',   'now viola (placement inferred, confirm)'),
  ('U12',  'now calendula'),
  ('U14',  'now calendula'),
  ('U15',  'now dianthus; Verbena bonariensis removed'),
  ('U16',  'now calendula'),
  ('U18',  'now calendula'),
  ('U20',  'now chrysanthemum'),
  ('U21',  'now violet; alyssum removed'),
  ('U22',  'empty; tomatoes removed')
) AS v(box, note)
JOIN planter_boxes b ON b.name = v.box
WHERE NOT EXISTS (
  SELECT 1 FROM planter_box_activity a
  WHERE a.box_id = b.id AND a.note LIKE 'Inventory refresh (migration 103)%'
);

-- Rollback: delete the rows whose notes start 'Added from Micheal''s 2026-11-20
-- list (migration 103)'; removals — status 'active', end_date '2026-11-22',
-- value_amount from the "was $X" note.
