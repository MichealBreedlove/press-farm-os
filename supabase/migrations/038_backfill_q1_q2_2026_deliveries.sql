-- 038_backfill_q1_q2_2026_deliveries.sql
-- Imports 313 historical delivery rows (Mar 7 – May 4, 2026) extracted
-- from harvest-plan source documents. Idempotent: re-running the same
-- (date, restaurant) wipes its delivery_items and reinserts from the
-- staging set, so partial runs / corrections are safe.
--
-- Behaviour summary:
--   1. Stage all rows into a temp table.
--   2. Auto-create any items not already in the catalog (case-insensitive
--      name match), defaulting to category='flowers' and unit_type=row's
--      unit. Micheal can recategorize / fix unit_type later from the
--      items page — no data is dropped.
--   3. Auto-create delivery_dates rows for any missing dates, mapping
--      Mon/Thu/Sat to their proper enums and everything else to 'custom'.
--      ordering_open=false so chefs can't retro-order against backfill.
--   4. Upsert one deliveries row per (date, restaurant), status='logged'.
--   5. Wipe delivery_items for those (date, restaurant) pairs and
--      reinsert fresh from the staging set.
--
-- Notes:
--   - 'Sample' on 5/2 (Press) is a 1ea row with no price — likely a
--     placeholder; left in for completeness but flag for review.
--   - Several rows have no Unit Price; we store unit_price=0 since the
--     column is NOT NULL. Re-pricing is admin's call.
--   - The Notes column carries the source-doc attribution and any
--     variety hint ("Tiny |", "Bronze |", etc.) — preserved into
--     delivery_items.bonus_note (it's the free-text field on the row).

BEGIN;

-- =====================================================================
-- 1. Stage rows
-- =====================================================================
CREATE TEMP TABLE _stg_deliv (
  delivery_date date,
  restaurant_name text,
  item_name      text,
  quantity       numeric,
  unit           text,
  unit_price     numeric,
  notes          text
) ON COMMIT DROP;

INSERT INTO _stg_deliv (delivery_date, restaurant_name, item_name, quantity, unit, unit_price, notes) VALUES
  ('2026-03-07', 'Press', 'calendula', 1.0, 'lg', NULL, 'src: 04-02 Order Fulfillment Michael Breedlove – Produce & Edible Flowers (April 2).txt'),
  ('2026-03-07', 'Press', 'fava flowers', 1.0, 'sm', 3.75, 'Tiny | src: 04-02 Task List Restaurant Harvest Orders.txt'),
  ('2026-03-07', 'Press', 'fava flowers', 1.0, 'lg', 7.5, 'src: 04-02 Task List Restaurant Harvest Orders.txt'),
  ('2026-03-07', 'Press', 'Fava Leaf', 1.0, 'sm', 6.0, 'src: 04-02 Task List Restaurant Harvest Orders.txt'),
  ('2026-03-07', 'Press', 'frilly mustard', 4.0, 'lg', 12.0, 'src: 04-09 Harvest Plan Edible Flowers, Herbs, and Greens — Quantities and Packaging.txt'),
  ('2026-03-07', 'Press', 'mint', 1.0, 'sm', 10.0, 'src: 04-11 Harvest List Edible Flowers, Herbs, and Greens.txt'),
  ('2026-03-07', 'Press', 'Mustard Flowers', 1.0, 'qt', 20.0, 'src: 04-11 Order Preparation March 12 Press Order - Flowers, Leaves, Greens, Packaging and Quantities.txt'),
  ('2026-03-07', 'Press', 'nasturtium', 1.0, 'sm', 7.5, 'src: 04-11 Task List Produce Prep and Offsite Event Orders (Flowers, Leaves, Greens) - March 7.txt'),
  ('2026-03-07', 'Press', 'nasturtium', 1.0, 'sm', 7.5, 'src: 04-13 Harvest Schedule Edible Flowers & Greens Order Fulfillment.txt'),
  ('2026-03-07', 'Press', 'oxalis', 1.0, 'sm', 6.0, 'src: 04-20 List Harvest List.txt'),
  ('2026-03-07', 'Press', 'pea flowers', 2.0, 'lg', 30.0, 'src: 04-23 Harvest List Edible Flowers, Herbs, Greens.txt'),
  ('2026-03-07', 'Press', 'pea tendrils', 4.0, 'lg', 12.0, 'src: 04-23 Harvest List Edible Flowers, Herbs, Greens.txt'),
  ('2026-03-07', 'Press', 'Radish Flowers', 4.0, 'qt', 15.0, 'src: 05-02 Harvest List Edible Flowers, Herbs, Greens, and Vegetables.txt'),
  ('2026-03-09', 'Press', 'Ethiopian kale', 1.0, 'lg', NULL, 'src: 04-02 Task List Restaurant Harvest Orders.txt'),
  ('2026-03-09', 'Press', 'Frilly Mustard', 4.0, 'lg', 12.0, 'src: 04-09 Harvest Plan Edible Flowers, Herbs, and Greens — Quantities and Packaging.txt'),
  ('2026-03-09', 'Press', 'Miners Lettuce', 1.0, 'sm', 7.5, 'src: 04-11 Harvest List Edible Flowers & Greens_1.txt'),
  ('2026-03-09', 'Press', 'Mustard Flowers', 1.0, 'qt', 20.0, 'src: 04-11 Inventory Checklist Edible Flowers, Herbs, and Greens — March 23, 2026.txt'),
  ('2026-03-09', 'Press', 'nasturtium', 1.0, 'lg', 15.0, 'src: 04-11 Task List Produce Prep and Offsite Event Orders (Flowers, Leaves, Greens) - March 7.txt'),
  ('2026-03-09', 'Press', 'Nasturtium', 8.0, 'qt', 15.0, 'src: 04-11 Task List Produce Prep and Offsite Event Orders (Flowers, Leaves, Greens) - March 7.txt'),
  ('2026-03-12', 'Press', 'Bay Leaf', 1.0, 'lg', 15.0, 'src: 04-02 Order Fulfillment Michael Breedlove – Produce & Edible Flowers (April 2).txt'),
  ('2026-03-12', 'Press', 'fava flowers', 1.0, 'lg', 7.5, 'src: 04-02 Task List Restaurant Harvest Orders.txt'),
  ('2026-03-12', 'Press', 'forget-me-nots', 1.0, 'sm', 12.0, 'src: 04-06 Produce Order Press and Understudy.txt'),
  ('2026-03-12', 'Press', 'frilly mustard', 4.0, 'lg', 12.0, 'src: 04-09 Harvest Plan Edible Flowers, Herbs, and Greens — Quantities and Packaging.txt'),
  ('2026-03-12', 'Press', 'Miners Lettuce', 100.0, 'ea', NULL, 'src: 04-11 Harvest List Edible Flowers & Greens.txt'),
  ('2026-03-12', 'Press', 'mint', 1.0, 'sm', 10.0, 'src: 04-11 Inventory Checklist Edible Flowers, Herbs, and Greens — March 23, 2026.txt'),
  ('2026-03-12', 'Press', 'nasturtium', 200.0, 'ea', 0.3, 'src: 04-13 Harvest Schedule Edible Flowers & Greens Order Fulfillment.txt'),
  ('2026-03-12', 'Press', 'Nasturtium Flower', 1.0, 'lg', 15.0, 'src: 04-16 Harvest Log Edible Flowers, Herbs, and Greens — Small To-Go Prep.txt'),
  ('2026-03-12', 'Press', 'Nasturtium', 1.0, 'lg', 15.0, 'src: 04-16 Harvest Log Edible Flowers, Herbs, and Greens — Small To-Go Prep.txt'),
  ('2026-03-12', 'Press', 'oxalis flowers', 1.0, 'lg', NULL, 'src: 04-20 List Harvest List.txt'),
  ('2026-03-12', 'Press', 'wild cress', 1.0, 'lg', NULL, 'src: 05-04 Harvest List May 4 Edible Flowers, Herbs, and Salad Mix.txt'),
  ('2026-03-14', 'Press', 'Fava Leaf', 1.0, 'gb', 72.0, 'src: 04-02 Task List Restaurant Harvest Orders.txt'),
  ('2026-03-14', 'Press', 'Fava Leaf', 1.0, 'gb', 72.0, 'src: 04-02 Task List Restaurant Harvest Orders.txt'),
  ('2026-03-14', 'Understudy', 'forget-me-nots', 1.0, 'sm', 12.0, 'src: 04-06 Produce Order Press and Understudy.txt'),
  ('2026-03-14', 'Press', 'Frilly Mustard', 1.0, 'lg', 12.0, 'src: 04-06 Produce Order Press and Understudy.txt'),
  ('2026-03-14', 'Press', 'Frilly Mustard', 1.0, 'lg', 12.0, 'src: 04-09 Harvest Plan Edible Flowers, Herbs, and Greens — Quantities and Packaging.txt'),
  ('2026-03-14', 'Understudy', 'frilly mustard', 1.0, 'lg', 12.0, 'src: 04-11 Delivery Order Press - March 26th.txt'),
  ('2026-03-14', 'Understudy', 'kale', 1.0, 'lg', 20.0, 'src: 04-11 Harvest List 2026-03-14.txt'),
  ('2026-03-14', 'Press', 'miners lettuce', 1.0, 'lg', NULL, 'src: 04-11 Harvest List Edible Flowers & Greens_1.txt'),
  ('2026-03-14', 'Understudy', 'mustard', 1.0, 'lg', 20.0, 'src: 04-11 Inventory Checklist Edible Flowers, Herbs, and Greens — March 23, 2026.txt'),
  ('2026-03-14', 'Press', 'nasturtium', 1.0, 'lg', 15.0, 'src: 04-11 Order Preparation March 12 Press Order - Flowers, Leaves, Greens, Packaging and Quantities.txt'),
  ('2026-03-14', 'Understudy', 'nasturtium', 1.0, 'sm', 7.5, 'src: 04-16 Harvest List Edible Flowers, Herbs & Greens.txt'),
  ('2026-03-14', 'Press', 'oxalis', 1.0, 'sm', 6.0, 'src: 04-18 Harvest Plan Edible Flowers, Herbs, and Greens — Quantities and Packaging.txt'),
  ('2026-03-14', 'Press', 'oxalis flowers', 1.0, 'lg', 20.0, 'src: 04-23 Checklist Edible Flowers & Greens Harvest and Packaging Totals.txt'),
  ('2026-03-14', 'Press', 'pea flowers', 1.0, 'sm', 15.0, 'src: 04-23 Harvest List Edible Flowers, Herbs, Greens.txt'),
  ('2026-03-14', 'Press', 'Radish', 400.0, 'ea', 0.5, 'src: 04-30 Harvest List Edible Flowers & Herbs.txt'),
  ('2026-03-14', 'Understudy', 'rosemary', 1.0, 'lg', 10.0, 'src: 05-04 Harvest List Edible Flowers, Herbs, and Greens for May 4, 2026.txt'),
  ('2026-03-14', 'Understudy', 'Salad Mix Large Leaf', 1.0, 'lg', 12.0, 'src: 05-04 Harvest List Edible Flowers, Herbs, and Greens for May 4, 2026.txt'),
  ('2026-03-14', 'Understudy', 'tatsoi', 1.0, 'lg', 20.0, 'src: 05-04 Harvest List May 4 Edible Flowers, Herbs, and Salad Mix.txt'),
  ('2026-03-19', 'Press', 'Fava Leaf', 1.0, 'lg', 12.0, 'src: 04-02 Task List Restaurant Harvest Orders.txt'),
  ('2026-03-19', 'Press', 'forget me nots', 1.0, 'sm', NULL, 'src: 04-06 Produce Order Press and Understudy.txt'),
  ('2026-03-19', 'Press', 'Frilly Mustard', 6.0, 'lg', 12.0, 'src: 04-09 Harvest Plan Edible Flowers, Herbs, and Greens — Quantities and Packaging.txt'),
  ('2026-03-19', 'Press', 'Miners Lettuce', 1.0, 'lg', 15.0, 'src: 04-11 Harvest List Edible Flowers & Greens_1.txt'),
  ('2026-03-19', 'Press', 'mint', 1.0, 'sm', 10.0, 'src: 04-11 Harvest List Edible Flowers, Herbs, and Greens.txt'),
  ('2026-03-19', 'Press', 'Mustard Flowers', 2.0, 'qt', NULL, 'src: 04-11 Inventory Checklist Edible Flowers, Herbs, and Greens — March 23, 2026.txt'),
  ('2026-03-19', 'Press', 'nasturtium', 1.0, 'lg', 15.0, 'src: 04-11 Task List Produce Prep and Offsite Event Orders (Flowers, Leaves, Greens) - March 7.txt'),
  ('2026-03-19', 'Press', 'Nasturtium', 1.0, 'lg', 15.0, 'src: 04-11 Task List Produce Prep and Offsite Event Orders (Flowers, Leaves, Greens) - March 7.txt'),
  ('2026-03-19', 'Press', 'Radish Flowers', 3.0, 'qt', NULL, 'src: 04-30 Harvest List Edible Flowers & Herbs.txt'),
  ('2026-03-21', 'Press', 'fava flowers', 1.0, 'lg', 7.5, 'src: 04-02 Task List Restaurant Harvest Orders.txt'),
  ('2026-03-21', 'Press', 'fava flowers', 1.0, 'lg', 7.5, 'src: 04-02 Task List Restaurant Harvest Orders.txt'),
  ('2026-03-21', 'Press', 'Fava Leaf', 6.0, 'gb', 72.0, 'src: 04-02 Task List Restaurant Harvest Orders.txt'),
  ('2026-03-21', 'Press', 'Miners Lettuce', 1.0, 'lg', 15.0, 'src: 04-11 Harvest List Edible Flowers & Greens_1.txt'),
  ('2026-03-21', 'Press', 'Miners Lettuce', 1.0, 'lg', 15.0, 'src: 04-11 Harvest List Edible Flowers & Greens_1.txt'),
  ('2026-03-21', 'Press', 'mint', 1.0, 'sm', 10.0, 'src: 04-11 Harvest List Edible Flowers, Herbs, and Greens.txt'),
  ('2026-03-21', 'Press', 'mint', 1.0, 'sm', 10.0, 'src: 04-11 Harvest List Edible Flowers, Herbs, and Greens.txt'),
  ('2026-03-21', 'Press', 'nasturtium', 1.0, 'lg', 15.0, 'src: 04-11 Task List Produce Prep and Offsite Event Orders (Flowers, Leaves, Greens) - March 7.txt'),
  ('2026-03-21', 'Press', 'nasturtium', 1.0, 'lg', 15.0, 'src: 04-11 Task List Produce Prep and Offsite Event Orders (Flowers, Leaves, Greens) - March 7.txt'),
  ('2026-03-21', 'Press', 'nasturtium', 1.0, 'lg', 15.0, 'src: 04-11 Task List Produce Prep and Offsite Event Orders (Flowers, Leaves, Greens) - March 7.txt'),
  ('2026-03-21', 'Press', 'nasturtium', 1.0, 'lg', 15.0, 'src: 04-11 Task List Produce Prep and Offsite Event Orders (Flowers, Leaves, Greens) - March 7.txt'),
  ('2026-03-21', 'Press', 'oxalis', 1.0, 'lg', 12.0, 'src: 04-20 List Harvest List.txt'),
  ('2026-03-21', 'Press', 'oxalis', 1.0, 'lg', 12.0, 'src: 04-20 List Harvest List.txt'),
  ('2026-03-21', 'Press', 'Radish Flowers', 2.0, 'qt', 15.0, 'src: 05-02 Harvest List Edible Flowers, Herbs, Greens, and Vegetables.txt'),
  ('2026-03-21', 'Press', 'Radish Flowers', 2.0, 'qt', 15.0, 'src: 05-02 Harvest List Edible Flowers, Herbs, Greens, and Vegetables.txt'),
  ('2026-03-23', 'Understudy', 'alyssum', 50.0, 'sm', 12.0, 'src: 04-02 Order Fulfillment Michael Breedlove – Produce & Edible Flowers (April 2).txt'),
  ('2026-03-23', 'Understudy', 'borage', 130.0, 'lg', 16.0, 'src: 04-02 Order Fulfillment Michael Breedlove – Produce & Edible Flowers (April 2).txt'),
  ('2026-03-23', 'Understudy', 'calendula', 3.0, 'lg', 30.0, 'src: 04-02 Order Fulfillment Michael Breedlove – Produce & Edible Flowers (April 2).txt'),
  ('2026-03-23', 'Understudy', 'Frilly Mustard', 8.0, 'lg', 12.0, 'src: 04-11 Delivery Order Press - March 26th.txt'),
  ('2026-03-23', 'Press', 'kale', 1.0, 'lg', 20.0, 'src: 04-11 Harvest List 2026-03-14.txt'),
  ('2026-03-23', 'Press', 'Miners Lettuce', 1.0, 'lg', 15.0, 'src: 04-11 Harvest List Edible Flowers & Greens_1.txt'),
  ('2026-03-23', 'Understudy', 'Miners Lettuce', 130.0, 'lg', 15.0, 'src: 04-11 Harvest List Edible Flowers & Greens_1.txt'),
  ('2026-03-23', 'Understudy', 'Mint', 1.0, 'lg', 20.0, 'src: 04-11 Inventory Checklist Edible Flowers, Herbs, and Greens — March 23, 2026.txt'),
  ('2026-03-23', 'Press', 'Mustard Flowers', 2.0, 'qt', 20.0, 'src: 04-11 Order Preparation March 12 Press Order - Flowers, Leaves, Greens, Packaging and Quantities.txt'),
  ('2026-03-23', 'Understudy', 'Nasturtium', 3.0, 'lg', NULL, 'src: 04-11 Order Preparation March 12 Press Order - Flowers, Leaves, Greens, Packaging and Quantities.txt'),
  ('2026-03-23', 'Press', 'nasturtium', 250.0, 'lg', 15.0, 'src: 04-11 Task List Produce Prep and Offsite Event Orders (Flowers, Leaves, Greens) - March 7.txt'),
  ('2026-03-23', 'Understudy', 'Onion Blossoms', 1.0, 'sm', 12.0, 'src: 04-18 Harvest Plan Edible Flowers, Herbs, and Greens — Quantities and Packaging.txt'),
  ('2026-03-23', 'Press', 'oxalis', 1.0, 'lg', 12.0, 'src: 04-20 List Harvest List.txt'),
  ('2026-03-23', 'Understudy', 'oxalis', 1.0, 'lg', 12.0, 'src: 04-20 List Harvest List.txt'),
  ('2026-03-23', 'Understudy', 'pea flower', 120.0, 'lg', NULL, 'src: 04-23 Harvest List Edible Flowers, Herbs, Greens.txt'),
  ('2026-03-23', 'Press', 'Radish Flowers', 2.0, 'qt', 15.0, 'Green | src: 05-02 Harvest List Edible Flowers, Herbs, Greens, and Vegetables.txt'),
  ('2026-03-26', 'Press', 'Miners Lettuce', 1.0, 'lg', 15.0, 'src: 04-11 Harvest List Edible Flowers & Greens_1.txt'),
  ('2026-03-26', 'Press', 'Mustard Flowers', 2.0, 'qt', 20.0, 'src: 04-11 Inventory Checklist Edible Flowers, Herbs, and Greens — March 23, 2026.txt'),
  ('2026-03-26', 'Press', 'nasturtium', 1.0, 'lg', 15.0, 'src: 04-11 Order Preparation March 12 Press Order - Flowers, Leaves, Greens, Packaging and Quantities.txt'),
  ('2026-03-26', 'Press', 'Nasturtium flowers', 2.0, 'lg', 15.0, 'src: 04-16 Harvest Log Edible Flowers, Herbs, and Greens — Small To-Go Prep.txt'),
  ('2026-03-26', 'Press', 'oxalis', 1.0, 'lg', 12.0, 'Tiny | src: 04-18 Harvest Plan Edible Flowers, Herbs, and Greens — Quantities and Packaging.txt'),
  ('2026-03-26', 'Press', 'radish', 200.0, 'ea', 0.5, 'src: 04-30 Harvest List Edible Flowers & Herbs.txt'),
  ('2026-03-26', 'Press', 'Radish Flowers', 2.0, 'qt', 15.0, 'src: 05-02 Harvest List Edible Flowers, Herbs, Greens, and Vegetables.txt'),
  ('2026-04-02', 'Press', 'Bay Leaf', 1.0, 'lg', 15.0, 'src: 04-02 Order Fulfillment Michael Breedlove – Produce & Edible Flowers (April 2).txt'),
  ('2026-04-02', 'Press', 'Bay Leaf', 1.0, 'lg', 15.0, 'Tiny | src: 04-02 Order Fulfillment Michael Breedlove – Produce & Edible Flowers (April 2).txt'),
  ('2026-04-02', 'Press', 'Forget-me-nots', 1.0, 'sm', 12.0, 'src: 04-06 Produce Order Press and Understudy.txt'),
  ('2026-04-02', 'Press', 'forget-me-nots', 1.0, 'sm', 12.0, 'Tiny | src: 04-06 Produce Order Press and Understudy.txt'),
  ('2026-04-02', 'Press', 'frilly mustard', 1.0, 'lg', 12.0, 'src: 04-09 Harvest Plan Edible Flowers, Herbs, and Greens — Quantities and Packaging.txt'),
  ('2026-04-02', 'Understudy', 'frilly mustard', 1.0, 'lg', 12.0, 'src: 04-11 Delivery Order Press - March 26th.txt'),
  ('2026-04-02', 'Understudy', 'lettuce', 1.0, 'gb', 120.0, 'src: 04-11 Harvest List Edible Flowers & Greens.txt'),
  ('2026-04-02', 'Press', 'mint', 1.0, 'sm', 10.0, 'src: 04-11 Harvest List Edible Flowers & Greens_1.txt'),
  ('2026-04-02', 'Press', 'mint', 1.0, 'sm', 10.0, 'src: 04-11 Inventory Checklist Edible Flowers, Herbs, and Greens — March 23, 2026.txt'),
  ('2026-04-02', 'Press', 'Mustard', 2.0, 'lg', 20.0, 'src: 04-11 Inventory Checklist Edible Flowers, Herbs, and Greens — March 23, 2026.txt'),
  ('2026-04-02', 'Press', 'Mustard', 2.0, 'lg', 20.0, 'src: 04-11 Inventory Checklist Edible Flowers, Herbs, and Greens — March 23, 2026.txt'),
  ('2026-04-02', 'Press', 'mustard', 1.0, 'lg', 20.0, 'src: 04-11 Inventory Checklist Edible Flowers, Herbs, and Greens — March 23, 2026.txt'),
  ('2026-04-02', 'Understudy', 'Mustard', 1.0, 'lg', 20.0, 'src: 04-11 Inventory Checklist Edible Flowers, Herbs, and Greens — March 23, 2026.txt'),
  ('2026-04-02', 'Press', 'Nasturtium', 100.0, 'ea', 0.3, 'src: 04-11 Order Preparation March 12 Press Order - Flowers, Leaves, Greens, Packaging and Quantities.txt'),
  ('2026-04-02', 'Press', 'Nasturtium', 100.0, 'lg', 15.0, 'src: 04-13 Harvest Schedule Edible Flowers & Greens Order Fulfillment.txt'),
  ('2026-04-02', 'Press', 'Nasturtium', 50.0, 'sm', 7.5, 'Tiny | src: 04-13 Harvest Schedule Edible Flowers & Greens Order Fulfillment.txt'),
  ('2026-04-02', 'Understudy', 'Nasturtium', 50.0, 'ea', 0.3, 'src: 04-16 Harvest List Edible Flowers, Herbs & Greens.txt'),
  ('2026-04-02', 'Press', 'Nasturtium Flower', 1.0, 'lg', 15.0, 'src: 04-16 Harvest Log Edible Flowers, Herbs, and Greens — Small To-Go Prep.txt'),
  ('2026-04-02', 'Understudy', 'Nasturtium Flower', 1.0, 'lg', 15.0, 'src: 04-16 Harvest Log Edible Flowers, Herbs, and Greens — Small To-Go Prep.txt'),
  ('2026-04-02', 'Press', 'New Zealand Spinach', 1.0, 'sm', 7.5, 'src: 04-16 Harvest Log Edible Flowers, Herbs, and Greens — Small To-Go Prep.txt'),
  ('2026-04-02', 'Press', 'New Zealand Spinach', 1.0, 'sm', 7.5, 'src: 04-17 Harvest Schedule Edible Flowers, Herbs, Greens, and Vegetables — To-Go and Bin Counts.txt'),
  ('2026-04-02', 'Press', 'Onion Blossoms', 1.0, 'sm', 12.0, 'src: 04-17 Harvest Schedule Edible Flowers, Herbs, Greens, and Vegetables — To-Go and Bin Counts.txt'),
  ('2026-04-02', 'Press', 'Onion Blossoms', 2.0, 'lg', 24.0, 'src: 04-17 Harvest Schedule Edible Flowers, Herbs, Greens, and Vegetables — To-Go and Bin Counts.txt'),
  ('2026-04-02', 'Press', 'Onion Blossoms', 1.0, 'sm', 12.0, 'src: 04-17 Harvest Schedule Edible Flowers, Herbs, Greens, and Vegetables — To-Go and Bin Counts.txt'),
  ('2026-04-02', 'Press', 'Onion Blossoms', 2.0, 'lg', 24.0, 'src: 04-17 Harvest Schedule Edible Flowers, Herbs, Greens, and Vegetables — To-Go and Bin Counts.txt'),
  ('2026-04-02', 'Press', 'Peas', 2.0, 'lg', 15.0, 'src: 04-25 Harvest List Edible Flowers, Herbs, Greens.txt'),
  ('2026-04-02', 'Press', 'Peas', 2.0, 'lg', 15.0, 'src: 04-25 Harvest List Edible Flowers, Herbs, Greens.txt'),
  ('2026-04-02', 'Press', 'Radish', 1.0, 'gb', 150.0, 'src: 04-27 List Harvest Plan - Edible Flowers & Greens.txt'),
  ('2026-04-02', 'Press', 'Radish Flowers', 2.0, 'qt', 15.0, 'src: 05-02 Harvest List Edible Flowers, Herbs, Greens, and Vegetables.txt'),
  ('2026-04-02', 'Press', 'Radish Flowers', 2.0, 'qt', 15.0, 'src: 05-02 Harvest List Edible Flowers, Herbs, Greens, and Vegetables.txt'),
  ('2026-04-02', 'Press', 'rosemary', 1.0, 'lg', 10.0, 'src: 05-02 Harvest List Edible Flowers, Herbs, Greens, and Vegetables.txt'),
  ('2026-04-02', 'Understudy', 'rosemary', 1.0, 'lg', 10.0, 'src: 05-02 Harvest List Edible Flowers, Herbs, Greens, and Vegetables.txt'),
  ('2026-04-02', 'Press', 'Salad Mix Large Leaf', 1.0, 'lg', 12.0, 'src: 05-04 Harvest List Edible Flowers, Herbs, and Greens for May 4, 2026.txt'),
  ('2026-04-02', 'Understudy', 'Salad Mix Large Leaf', 1.0, 'lg', 15.0, 'src: 05-04 Harvest List Edible Flowers, Herbs, and Greens for May 4, 2026.txt'),
  ('2026-04-04', 'Press', 'Bay Leaf', 1.0, 'lg', 15.0, 'src: 04-02 Order Fulfillment Michael Breedlove – Produce & Edible Flowers (April 2).txt'),
  ('2026-04-04', 'Press', 'nasturtium', 100.0, 'sm', NULL, 'src: 04-02 Task List Restaurant Harvest Orders.txt'),
  ('2026-04-04', 'Press', 'Fava Leaf', 1.0, 'lg', 12.0, 'src: 04-02 Task List Restaurant Harvest Orders.txt'),
  ('2026-04-04', 'Press', 'forget-me-nots', 1.0, 'sm', 12.0, 'src: 04-06 Produce Order Press and Understudy.txt'),
  ('2026-04-04', 'Press', 'frilly mustard', 2.0, 'lg', 12.0, 'src: 04-06 Produce Order Press and Understudy.txt'),
  ('2026-04-04', 'Press', 'mint', 1.0, 'sm', 10.0, 'src: 04-11 Harvest List Edible Flowers, Herbs, and Greens.txt'),
  ('2026-04-04', 'Press', 'Mustard', 2.0, 'lg', 20.0, 'src: 04-11 Inventory Checklist Edible Flowers, Herbs, and Greens — March 23, 2026.txt'),
  ('2026-04-04', 'Press', 'Onion Blossoms', 1.0, 'sm', 12.0, 'Tiny | src: 04-17 Harvest Schedule Edible Flowers, Herbs, Greens, and Vegetables — To-Go and Bin Counts.txt'),
  ('2026-04-04', 'Press', 'pea flowers', 1.0, 'sm', 15.0, 'src: 04-23 Harvest List Edible Flowers, Herbs, Greens.txt'),
  ('2026-04-04', 'Press', 'Radish', 1.0, 'gb', 150.0, 'src: 04-27 List Harvest Plan - Edible Flowers & Greens.txt'),
  ('2026-04-04', 'Press', 'Radish Flowers', 3.0, 'qt', 15.0, 'src: 05-02 Harvest List Edible Flowers, Herbs, Greens, and Vegetables.txt'),
  ('2026-04-06', 'Press', 'aptenia', 1.0, 'lg', 15.0, 'src: 04-02 Order Fulfillment Michael Breedlove – Produce & Edible Flowers (April 2).txt'),
  ('2026-04-06', 'Press', 'Fava Leaf', 1.0, 'lg', 12.0, 'src: 04-02 Task List Restaurant Harvest Orders.txt'),
  ('2026-04-06', 'Press', 'forget-me-nots', 1.0, 'sm', 12.0, 'src: 04-06 Produce Order Press and Understudy.txt'),
  ('2026-04-06', 'Press', 'frilly mustard', 2.0, 'lg', 12.0, 'src: 04-06 Produce Order Press and Understudy.txt'),
  ('2026-04-06', 'Understudy', 'frilly mustard', 1.0, 'lg', 12.0, 'src: 04-11 Delivery Order Press - March 26th.txt'),
  ('2026-04-06', 'Press', 'mint', 1.0, 'sm', 10.0, 'src: 04-11 Harvest List Edible Flowers, Herbs, and Greens.txt'),
  ('2026-04-06', 'Press', 'Mustard', 2.0, 'lg', 20.0, 'src: 04-11 Inventory Checklist Edible Flowers, Herbs, and Greens — March 23, 2026.txt'),
  ('2026-04-06', 'Understudy', 'Mustard', 1.0, 'lg', 20.0, 'src: 04-11 Inventory Checklist Edible Flowers, Herbs, and Greens — March 23, 2026.txt'),
  ('2026-04-06', 'Press', 'Mustard Flowers', 2.0, 'qt', NULL, 'src: 04-11 Order Preparation March 12 Press Order - Flowers, Leaves, Greens, Packaging and Quantities.txt'),
  ('2026-04-06', 'Press', 'nasturtium', 200.0, 'lg', 15.0, 'src: 04-11 Order Preparation March 12 Press Order - Flowers, Leaves, Greens, Packaging and Quantities.txt'),
  ('2026-04-06', 'Understudy', 'nasturtium', 50.0, 'sm', 7.5, 'src: 04-16 Harvest List Edible Flowers, Herbs & Greens.txt'),
  ('2026-04-06', 'Press', 'Peas', 1.0, 'lg', 15.0, 'src: 04-25 Harvest List Edible Flowers, Herbs, Greens.txt'),
  ('2026-04-06', 'Understudy', 'Radish', 1.0, 'lg', 25.0, 'src: 04-30 Harvest List Edible Flowers & Herbs.txt'),
  ('2026-04-06', 'Press', 'Radish Flowers', 2.0, 'qt', 15.0, 'src: 05-02 Harvest List Edible Flowers, Herbs, Greens, and Vegetables.txt'),
  ('2026-04-06', 'Understudy', 'rosemary', 1.0, 'lg', 10.0, 'src: 05-04 Harvest List Edible Flowers, Herbs, and Greens for May 4, 2026.txt'),
  ('2026-04-06', 'Understudy', 'Salad Mix Large Leaf', 1.0, 'lg', 12.0, 'src: 05-04 Harvest List Edible Flowers, Herbs, and Greens for May 4, 2026.txt'),
  ('2026-04-09', 'Press', 'Fava Leaf', 1.0, 'lg', 12.0, 'src: 04-02 Task List Restaurant Harvest Orders.txt'),
  ('2026-04-09', 'Press', 'hikari turnips', 20.0, 'ea', NULL, 'src: 04-11 Harvest List 2026-03-14.txt'),
  ('2026-04-09', 'Press', 'Mint', 1.0, 'sm', 10.0, 'src: 04-11 Harvest List Edible Flowers, Herbs, and Greens.txt'),
  ('2026-04-09', 'Press', 'nasturtium', 1.0, 'lg', 15.0, 'src: 04-11 Order Preparation March 12 Press Order - Flowers, Leaves, Greens, Packaging and Quantities.txt'),
  ('2026-04-09', 'Press', 'Nasturtium', 2.0, 'lg', 15.0, 'src: 04-11 Order Preparation March 12 Press Order - Flowers, Leaves, Greens, Packaging and Quantities.txt'),
  ('2026-04-09', 'Press', 'oxalis', 2.0, 'sm', 6.0, 'src: 04-18 Harvest Plan Edible Flowers, Herbs, and Greens — Quantities and Packaging.txt'),
  ('2026-04-09', 'Press', 'Radish Flowers', 3.0, 'qt', 15.0, 'src: 05-02 Harvest List Edible Flowers, Herbs, Greens, and Vegetables.txt'),
  ('2026-04-09', 'Press', 'radish', 20.0, 'ea', NULL, 'src: 05-02 Harvest List Edible Flowers, Herbs, Greens, and Vegetables.txt'),
  ('2026-04-13', 'Press', 'Fennel', 1.0, 'sm', 15.0, 'src: 04-04 Harvest List Edible Flowers, Herbs, Greens, and Vegetables.txt'),
  ('2026-04-13', 'Press', 'Fennel', 1.0, 'sm', 15.0, 'src: 04-04 Harvest List Edible Flowers, Herbs, Greens, and Vegetables.txt'),
  ('2026-04-13', 'Press', 'forget-me-nots', 1.0, 'sm', 12.0, 'src: 04-06 Produce Order Press and Understudy.txt'),
  ('2026-04-13', 'Press', 'frilly mustard', 4.0, 'lg', 12.0, 'src: 04-09 Harvest Plan Edible Flowers, Herbs, and Greens — Quantities and Packaging.txt'),
  ('2026-04-13', 'Press', 'frilly mustard', 1.0, 'lg', 12.0, 'src: 04-09 Harvest Plan Edible Flowers, Herbs, and Greens — Quantities and Packaging.txt'),
  ('2026-04-13', 'Press', 'hikari turnips', 1.0, 'lg', NULL, 'src: 04-11 Harvest List 2026-03-14.txt'),
  ('2026-04-13', 'Press', 'mint', 1.0, 'sm', 10.0, 'src: 04-11 Harvest List Edible Flowers, Herbs, and Greens.txt'),
  ('2026-04-13', 'Press', 'nasturtium', 50.0, 'ea', 0.3, 'src: 04-11 Task List Produce Prep and Offsite Event Orders (Flowers, Leaves, Greens) - March 7.txt'),
  ('2026-04-13', 'Press', 'nasturtium', 2.0, 'lg', 15.0, 'src: 04-11 Task List Produce Prep and Offsite Event Orders (Flowers, Leaves, Greens) - March 7.txt'),
  ('2026-04-13', 'Press', 'Onion Blossoms', 1.0, 'lg', 24.0, 'src: 04-17 Harvest Schedule Edible Flowers, Herbs, Greens, and Vegetables — To-Go and Bin Counts.txt'),
  ('2026-04-13', 'Press', 'Onion Blossoms', 1.0, 'sm', NULL, 'src: 04-18 Harvest Plan Edible Flowers, Herbs, and Greens — Quantities and Packaging.txt'),
  ('2026-04-13', 'Press', 'Peas', 1.0, 'lg', 15.0, 'src: 04-25 Harvest List Edible Flowers, Herbs, Greens.txt'),
  ('2026-04-13', 'Press', 'Radish', 500.0, 'ea', 0.5, 'src: 04-27 List Harvest Plan - Edible Flowers & Greens.txt'),
  ('2026-04-13', 'Press', 'Radish Flowers', 2.0, 'qt', 15.0, 'src: 05-02 Harvest List Edible Flowers, Herbs, Greens, and Vegetables.txt'),
  ('2026-04-16', 'Press', 'Bachelor Button', 1.0, 'sm', 10.0, 'src: 04-02 Order Fulfillment Michael Breedlove – Produce & Edible Flowers (April 2).txt'),
  ('2026-04-16', 'Press', 'chrysanthemum', 1.0, 'sm', 6.0, 'src: 04-02 Task List Restaurant Harvest Orders.txt'),
  ('2026-04-16', 'Press', 'Fennel', 1.0, 'lg', 30.0, 'src: 04-04 Harvest List Edible Flowers, Herbs, Greens, and Vegetables.txt'),
  ('2026-04-16', 'Press', 'gem marigold', 1.0, 'sm', NULL, 'src: 04-11 Harvest List 2026-03-14.txt'),
  ('2026-04-16', 'Press', 'gem marigold leaves', 1.0, 'sm', NULL, 'src: 04-11 Harvest List 2026-03-14.txt'),
  ('2026-04-16', 'Press', 'ice plant', 1.0, 'sm', NULL, 'src: 04-11 Harvest List 2026-03-14.txt'),
  ('2026-04-16', 'Press', 'lettuce', 2.0, 'gb', NULL, 'src: 04-11 Harvest List Edible Flowers & Greens.txt'),
  ('2026-04-16', 'Press', 'mint', 1.0, 'sm', 10.0, 'src: 04-11 Harvest List Edible Flowers, Herbs, and Greens_1.txt'),
  ('2026-04-16', 'Press', 'nasturtium', 50.0, 'sm', 7.5, 'src: 04-11 Task List Produce Prep and Offsite Event Orders (Flowers, Leaves, Greens) - March 7.txt'),
  ('2026-04-16', 'Press', 'Nasturtium Flower', 1.0, 'lg', 15.0, 'src: 04-16 Harvest List Edible Flowers, Herbs & Greens.txt'),
  ('2026-04-16', 'Press', 'Nasturtium Flower', 1.0, 'sm', 7.5, 'src: 04-16 Harvest List Edible Flowers, Herbs & Greens.txt'),
  ('2026-04-16', 'Press', 'Nasturtium', 2.0, 'lg', NULL, 'src: 04-16 Harvest Log Edible Flowers, Herbs, and Greens — Small To-Go Prep.txt'),
  ('2026-04-16', 'Press', 'New Zealand Spinach', 1.0, 'lg', 15.0, 'src: 04-17 Harvest Schedule Edible Flowers, Herbs, Greens, and Vegetables — To-Go and Bin Counts.txt'),
  ('2026-04-16', 'Press', 'New Zealand Spinach', 1.0, 'sm', 7.5, 'Bronze | src: 04-17 Harvest Schedule Edible Flowers, Herbs, Greens, and Vegetables — To-Go and Bin Counts.txt'),
  ('2026-04-16', 'Press', 'oxalis', 1.0, 'sm', 6.0, 'src: 04-20 List Harvest List.txt'),
  ('2026-04-16', 'Press', 'Purple Stardust', 1.0, 'sm', NULL, 'src: 04-27 List Harvest Plan - Edible Flowers & Greens.txt'),
  ('2026-04-16', 'Press', 'Radish Flowers', 2.0, 'qt', 15.0, 'src: 05-02 Harvest List Edible Flowers, Herbs, Greens, and Vegetables.txt'),
  ('2026-04-16', 'Press', 'radish pods', 1.0, 'sm', 12.5, 'src: 05-02 Harvest List Edible Flowers, Herbs, Greens, and Vegetables.txt'),
  ('2026-04-16', 'Press', 'radish', 60.0, 'sm', NULL, 'src: 05-02 Harvest List Edible Flowers, Herbs, Greens, and Vegetables.txt'),
  ('2026-04-16', 'Press', 'society garlic', 1.0, 'sm', NULL, 'src: 05-04 Harvest List Edible Flowers, Herbs, and Greens for May 4, 2026.txt'),
  ('2026-04-16', 'Press', 'society garlic', 1.0, 'sm', NULL, 'src: 05-04 Harvest List May 4 Edible Flowers, Herbs, and Salad Mix.txt'),
  ('2026-04-16', 'Press', 'society garlic', 1.0, 'sm', NULL, 'src: 05-04 Harvest List May 4 Edible Flowers, Herbs, and Salad Mix.txt'),
  ('2026-04-16', 'Press', 'violas', 1.0, 'sm', 15.0, 'Green | src: 05-04 Harvest List May 4 Edible Flowers, Herbs, and Salad Mix.txt'),
  ('2026-04-16', 'Press', 'violas', 1.0, 'sm', 15.0, 'Bronze | src: 05-04 Harvest List May 4 Edible Flowers, Herbs, and Salad Mix.txt'),
  ('2026-04-17', 'Understudy', 'Fennel', 1.0, 'sm', 15.0, 'src: 04-04 Harvest List Edible Flowers, Herbs, Greens, and Vegetables.txt'),
  ('2026-04-17', 'Understudy', 'frilly mustard', 1.0, 'lg', 12.0, 'src: 04-11 Delivery Order Press - March 26th.txt'),
  ('2026-04-17', 'Understudy', 'hikari turnips', 300.0, 'ea', NULL, 'src: 04-11 Harvest List 2026-03-14.txt'),
  ('2026-04-17', 'Understudy', 'Mint', 1.0, 'sm', 10.0, 'src: 04-11 Inventory Checklist Edible Flowers, Herbs, and Greens — March 23, 2026.txt'),
  ('2026-04-17', 'Understudy', 'nasturtium', 50.0, 'ea', 0.3, 'src: 04-16 Harvest List Edible Flowers, Herbs & Greens.txt'),
  ('2026-04-17', 'Understudy', 'Peas', 1.0, 'sm', 7.5, 'src: 04-25 Harvest List Edible Flowers, Herbs, Greens.txt'),
  ('2026-04-17', 'Understudy', 'Pineapple Mint', 1.0, 'sm', 10.0, 'src: 04-25 Harvest List Edible Flowers, Herbs, Greens.txt'),
  ('2026-04-17', 'Understudy', 'Radish', 300.0, 'ea', 0.5, 'src: 04-30 Harvest List Edible Flowers & Herbs.txt'),
  ('2026-04-17', 'Understudy', 'rosemary', 1.0, 'lg', 10.0, 'src: 05-04 Harvest List Edible Flowers, Herbs, and Greens for May 4, 2026.txt'),
  ('2026-04-17', 'Understudy', 'Salad Mix Large Leaf', 1.0, 'gb', 72.0, 'src: 05-04 Harvest List Edible Flowers, Herbs, and Greens for May 4, 2026.txt'),
  ('2026-04-17', 'Understudy', 'Salad Mix Large Leaf', 1.0, 'gb', 72.0, 'src: 05-04 Harvest List Edible Flowers, Herbs, and Greens for May 4, 2026.txt'),
  ('2026-04-18', 'Press', 'nasturtium', 50.0, 'ea', 0.3, 'src: 04-13 Harvest Schedule Edible Flowers & Greens Order Fulfillment.txt'),
  ('2026-04-18', 'Press', 'oxalis', 1.0, 'sm', 6.0, 'Tiny | src: 04-20 List Harvest List.txt'),
  ('2026-04-18', 'Press', 'Peas', 1.0, 'gb', 90.0, 'src: 04-25 Harvest List Edible Flowers, Herbs, Greens.txt'),
  ('2026-04-18', 'Press', 'Radish', 1.0, 'gb', 150.0, 'src: 04-27 List Harvest Plan - Edible Flowers & Greens.txt'),
  ('2026-04-18', 'Press', 'Radish Flowers', 2.0, 'qt', 15.0, 'no-unit-detected | src: 05-02 Harvest List Edible Flowers, Herbs, Greens, and Vegetables.txt'),
  ('2026-04-18', 'Press', 'violas', 1.0, 'sm', 15.0, 'src: 05-04 Harvest List May 4 Edible Flowers, Herbs, and Salad Mix.txt'),
  ('2026-04-20', 'Press', 'Fava Leaf', 1.0, 'lg', 12.0, 'src: 04-02 Task List Restaurant Harvest Orders.txt'),
  ('2026-04-20', 'Understudy', 'fennel', 1.0, 'sm', 15.0, 'src: 04-04 Harvest List Edible Flowers, Herbs, Greens, and Vegetables.txt'),
  ('2026-04-20', 'Understudy', 'forget-me-nots', 1.0, 'sm', 12.0, 'src: 04-06 Produce Order Press and Understudy.txt'),
  ('2026-04-20', 'Press', 'mint', 1.0, 'lg', 20.0, 'src: 04-11 Harvest List Edible Flowers, Herbs, and Greens_1.txt'),
  ('2026-04-20', 'Press', 'nasturtium', 50.0, 'ea', 0.3, 'src: 04-13 Harvest Schedule Edible Flowers & Greens Order Fulfillment.txt'),
  ('2026-04-20', 'Understudy', 'nasturtium', 50.0, 'ea', 0.3, 'src: 04-16 Harvest List Edible Flowers, Herbs & Greens.txt'),
  ('2026-04-20', 'Understudy', 'Nasturtium Flower', 1.0, 'lg', 15.0, 'src: 04-16 Harvest Log Edible Flowers, Herbs, and Greens — Small To-Go Prep.txt'),
  ('2026-04-20', 'Press', 'oxalis', 1.0, 'lg', 12.0, 'src: 04-20 List Harvest List.txt'),
  ('2026-04-20', 'Press', 'Peas', 3.0, 'lg', 15.0, 'src: 04-25 Harvest List Edible Flowers, Herbs, Greens.txt'),
  ('2026-04-20', 'Understudy', 'Salad Mix Large Leaf', 2.0, 'lg', 12.0, 'src: 05-04 Harvest List Edible Flowers, Herbs, and Greens for May 4, 2026.txt'),
  ('2026-04-20', 'Understudy', 'society garlic', 1.0, 'sm', 10.0, 'src: 05-04 Harvest List Edible Flowers, Herbs, and Greens for May 4, 2026.txt'),
  ('2026-04-20', 'Press', 'violas', 1.0, 'sm', 15.0, 'src: 05-04 Harvest List May 4 Edible Flowers, Herbs, and Salad Mix.txt'),
  ('2026-04-23', 'Press', 'gem marigold', 1.0, 'sm', NULL, 'src: 04-11 Harvest List 2026-03-14.txt'),
  ('2026-04-23', 'Press', 'lettuce', 1.0, 'gb', NULL, 'src: 04-11 Harvest List Edible Flowers & Greens.txt'),
  ('2026-04-23', 'Press', 'Nasturtium', 2.0, 'sm', NULL, 'src: 04-11 Order Preparation March 12 Press Order - Flowers, Leaves, Greens, Packaging and Quantities.txt'),
  ('2026-04-23', 'Press', 'Nasturtium', 2.0, 'sm', NULL, 'Bronze | src: 04-16 Harvest List Edible Flowers, Herbs & Greens.txt'),
  ('2026-04-23', 'Press', 'Nasturtium', 2.0, 'lg', NULL, 'src: 04-16 Harvest List Edible Flowers, Herbs & Greens.txt'),
  ('2026-04-23', 'Press', 'Oxalis', 2.0, 'lg', NULL, 'src: 04-18 Harvest Plan Edible Flowers, Herbs, and Greens — Quantities and Packaging.txt'),
  ('2026-04-23', 'Press', 'Purple Stardust', 1.0, 'sm', 7.5, 'src: 04-27 List Harvest Plan - Edible Flowers & Greens.txt'),
  ('2026-04-25', 'Press', 'aptenia', 100.0, 'ea', 0.3, 'src: 04-02 Order Fulfillment Michael Breedlove – Produce & Edible Flowers (April 2).txt'),
  ('2026-04-25', 'Press', 'Bachelor Button', 1.0, 'sm', 10.0, 'src: 04-02 Order Fulfillment Michael Breedlove – Produce & Edible Flowers (April 2).txt'),
  ('2026-04-25', 'Press', 'Fava Leaf', 2.0, 'lg', 12.0, 'src: 04-04 Harvest List Edible Flowers, Herbs, Greens, and Vegetables.txt'),
  ('2026-04-25', 'Press', 'Lettuce', 1.0, 'gb', 120.0, 'src: 04-11 Harvest List 2026-03-14.txt'),
  ('2026-04-25', 'Press', 'mint', 1.0, 'sm', 10.0, 'src: 04-11 Harvest List Edible Flowers, Herbs, and Greens_1.txt'),
  ('2026-04-25', 'Press', 'nasturtium', 100.0, 'ea', 0.3, 'src: 04-13 Harvest Schedule Edible Flowers & Greens Order Fulfillment.txt'),
  ('2026-04-25', 'Press', 'nasturtium', 3.0, 'lg', 15.0, 'src: 04-13 Harvest Schedule Edible Flowers & Greens Order Fulfillment.txt'),
  ('2026-04-25', 'Press', 'Nasturtium Flower', 1.0, 'lg', 15.0, 'src: 04-16 Harvest List Edible Flowers, Herbs & Greens.txt'),
  ('2026-04-25', 'Press', 'society garlic', 1.0, 'lg', 20.0, 'src: 05-04 Harvest List Edible Flowers, Herbs, and Greens for May 4, 2026.txt'),
  ('2026-04-27', 'Press', 'Fava Leaf', 1.0, 'lg', 12.0, 'src: 04-04 Harvest List Edible Flowers, Herbs, Greens, and Vegetables.txt'),
  ('2026-04-27', 'Press', 'fennel flowers', 1.0, 'lg', NULL, 'src: 04-06 Produce Order Press and Understudy.txt'),
  ('2026-04-27', 'Press', 'hikari turnips', 1.0, 'lg', NULL, 'src: 04-11 Harvest List 2026-03-14.txt'),
  ('2026-04-27', 'Press', 'hikari turnips', 1.0, 'lg', NULL, 'src: 04-11 Harvest List 2026-03-14.txt'),
  ('2026-04-27', 'Press', 'large red veined sorrel leaves', 1.0, 'lg', NULL, 'src: 04-11 Harvest List 2026-03-14.txt'),
  ('2026-04-27', 'Press', 'Lettuce', 1.0, 'lg', 20.0, 'src: 04-11 Harvest List 2026-03-14.txt'),
  ('2026-04-27', 'Press', 'Lettuce', 1.0, 'lg', 20.0, 'src: 04-11 Harvest List Edible Flowers & Greens.txt'),
  ('2026-04-27', 'Press', 'mint', 1.0, 'sm', 10.0, 'src: 04-11 Harvest List Edible Flowers, Herbs, and Greens_1.txt'),
  ('2026-04-27', 'Press', 'nasturtium', 100.0, 'ea', 0.3, 'src: 04-13 Harvest Schedule Edible Flowers & Greens Order Fulfillment.txt'),
  ('2026-04-27', 'Press', 'society garlic', 1.0, 'lg', 20.0, 'src: 05-04 Harvest List Edible Flowers, Herbs, and Greens for May 4, 2026.txt'),
  ('2026-04-30', 'Press', 'borage', 1.0, 'sm', 8.0, 'src: 04-02 Order Fulfillment Michael Breedlove – Produce & Edible Flowers (April 2).txt'),
  ('2026-04-30', 'Press', 'Fava Leaf', 2.0, 'lg', 12.0, 'src: 04-04 Harvest List Edible Flowers, Herbs, Greens, and Vegetables.txt'),
  ('2026-04-30', 'Press', 'mint', 2.0, 'lg', 20.0, 'src: 04-11 Harvest List Edible Flowers, Herbs, and Greens_1.txt'),
  ('2026-04-30', 'Press', 'nasturtium', 100.0, 'ea', 0.3, 'Green | src: 04-13 Harvest Schedule Edible Flowers & Greens Order Fulfillment.txt'),
  ('2026-04-30', 'Press', 'Nasturtium', 2.0, 'lg', 15.0, 'Bronze | src: 04-13 Harvest Schedule Edible Flowers & Greens Order Fulfillment.txt'),
  ('2026-04-30', 'Press', 'oxalis', 1.0, 'lg', 12.0, 'src: 04-20 List Harvest List.txt'),
  ('2026-05-02', 'Press', 'aptenia', 1.0, 'lg', 15.0, 'src: 04-02 Order Fulfillment Michael Breedlove – Produce & Edible Flowers (April 2).txt'),
  ('2026-05-02', 'Press', 'Bachelor Button', 1.0, 'sm', 10.0, 'src: 04-02 Order Fulfillment Michael Breedlove – Produce & Edible Flowers (April 2).txt'),
  ('2026-05-02', 'Press', 'Fennel', 1.0, 'sm', 15.0, 'src: 04-04 Harvest List Edible Flowers, Herbs, Greens, and Vegetables.txt'),
  ('2026-05-02', 'Press', 'Garlic scapes', 20.0, 'ea', NULL, 'src: 04-11 Delivery Order Press - March 26th.txt'),
  ('2026-05-02', 'Press', 'gem marigold', 1.0, 'sm', 12.0, 'src: 04-11 Delivery Order Press - March 26th.txt'),
  ('2026-05-02', 'Press', 'lettuce', 1.0, 'gb', 120.0, 'src: 04-11 Harvest List Edible Flowers & Greens.txt'),
  ('2026-05-02', 'Press', 'mint', 1.0, 'lg', 20.0, 'src: 04-11 Harvest List Edible Flowers, Herbs, and Greens_1.txt'),
  ('2026-05-02', 'Press', 'nasturtium', 100.0, 'ea', 0.3, 'src: 04-13 Harvest Schedule Edible Flowers & Greens Order Fulfillment.txt'),
  ('2026-05-02', 'Press', 'Nasturtium', 1.0, 'lg', 15.0, 'src: 04-13 Harvest Schedule Edible Flowers & Greens Order Fulfillment.txt'),
  ('2026-05-02', 'Press', 'Nasturtium Flower', 2.0, 'lg', 15.0, 'src: 04-16 Harvest List Edible Flowers, Herbs & Greens.txt'),
  ('2026-05-02', 'Press', 'New Zealand Spinach', 1.0, 'lg', 15.0, 'src: 04-17 Harvest Schedule Edible Flowers, Herbs, Greens, and Vegetables — To-Go and Bin Counts.txt'),
  ('2026-05-02', 'Press', 'oxalis', 2.0, 'lg', 12.0, 'src: 04-20 List Harvest List.txt'),
  ('2026-05-02', 'Press', 'pea flowers', 1.0, 'sm', 15.0, 'src: 04-23 Harvest List Edible Flowers, Herbs, Greens.txt'),
  ('2026-05-02', 'Press', 'Purple Stardust', 1.0, 'sm', 7.5, 'src: 04-27 List Harvest Plan - Edible Flowers & Greens.txt'),
  ('2026-05-02', 'Press', 'Radish', 50.0, 'ea', 0.5, 'src: 04-27 List Harvest Plan - Edible Flowers & Greens.txt'),
  ('2026-05-02', 'Press', 'Salad Mix Large Leaf', 2.0, 'lg', NULL, 'src: 05-04 Harvest List Edible Flowers, Herbs, and Greens for May 4, 2026.txt'),
  ('2026-05-02', 'Press', 'Sample', 1.0, 'ea', NULL, 'Bronze | src: 05-04 Harvest List Edible Flowers, Herbs, and Greens for May 4, 2026.txt'),
  ('2026-05-02', 'Press', 'society garlic', 1.0, 'lg', 20.0, 'src: 05-04 Harvest List Edible Flowers, Herbs, and Greens for May 4, 2026.txt'),
  ('2026-05-04', 'Understudy', 'anise hyssop', 1.0, 'lg', 12.0, 'src: 04-02 Order Fulfillment Michael Breedlove – Produce & Edible Flowers (April 2).txt'),
  ('2026-05-04', 'Understudy', 'Aptenia', 1.0, 'lg', 15.0, 'src: 04-02 Order Fulfillment Michael Breedlove – Produce & Edible Flowers (April 2).txt'),
  ('2026-05-04', 'Press', 'Fava Leaf', 1.0, 'lg', 12.0, 'src: 04-04 Harvest List Edible Flowers, Herbs, Greens, and Vegetables.txt'),
  ('2026-05-04', 'Understudy', 'Fennel', 1.0, 'sm', 15.0, 'src: 04-04 Harvest List Edible Flowers, Herbs, Greens, and Vegetables.txt'),
  ('2026-05-04', 'Understudy', 'Fennel', 1.0, 'sm', 15.0, 'src: 04-06 Produce Order Press and Understudy.txt'),
  ('2026-05-04', 'Understudy', 'Fennel', 1.0, 'sm', 15.0, 'src: 04-06 Produce Order Press and Understudy.txt'),
  ('2026-05-04', 'Understudy', 'Fennel', 1.0, 'sm', 15.0, 'src: 04-06 Produce Order Press and Understudy.txt'),
  ('2026-05-04', 'Press', 'gem marigold', 1.0, 'sm', 12.0, 'src: 04-11 Harvest List 2026-03-14.txt'),
  ('2026-05-04', 'Understudy', 'gem marigold', 1.0, 'sm', 12.0, 'src: 04-11 Harvest List 2026-03-14.txt'),
  ('2026-05-04', 'Understudy', 'gem marigold', 1.0, 'sm', 12.0, 'src: 04-11 Harvest List 2026-03-14.txt'),
  ('2026-05-04', 'Press', 'lemon balm', 1.0, 'lg', 10.0, 'src: 04-11 Harvest List 2026-03-14.txt'),
  ('2026-05-04', 'Press', 'lettuce', 3.0, 'gb', 120.0, 'src: 04-11 Harvest List Edible Flowers & Greens.txt'),
  ('2026-05-04', 'Press', 'mint', 1.0, 'lg', 20.0, 'src: 04-11 Inventory Checklist Edible Flowers, Herbs, and Greens — March 23, 2026.txt'),
  ('2026-05-04', 'Press', 'nasturtium', 100.0, 'ea', 0.3, 'src: 04-13 Harvest Schedule Edible Flowers & Greens Order Fulfillment.txt'),
  ('2026-05-04', 'Understudy', 'nasturtium', 100.0, 'ea', 0.3, 'src: 04-16 Harvest List Edible Flowers, Herbs & Greens.txt'),
  ('2026-05-04', 'Understudy', 'nasturtium', 100.0, 'ea', 0.3, 'src: 04-16 Harvest List Edible Flowers, Herbs & Greens.txt'),
  ('2026-05-04', 'Press', 'Nasturtium Flower', 1.0, 'lg', 15.0, 'src: 04-16 Harvest List Edible Flowers, Herbs & Greens.txt'),
  ('2026-05-04', 'Understudy', 'Nasturtium Flower', 1.0, 'lg', 15.0, 'src: 04-16 Harvest Log Edible Flowers, Herbs, and Greens — Small To-Go Prep.txt'),
  ('2026-05-04', 'Understudy', 'Nasturtium Flower', 1.0, 'lg', 15.0, 'src: 04-16 Harvest Log Edible Flowers, Herbs, and Greens — Small To-Go Prep.txt'),
  ('2026-05-04', 'Press', 'New Zealand Spinach', 1.0, 'lg', 15.0, 'src: 04-17 Harvest Schedule Edible Flowers, Herbs, Greens, and Vegetables — To-Go and Bin Counts.txt'),
  ('2026-05-04', 'Press', 'oxalis', 1.0, 'lg', 12.0, 'src: 04-20 List Harvest List.txt'),
  ('2026-05-04', 'Understudy', 'Pineapple Mint', 1.0, 'sm', 10.0, 'src: 04-25 Harvest List Edible Flowers, Herbs, Greens.txt'),
  ('2026-05-04', 'Understudy', 'Pineapple Mint', 1.0, 'sm', 10.0, 'src: 04-27 List Harvest Plan - Edible Flowers & Greens.txt'),
  ('2026-05-04', 'Press', 'Purple Stardust', 2.0, 'lg', 15.0, 'src: 04-27 List Harvest Plan - Edible Flowers & Greens.txt'),
  ('2026-05-04', 'Understudy', 'Radish', 500.0, 'ea', 0.5, 'src: 04-30 Harvest List Edible Flowers & Herbs.txt'),
  ('2026-05-04', 'Understudy', 'rosemary', 1.0, 'lg', 10.0, 'src: 05-04 Harvest List Edible Flowers, Herbs, and Greens for May 4, 2026.txt'),
  ('2026-05-04', 'Understudy', 'rosemary', 1.0, 'lg', 10.0, 'src: 05-04 Harvest List Edible Flowers, Herbs, and Greens for May 4, 2026.txt'),
  ('2026-05-04', 'Understudy', 'Salad Mix Large Leaf', 1.0, 'lg', 15.0, 'src: 05-04 Harvest List Edible Flowers, Herbs, and Greens for May 4, 2026.txt'),
  ('2026-05-04', 'Understudy', 'Salad Mix Large Leaf', 1.0, 'sm', NULL, 'src: 05-04 Harvest List Edible Flowers, Herbs, and Greens for May 4, 2026.txt'),
  ('2026-05-04', 'Press', 'Salad Mix Large Leaf', 2.0, 'lg', NULL, 'Green | src: 05-04 Harvest List Edible Flowers, Herbs, and Greens for May 4, 2026.txt'),
  ('2026-05-04', 'Understudy', 'society garlic', 1.0, 'sm', 10.0, 'src: 05-04 Harvest List May 4 Edible Flowers, Herbs, and Salad Mix.txt'),
  ('2026-05-04', 'Understudy', 'society garlic', 1.0, 'sm', 10.0, 'src: 05-04 Harvest List May 4 Edible Flowers, Herbs, and Salad Mix.txt')
;

-- =====================================================================
-- 2. Auto-create missing items (case-insensitive match across all categories)
-- =====================================================================
INSERT INTO items (farm_id, name, category, unit_type)
SELECT DISTINCT
  (SELECT id FROM farms LIMIT 1),
  TRIM(s.item_name),
  'flowers',
  COALESCE(NULLIF(s.unit, ''), 'sm')
FROM _stg_deliv s
WHERE TRIM(s.item_name) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM items i
    WHERE LOWER(TRIM(i.name)) = LOWER(TRIM(s.item_name))
  );

