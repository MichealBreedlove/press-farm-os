-- ============================================
-- Press Farm OS — Migration 004: Seed Data
-- Farm, restaurants, initial delivery dates
-- ============================================

-- ============================================
-- Press Farm
-- ============================================
INSERT INTO farms (name, address, monthly_operating_cost)
VALUES ('Press Farm', '22 Tallent Lane, Yountville, CA', 2000.00);

-- ============================================
-- Restaurants (Press + Understudy)
-- ============================================
INSERT INTO restaurants (farm_id, name, slug)
VALUES
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Press', 'press'),
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Understudy', 'understudy');

-- ============================================
-- Upcoming delivery dates (seed a few to start)
-- Thu/Sat/Mon schedule — admin adds more as needed
-- ============================================
INSERT INTO delivery_dates (date, day_of_week, ordering_open)
VALUES
  ('2026-03-19', 'thursday', true),
  ('2026-03-21', 'saturday', true),
  ('2026-03-23', 'monday', true),
  ('2026-03-26', 'thursday', true),
  ('2026-03-28', 'saturday', true),
  ('2026-03-30', 'monday', true);

-- ============================================
-- Sample item catalog (from known Press Farm items)
-- Full 289-item import is done via the admin import tool
-- (Settings → Data Import → Import Price Catalog)
-- ============================================
INSERT INTO items (farm_id, name, category, unit_type, chef_notes, sort_order)
VALUES
  -- Flowers
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Alyssum (50ct)', 'flowers', 'ea', NULL, 10),
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Borage', 'flowers', 'sm', NULL, 20),
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Calendula', 'flowers', 'sm', NULL, 30),
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Chrysanthemum', 'flowers', 'sm', NULL, 40),
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Marigold', 'flowers', 'sm', NULL, 50),
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Mustard Flowers', 'flowers', 'sm', NULL, 60),
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Nasturtium (Dime-Nickel)', 'flowers', 'ea', 'Wild Harvest Unpredictable', 70),
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Nasturtium Leaf', 'flowers', 'ea', NULL, 80),
  -- Micros / Leaves
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Chickweed', 'micros_leaves', 'sm', NULL, 10),
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Fava Leaves', 'micros_leaves', 'sm', 'Slowly Growing Back', 20),
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Oxalis/Lucky Sorrel', 'micros_leaves', 'sm', NULL, 30),
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Pea Tendrils', 'micros_leaves', 'sm', NULL, 40),
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Tatsoi', 'micros_leaves', 'sm', NULL, 50),
  -- Herbs / Leaves
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Bay Leaf (California)', 'herbs_leaves', 'ea', NULL, 10),
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Mint, Chocolate', 'herbs_leaves', 'sm', NULL, 20),
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Mint, Japanese', 'herbs_leaves', 'sm', NULL, 30),
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Mint, Pineapple', 'herbs_leaves', 'sm', NULL, 40),
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Mint, Spearmint', 'herbs_leaves', 'sm', NULL, 50),
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Mint, Strawberry', 'herbs_leaves', 'sm', NULL, 60),
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Rosemary', 'herbs_leaves', 'bu', NULL, 70),
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Sage', 'herbs_leaves', 'bu', NULL, 80),
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Thyme', 'herbs_leaves', 'bu', NULL, 90),
  -- Fruit / Veg
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Beans', 'fruit_veg', 'lbs', NULL, 10),
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Kale', 'fruit_veg', 'bu', NULL, 20),
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Radish (Cherry Belle)', 'fruit_veg', 'bu', NULL, 30),
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Turnips', 'fruit_veg', 'bu', NULL, 40),
  -- Kits
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Salad Mix A', 'kits', 'kit', NULL, 10),
  ((SELECT id FROM farms WHERE name = 'Press Farm'), 'Salad Mix B', 'kits', 'kit', NULL, 20);
