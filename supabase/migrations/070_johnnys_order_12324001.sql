-- Migration 070: Johnny's order #12324001 (2026-06-12) reconciliation
-- Backfills cost/supplier/date and adds the field seeds from Johnny's order
-- #12324001 (23 items, $821.78). The 4 viola/cover-crop lines and 4 microgreen
-- lines (Chervil 5lb, Kalefetti Kale, Borage, Bronze Fennel) are intentionally
-- NOT inserted here -- the violas + cover crop landed in migration 069, and
-- microgreen seeds live in the microgreens module, not `seeds`.
-- Decisions (Micheal, 2026-06-13): field chervil kept separate from the micro;
-- 'Wasabi' row updated to 'Wasabina' (same stock); new 'Shallots' crop created.

DO $$
DECLARE
  v_farm uuid;
BEGIN
  SELECT id INTO v_farm FROM farms ORDER BY created_at LIMIT 1;

  -- New catalog crop for the shallot (unpublished: no availability).
  INSERT INTO items (farm_id, name, category, unit_type, internal_notes)
  VALUES (v_farm, 'Shallots', 'fruit_veg', 'EA', 'Seed inventory only - not yet offered')
  ON CONFLICT (farm_id, name, category) DO NOTHING;

  -- Update existing rough entries with authoritative receipt data.
  UPDATE seeds SET variety='Wasabina', initial_quantity=1, quantity_unit='lb',
    supplier='Johnny''s Selected Seeds', cost=54.90, purchase_date='2026-06-12'
  WHERE variety='Wasabi'
    AND item_id=(SELECT id FROM items WHERE name='Mustard Leaves' AND category='herbs_leaves' AND farm_id=v_farm);

  UPDATE seeds SET initial_quantity=25000, quantity_unit='seeds',
    supplier='Johnny''s Selected Seeds', cost=14.00, purchase_date='2026-06-12'
  WHERE variety='de Cicco'
    AND item_id=(SELECT id FROM items WHERE name='Broccoli' AND category='fruit_veg' AND farm_id=v_farm);

  -- Insert the new field seeds from the order.
  INSERT INTO seeds (farm_id, item_id, variety, initial_quantity, quantity_unit, supplier, cost, purchase_date, status, notes)
  SELECT v_farm, i.id, v.variety, v.qty::numeric, v.unit, 'Johnny''s Selected Seeds', v.cost::numeric, '2026-06-12'::date, 'active', NULL
  FROM (VALUES
    ('Mustard Leaves','herbs_leaves','Amara',1,'lb',39.68),
    ('Mustard Leaves','herbs_leaves','Golden Frills',0.25,'lb',31.80),
    ('Mustard Leaves','herbs_leaves','Red Splendor',0.25,'lb',33.50),
    ('Mustard Leaves','herbs_leaves','Moonshadow',0.25,'lb',18.10),
    ('Broccoli','fruit_veg','Bella Verde',1000,'seeds',29.80),
    ('Cauliflower','fruit_veg','Murasaki Fioretto 70',250,'seeds',42.75),
    ('Cauliflower','fruit_veg','Fioretto 70',250,'seeds',28.50),
    ('Cauliflower','fruit_veg','Romanetto 80',250,'seeds',46.95),
    ('Kale','herbs_leaves','Kalebration Kale Mix',0.25,'lb',35.25),
    ('Violas','flowers','Brush Strokes',1,'packet',4.80),
    ('Violas','flowers','Penny Rose Blotch',250,'seeds',9.75),
    ('Violas','flowers','Penny Marina',250,'seeds',9.75),
    ('Shallots','fruit_veg','Creme Brulee',5000,'seeds',88.40)
  ) AS v(iname, icat, variety, qty, unit, cost)
  JOIN items i ON i.farm_id = v_farm AND i.name = v.iname AND i.category = v.icat
  WHERE NOT EXISTS (
    SELECT 1 FROM seeds s WHERE s.item_id = i.id AND s.variety = v.variety
  );
END $$;
