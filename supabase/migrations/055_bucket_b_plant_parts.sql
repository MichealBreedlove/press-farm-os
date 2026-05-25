-- ============================================
-- Press Farm OS — Migration 055: Bucket B plant-part splits
--
-- Per Micheal 2026-05-24. Adds part-items that his master price key lists
-- (proven sales) but the catalog lacked. All additive — each is created as
-- a child of its existing parent. Prices straight from the key (SM = ½ LG
-- where the key only listed one size).
--
--   Broccoli   → Broccoli Flowers ($15), Broccoli Rabe ($20), Broccoli Sprouting ($20)
--   Mustard    → Mustard Flowers ($20)      [additive; existing Mustard untouched]
--   Anise Hyssop → Anise Hyssop Flowers ($15)
--   Carrots    → Carrot Flowers ($10)
--   Yarrow     → Yarrow Leaf ($15)
--   Fava       → Fava Tips ($24)
--   Beans      → Bean Flowers ($15 SM), Bean Leaf ($12 LG)
--   Amaranth   → Amaranth Flowers ($15)
-- ============================================

BEGIN;

INSERT INTO items (farm_id, name, category, unit_type, unit_prices, default_price, parent_item_id) VALUES
  ('5f7e9d0f-e91b-4a78-92f9-37505fa5aa3d','Broccoli Flowers','flowers','lg,sm','{"lg":15,"sm":7.5}'::jsonb,15.00,'774ad63d-597d-4a01-985c-e5021588089f'),
  ('5f7e9d0f-e91b-4a78-92f9-37505fa5aa3d','Broccoli Rabe','herbs_leaves','lg,sm','{"lg":20,"sm":10}'::jsonb,20.00,'774ad63d-597d-4a01-985c-e5021588089f'),
  ('5f7e9d0f-e91b-4a78-92f9-37505fa5aa3d','Broccoli Sprouting','fruit_veg','lg,sm','{"lg":20,"sm":10}'::jsonb,20.00,'774ad63d-597d-4a01-985c-e5021588089f'),
  ('5f7e9d0f-e91b-4a78-92f9-37505fa5aa3d','Mustard Flowers','flowers','lg,sm','{"lg":20,"sm":10}'::jsonb,20.00,'6bbd72d4-4557-4fb8-9fcf-ec053cd4e2a2'),
  ('5f7e9d0f-e91b-4a78-92f9-37505fa5aa3d','Anise Hyssop Flowers','flowers','lg,sm','{"lg":15,"sm":7.5}'::jsonb,15.00,'b2ea2797-7554-453a-ac34-3707670caf08'),
  ('5f7e9d0f-e91b-4a78-92f9-37505fa5aa3d','Carrot Flowers','flowers','lg,sm','{"lg":10,"sm":5}'::jsonb,10.00,'4d2c4de4-0ca2-4e06-af78-4b8a80b11cc2'),
  ('5f7e9d0f-e91b-4a78-92f9-37505fa5aa3d','Yarrow Leaf','herbs_leaves','lg,sm','{"lg":15,"sm":7.5}'::jsonb,15.00,'9af3aab8-9d54-4717-a748-766b3dd169e7'),
  ('5f7e9d0f-e91b-4a78-92f9-37505fa5aa3d','Fava Tips','herbs_leaves','lg,sm','{"lg":24,"sm":12}'::jsonb,24.00,'444a2d55-726f-470e-b8aa-5acc468dac80'),
  ('5f7e9d0f-e91b-4a78-92f9-37505fa5aa3d','Bean Flowers','flowers','sm,lg','{"sm":15,"lg":30}'::jsonb,15.00,'38446d9b-21c6-4074-b452-8b9c770dc057'),
  ('5f7e9d0f-e91b-4a78-92f9-37505fa5aa3d','Bean Leaf','herbs_leaves','lg,sm','{"lg":12,"sm":6}'::jsonb,12.00,'38446d9b-21c6-4074-b452-8b9c770dc057'),
  ('5f7e9d0f-e91b-4a78-92f9-37505fa5aa3d','Amaranth Flowers','flowers','lg,sm','{"lg":15,"sm":7.5}'::jsonb,15.00,'edb6e616-8ae9-4b06-8569-71f0fb4d92eb');

COMMIT;
