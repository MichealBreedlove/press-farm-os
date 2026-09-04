-- Migration 064: seed microgreen demand from delivery history
--
-- Derives starting weekly demand targets for the microgreens module from the
-- historical deliveries + delivery_items tables (the financial source of truth).
--
-- Method:
--   * Only micros_leaves items that map to a microgreen_crop are considered
--     (explicit item -> crop map below; items with no crop, e.g. Squash Tendril
--      / Cucumber Tendril, are skipped).
--   * The 7 historical weekdays are folded into the 3 canonical delivery slots:
--       Mon (1) <- Sun + Mon, Thu (4) <- Tue + Wed + Thu, Sat (6) <- Fri + Sat.
--   * Bulk Green Bin ("gb") lines are excluded — gb is not a microgreen to-go
--     unit (see migration 047).
--   * target_quantity = average qty per delivery occurrence, rounded to the
--     nearest 0.5 (floored at 0.5), per crop x restaurant x slot x unit.
--   * Cells with fewer than 2 historical deliveries are dropped as noise.
--
-- Every row is tagged notes = 'Seeded from delivery history (2026-05-29)' so the
-- seed is fully reversible:
--   DELETE FROM microgreen_demand WHERE notes = 'Seeded from delivery history (2026-05-29)';
--
-- Requires migration 063 (per-unit unique index) to be applied first.

WITH map(item_id, crop_id) AS (VALUES
  ('edb6e616-8ae9-4b06-8569-71f0fb4d92eb'::uuid,'d713a28e-1c48-439a-93a2-3925db5f1da6'::uuid), -- Amaranth
  ('b2ea2797-7554-453a-ac34-3707670caf08','203f625c-ddab-4db5-b973-83b130cf65d2'), -- Anise Hyssop
  ('dc7ee951-303d-4573-91b9-742a703ebd32','eb1cddf5-3bb2-4bfb-90c7-444e7a395027'), -- Borage
  ('8f04294e-896a-4a99-bcda-c3e83a77a60a','06b24e29-410a-454d-925f-fb25c10709ca'), -- Celery
  ('aeeaf10f-c38f-403d-bf37-3be2642737c2','47a5fb3c-2ea9-49ed-a084-3111f5a191d1'), -- Chervil
  ('4cb23ef3-2332-4470-a4ae-eee69a944e8c','92206557-3f9a-402f-aa15-bfb68d591dd4'), -- Cress
  ('489061f4-d637-4dfe-9569-792d6a14b68b','1af64dd1-1fc8-400d-bdd2-7543d8a32e03'), -- Fava Leaf -> Fava Bean
  ('6abc9c65-6443-4df3-af69-028b779bebfc','4c51aacc-ed86-417c-8619-6a8ce81f1808'), -- Fennel
  ('610b5e06-bd7e-4548-bf61-46523ae7f636','3f408b8c-8b80-4ee8-8067-0b89fc56e519'), -- Frilly Mustard -> Mustard
  ('e4361522-b8fe-4d2b-ad78-178a06300b00','e7671ec9-417a-4928-828a-983eca9b1cb4'), -- Gem Marigold Leaf -> Marigold (Gem)
  ('42b5eb42-5b93-4636-b363-3fa324e06138','ecc972b8-d9b4-4677-a820-70fde2bbcc1f'), -- Pea Tendrils -> Pea (Frilly)
  ('22bca5a8-27f2-4768-90b1-de42050474a9','afcf9241-7310-4fac-ae5c-f5196796c5c1')  -- Sunflower Sprouts -> Sunflower
),
agg AS (
  SELECT m.crop_id, d.restaurant_id,
    CASE EXTRACT(dow FROM d.delivery_date)::int
      WHEN 0 THEN 1 WHEN 1 THEN 1
      WHEN 2 THEN 4 WHEN 3 THEN 4 WHEN 4 THEN 4
      WHEN 5 THEN 6 WHEN 6 THEN 6 END AS dow,
    di.unit,
    COUNT(*) AS n,
    AVG(di.quantity) AS avg_qty
  FROM delivery_items di
  JOIN deliveries d ON d.id = di.delivery_id
  JOIN map m ON m.item_id = di.item_id
  WHERE di.unit IN ('lg','sm','ea')
  GROUP BY m.crop_id, d.restaurant_id, dow, di.unit
)
INSERT INTO microgreen_demand (crop_id, restaurant_id, day_of_week, target_unit, target_quantity, target_oz, notes)
SELECT crop_id, restaurant_id, dow, unit,
  GREATEST(0.5, ROUND(avg_qty * 2) / 2.0)::numeric(8,2),
  NULL,  -- legacy target_oz column unused in the per-unit model (CHECK target_oz > 0 rejects 0)
  'Seeded from delivery history (2026-05-29)'
FROM agg
WHERE n >= 2
ON CONFLICT DO NOTHING;
