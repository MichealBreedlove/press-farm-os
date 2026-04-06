-- ============================================
-- Press Farm OS — Migration 008: Extend seed data
-- Adds April/May 2026 delivery dates and more items
-- ============================================

-- Additional delivery dates (Thu/Sat/Mon schedule)
INSERT INTO delivery_dates (date, day_of_week, ordering_open)
VALUES
  ('2026-04-02', 'thursday', true),
  ('2026-04-04', 'saturday', true),
  ('2026-04-06', 'monday', true),
  ('2026-04-09', 'thursday', true),
  ('2026-04-11', 'saturday', true),
  ('2026-04-13', 'monday', true),
  ('2026-04-16', 'thursday', true),
  ('2026-04-18', 'saturday', true),
  ('2026-04-21', 'monday', true),
  ('2026-04-23', 'thursday', true),
  ('2026-04-25', 'saturday', true),
  ('2026-04-28', 'monday', true),
  ('2026-04-30', 'thursday', true),
  ('2026-05-02', 'saturday', true),
  ('2026-05-04', 'monday', true),
  ('2026-05-07', 'thursday', true),
  ('2026-05-09', 'saturday', true),
  ('2026-05-11', 'monday', true)
ON CONFLICT (date) DO NOTHING;

-- Additional items from the known Press Farm catalog
INSERT INTO items (farm_id, name, category, unit_type, default_price, chef_notes, sort_order)
SELECT
  f.id,
  i.name,
  i.category,
  i.unit_type,
  i.default_price::decimal(10,2),
  i.chef_notes,
  i.sort_order
FROM farms f
CROSS JOIN (VALUES
  -- More Flowers
  ('Clover Blossom', 'flowers', 'sm', NULL, NULL, 90),
  ('Dianthus', 'flowers', 'sm', NULL, NULL, 100),
  ('Fennel Flower', 'flowers', 'sm', NULL, NULL, 110),
  ('Lavender', 'flowers', 'bu', NULL, NULL, 120),
  ('Lemon Verbena Flower', 'flowers', 'sm', NULL, NULL, 130),
  ('Pansy', 'flowers', 'sm', NULL, NULL, 140),
  ('Viola', 'flowers', 'sm', NULL, NULL, 150),
  ('Violet', 'flowers', 'sm', NULL, NULL, 160),

  -- More Micros & Leaves
  ('Arugula', 'micros_leaves', 'sm', NULL, NULL, 60),
  ('Beet Shoots', 'micros_leaves', 'sm', NULL, NULL, 70),
  ('Clover Sprouts', 'micros_leaves', 'sm', NULL, NULL, 80),
  ('Corn Shoots', 'micros_leaves', 'sm', NULL, NULL, 90),
  ('Micro Basil', 'micros_leaves', 'sm', NULL, NULL, 100),
  ('Micro Chive', 'micros_leaves', 'sm', NULL, NULL, 110),
  ('Mustard Greens', 'micros_leaves', 'sm', NULL, NULL, 120),
  ('Radish Sprouts', 'micros_leaves', 'sm', NULL, NULL, 130),
  ('Shiso Green', 'micros_leaves', 'sm', NULL, NULL, 140),
  ('Shiso Purple', 'micros_leaves', 'sm', NULL, NULL, 150),
  ('Sunflower Shoots', 'micros_leaves', 'sm', NULL, NULL, 160),
  ('Watercress', 'micros_leaves', 'sm', NULL, NULL, 170),

  -- More Herbs & Leaves
  ('Basil, Genovese', 'herbs_leaves', 'sm', NULL, NULL, 100),
  ('Basil, Holy', 'herbs_leaves', 'sm', NULL, NULL, 110),
  ('Basil, Purple', 'herbs_leaves', 'sm', NULL, NULL, 120),
  ('Basil, Thai', 'herbs_leaves', 'sm', NULL, NULL, 130),
  ('Chive', 'herbs_leaves', 'bu', NULL, NULL, 140),
  ('Cilantro', 'herbs_leaves', 'bu', NULL, NULL, 150),
  ('Dill', 'herbs_leaves', 'bu', NULL, NULL, 160),
  ('Epazote', 'herbs_leaves', 'sm', NULL, NULL, 170),
  ('Lemon Balm', 'herbs_leaves', 'sm', NULL, NULL, 180),
  ('Lemon Verbena', 'herbs_leaves', 'sm', NULL, NULL, 190),
  ('Lovage', 'herbs_leaves', 'sm', NULL, NULL, 200),
  ('Marjoram', 'herbs_leaves', 'sm', NULL, NULL, 210),
  ('Oregano', 'herbs_leaves', 'sm', NULL, NULL, 220),
  ('Parsley, Curly', 'herbs_leaves', 'bu', NULL, NULL, 230),
  ('Parsley, Flat', 'herbs_leaves', 'bu', NULL, NULL, 240),
  ('Savory', 'herbs_leaves', 'sm', NULL, NULL, 250),
  ('Sorrel', 'herbs_leaves', 'sm', NULL, NULL, 260),
  ('Tarragon', 'herbs_leaves', 'sm', NULL, NULL, 270),

  -- More Fruit & Veg
  ('Beets', 'fruit_veg', 'bu', NULL, NULL, 50),
  ('Broccoli', 'fruit_veg', 'ea', NULL, NULL, 60),
  ('Carrots', 'fruit_veg', 'bu', NULL, NULL, 70),
  ('Cucumber', 'fruit_veg', 'ea', NULL, NULL, 80),
  ('Eggplant', 'fruit_veg', 'ea', NULL, NULL, 90),
  ('Fava Beans', 'fruit_veg', 'lbs', NULL, 'Shell weight', 100),
  ('Fennel', 'fruit_veg', 'ea', NULL, NULL, 110),
  ('Garlic', 'fruit_veg', 'ea', NULL, NULL, 120),
  ('Green Onion', 'fruit_veg', 'bu', NULL, NULL, 130),
  ('Kohlrabi', 'fruit_veg', 'ea', NULL, NULL, 140),
  ('Leek', 'fruit_veg', 'ea', NULL, NULL, 150),
  ('Lemon', 'fruit_veg', 'ea', NULL, NULL, 160),
  ('Lettuce Head', 'fruit_veg', 'ea', NULL, NULL, 170),
  ('Peas, Sugar Snap', 'fruit_veg', 'lbs', NULL, NULL, 180),
  ('Peppers', 'fruit_veg', 'ea', NULL, NULL, 190),
  ('Potato, Fingerling', 'fruit_veg', 'lbs', NULL, NULL, 200),
  ('Radicchio', 'fruit_veg', 'ea', NULL, NULL, 210),
  ('Spinach', 'fruit_veg', 'bu', NULL, NULL, 220),
  ('Squash, Summer', 'fruit_veg', 'ea', NULL, NULL, 230),
  ('Squash Blossom', 'fruit_veg', 'ea', NULL, NULL, 240),
  ('Swiss Chard', 'fruit_veg', 'bu', NULL, NULL, 250),
  ('Tomato, Cherry', 'fruit_veg', 'pt', NULL, NULL, 260),
  ('Tomato, Heirloom', 'fruit_veg', 'lbs', NULL, NULL, 270),
  ('Zucchini', 'fruit_veg', 'ea', NULL, NULL, 280)
) AS i(name, category, unit_type, default_price, chef_notes, sort_order)
WHERE f.name = 'Press Farm'
  AND f.id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM items ex
    WHERE ex.farm_id = f.id
    AND ex.name = i.name
  );