-- =====================================================================
-- 3. Auto-create missing delivery_dates
-- =====================================================================
INSERT INTO delivery_dates (date, day_of_week, ordering_open)
SELECT DISTINCT
  s.delivery_date,
  CASE EXTRACT(DOW FROM s.delivery_date)
    WHEN 1 THEN 'monday'
    WHEN 4 THEN 'thursday'
    WHEN 6 THEN 'saturday'
    ELSE 'custom'
  END,
  false
FROM _stg_deliv s
ON CONFLICT (date) DO NOTHING;

-- =====================================================================
-- 4. Upsert deliveries (one per date + restaurant)
-- =====================================================================
INSERT INTO deliveries (delivery_date, restaurant_id, status)
SELECT DISTINCT
  s.delivery_date,
  r.id,
  'logged'
FROM _stg_deliv s
JOIN restaurants r ON LOWER(r.name) = LOWER(s.restaurant_name)
ON CONFLICT (delivery_date, restaurant_id) DO NOTHING;

-- =====================================================================
-- 5. Wipe + reinsert delivery_items for the affected (date, restaurant)
--    pairs so the migration is idempotent on re-run.
-- =====================================================================
DELETE FROM delivery_items di
USING deliveries d
WHERE di.delivery_id = d.id
  AND (d.delivery_date, d.restaurant_id) IN (
    SELECT DISTINCT s.delivery_date, r.id
    FROM _stg_deliv s
    JOIN restaurants r ON LOWER(r.name) = LOWER(s.restaurant_name)
  );

