-- 085 — DATA FIX: ST planter-box inventory refresh (Micheal's 2026-10-09 walk).
--
-- The ST boxes (ST1–ST9 west fence, manhole gap, ST10–ST22 east fence) still
-- carried the spring plantings. This brings them to what is actually growing:
--
--   ST1  Peruvian mint (unchanged)          ST12 empty
--   ST2  Yellow marigold                    ST13 Orange marigolds
--   ST3  Yellow Bidens (unchanged)          ST14 Orange & red gem marigold
--   ST4  Pink & red Egyptian star flower    ST15 Lemon basil
--   ST5  White & red Egyptian star flower   ST16 Red & orange gem marigold
--   ST6  Pink & red Egyptian star flower    ST17 empty
--   ST7  White & red Egyptian star flower   ST18 Yellow gem marigold
--   ST8  Yellow dahlias                     ST19 Orange currant tomatoes
--   ST9  Bay leaf (unchanged)               ST20 Yellow gem marigold
--   ST10 Kumquat + marigold + purple        ST21 Red currant tomatoes
--        alyssum (unchanged)                ST22 Kumquat
--   ST11 Yellow, white & orange marigolds
--
-- Same crop, wrong label  → RENAME in place (keeps the season's value history).
-- Crop no longer there    → status 'removed', end_date 2026-10-09. Annuals spread
--   value_amount over planted..end_date, so their total is prorated to the days
--   actually grown — realized value to date is unchanged, and the rest of the
--   season stops projecting. Perennials accrue to end_date, so no proration.
-- Old name / value kept in each row's notes. Data-only; re-running is a no-op
-- (renames match the old name, removals match status = 'active').

-- 1. Renames ----------------------------------------------------------------
WITH renames(box, old_name, new_name) AS (
  VALUES
    ('ST2',  'African Marigold',     'Yellow Marigold'),
    ('ST4',  'Egyptian Star Flower', 'Pink & Red Egyptian Star Flower'),
    ('ST5',  'Egyptian Star Flower', 'White & Red Egyptian Star Flower'),
    ('ST6',  'Egyptian Star Flower', 'Pink & Red Egyptian Star Flower'),
    ('ST7',  'Egyptian Star Flower', 'White & Red Egyptian Star Flower'),
    ('ST8',  'Dahlias',              'Yellow Dahlias'),
    ('ST11', 'Marigold',             'Yellow, White & Orange Marigolds'),
    ('ST13', 'Marigolds',            'Orange Marigolds'),
    ('ST14', 'Gem Marigolds',        'Orange & Red Gem Marigold'),
    ('ST15', 'Basil Mixture',        'Lemon Basil'),
    ('ST16', 'Gem Marigold',         'Red & Orange Gem Marigold'),
    ('ST18', 'Gem Marigold',         'Yellow Gem Marigold'),
    ('ST19', 'Tomatoes',             'Orange Currant Tomatoes'),
    ('ST20', 'Gem Marigold',         'Yellow Gem Marigold'),
    ('ST21', 'Currant Tomatoes',     'Red Currant Tomatoes')
)
UPDATE planter_box_plantings p
SET name  = r.new_name,
    notes = concat_ws(E'\n', p.notes,
              'Renamed from "' || r.old_name || '" 2026-10-09 (migration 085).')
FROM renames r
JOIN planter_boxes b ON b.name = r.box
WHERE p.box_id = b.id
  AND p.name = r.old_name
  AND p.status = 'active';

-- 2. Removals ---------------------------------------------------------------
WITH removals(box, planting) AS (
  VALUES
    ('ST2',  'Cucumber'),
    ('ST4',  'Bronze Fennel'),
    ('ST4',  'Cucumber'),
    ('ST4',  'Fennel'),
    ('ST5',  'Orange Bidens'),
    ('ST6',  'Cucumber'),
    ('ST6',  'Mint Hyssop'),
    ('ST7',  'Orange Bidens'),
    ('ST12', 'Pumpkins'),
    ('ST12', 'Tomatoes'),
    ('ST13', 'Pumpkins'),
    ('ST14', 'Cucumber'),
    ('ST15', 'Currant Tomatoes'),
    ('ST15', 'Pumpkins'),
    ('ST16', 'Cucumber'),
    ('ST17', 'Currant Tomatoes'),
    ('ST17', 'Gem Marigold'),
    ('ST18', 'Cucumber'),
    ('ST19', 'Purple Ball Basil'),
    ('ST20', 'Cucumber'),
    ('ST21', 'Greek Basil'),
    ('ST22', 'Marigold'),
    ('ST22', 'Purple Alyssum')
)
UPDATE planter_box_plantings p
SET status       = 'removed',
    end_date     = DATE '2026-10-09',
    value_amount = CASE
      WHEN p.lifecycle = 'annual' AND p.end_date > DATE '2026-10-09'
        THEN round(p.value_amount
                   * ((DATE '2026-10-09' - p.planted_date) + 1)
                   / ((p.end_date - p.planted_date) + 1), 2)
      ELSE p.value_amount
    END,
    notes = concat_ws(E'\n', p.notes,
              'Removed 2026-10-09 (migration 085); was $' || p.value_amount
              || ' through ' || coalesce(p.end_date::text, 'open') || '.')
FROM removals r
JOIN planter_boxes b ON b.name = r.box
WHERE p.box_id = b.id
  AND p.name = r.planting
  AND p.status = 'active';

-- 3. Activity log -------------------------------------------------------------
INSERT INTO planter_box_activity (box_id, logged_at, note)
SELECT b.id, DATE '2026-10-09', 'Inventory refresh (migration 085): ' || v.note
FROM (VALUES
  ('ST2',  'now yellow marigold; cucumber removed'),
  ('ST4',  'now pink & red Egyptian star flower; fennel, bronze fennel, cucumber removed'),
  ('ST5',  'now white & red Egyptian star flower; orange Bidens removed'),
  ('ST6',  'now pink & red Egyptian star flower; cucumber, mint hyssop removed'),
  ('ST7',  'now white & red Egyptian star flower; orange Bidens removed'),
  ('ST8',  'yellow dahlias'),
  ('ST11', 'yellow, white & orange marigolds'),
  ('ST12', 'empty; pumpkins, tomatoes removed'),
  ('ST13', 'now orange marigolds; pumpkins removed'),
  ('ST14', 'now orange & red gem marigold; cucumber removed'),
  ('ST15', 'now lemon basil; currant tomatoes, pumpkins removed'),
  ('ST16', 'now red & orange gem marigold; cucumber removed'),
  ('ST17', 'empty; currant tomatoes, gem marigold removed'),
  ('ST18', 'now yellow gem marigold; cucumber removed'),
  ('ST19', 'now orange currant tomatoes; purple ball basil removed'),
  ('ST20', 'now yellow gem marigold; cucumber removed'),
  ('ST21', 'now red currant tomatoes; Greek basil removed'),
  ('ST22', 'kumquat only; marigold, purple alyssum removed')
) AS v(box, note)
JOIN planter_boxes b ON b.name = v.box
WHERE NOT EXISTS (
  SELECT 1 FROM planter_box_activity a
  WHERE a.box_id = b.id AND a.note LIKE 'Inventory refresh (migration 085)%'
);

-- Rollback: renames — set name back to the quoted old name in notes; removals —
-- status 'active', end_date '2026-11-22', value_amount from the "was $X" note.
