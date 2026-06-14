-- Migration 071: Johnny's order #12324001 (2026-06-12) -- microgreen seed lines
-- The microgreens module (microgreen_crops/batches/trays/harvests) is a
-- grow-recipe library with no cost/quantity/supplier columns, so the 4 micro
-- seed lines from this order are recorded in `seeds` (the only table that tracks
-- purchase cost) linked to their micros_leaves items, tagged in notes.
-- This completes migration 070's reconciliation: 070 booked the 19 field lines
-- ($542.93); these 4 micro lines ($278.85) bring the order to its $821.78 total.
-- Decision (Micheal, 2026-06-14): all four are micro/dual-purpose; Chervil 5lb
-- is the micro chervil; Kalefetti is a microgreen kale.

DO $$
DECLARE v_farm uuid;
BEGIN
  SELECT id INTO v_farm FROM farms ORDER BY created_at LIMIT 1;

  -- micro-kale item mirroring the existing 'Kale' microgreen crop
  -- (Ornamental Kale is a different plant, so Kalefetti needs its own item).
  INSERT INTO items (farm_id, name, category, unit_type, internal_notes)
  VALUES (v_farm, 'Kale', 'micros_leaves', 'EA', 'Microgreen kale - seed inventory')
  ON CONFLICT (farm_id, name, category) DO NOTHING;

  INSERT INTO seeds (farm_id, item_id, variety, initial_quantity, quantity_unit, supplier, cost, purchase_date, status, notes)
  SELECT v_farm, i.id, v.variety, v.qty::numeric, 'lb', 'Johnny''s Selected Seeds', v.cost::numeric, '2026-06-12'::date, 'active',
         'Microgreen seed (Johnny''s order #12324001)'
  FROM (VALUES
    ('Chervil','micros_leaves','Chervil',5,73.00),
    ('Kale','micros_leaves','Kalefetti Kale Mix',1,89.30),
    ('Borage','micros_leaves','Borage',1,49.60),
    ('Fennel','micros_leaves','Bronze',0.25,66.95)
  ) AS v(iname, icat, variety, qty, cost)
  JOIN items i ON i.farm_id=v_farm AND i.name=v.iname AND i.category=v.icat
  WHERE NOT EXISTS (
    SELECT 1 FROM seeds s WHERE s.item_id=i.id AND s.variety=v.variety
      AND s.supplier='Johnny''s Selected Seeds' AND s.purchase_date='2026-06-12'
  );
END $$;