INSERT INTO delivery_items (delivery_id, item_id, quantity, unit, unit_price, bonus_note)
SELECT
  d.id,
  i.id,
  s.quantity,
  s.unit,
  COALESCE(s.unit_price, 0),
  NULLIF(s.notes, '')
FROM _stg_deliv s
JOIN restaurants r ON LOWER(r.name) = LOWER(s.restaurant_name)
JOIN deliveries d
  ON d.delivery_date = s.delivery_date AND d.restaurant_id = r.id
JOIN LATERAL (
  -- Prefer non-archived; otherwise just the first match. Items with the
  -- same name across categories (e.g. "Cilantro" pre-migration-037) get
  -- an arbitrary pick — financial roll-up only cares about name + price.
  SELECT id FROM items
  WHERE LOWER(TRIM(name)) = LOWER(TRIM(s.item_name))
  ORDER BY is_archived ASC NULLS LAST, created_at ASC
  LIMIT 1
) i ON true;

COMMIT;

-- Sanity counts (run separately after COMMIT if you want to verify):
--   SELECT COUNT(*) FROM deliveries WHERE delivery_date BETWEEN '2026-03-07' AND '2026-05-04';
--   SELECT COUNT(*) FROM delivery_items di
--     JOIN deliveries d ON d.id = di.delivery_id
--    WHERE d.delivery_date BETWEEN '2026-03-07' AND '2026-05-04';
