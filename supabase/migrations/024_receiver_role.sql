-- 024: Receiver role
--
-- Adds a third role 'receiver' for the person at the destination who unpacks
-- the delivery. Receivers see ALL incoming for the day across both restaurants
-- + events, with status (ready / short / extra), but they can't place orders or
-- edit anything. Receiver accounts don't need a restaurant_users assignment.

-- 1. Update the role CHECK constraint to allow 'receiver'.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'chef', 'receiver'));

-- 2. Helper: is the current user a receiver?
CREATE OR REPLACE FUNCTION is_receiver()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'receiver' AND is_active = true
  );
$$;

-- 3. RLS — receivers get SELECT-only access to delivery + ordering context
--    so they can see what's coming, what shorted, what's extra.
--    They have NO write access anywhere (no INSERT/UPDATE/DELETE policy).
DO $$
BEGIN
  -- deliveries
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Receivers can read deliveries' AND tablename = 'deliveries') THEN
    CREATE POLICY "Receivers can read deliveries" ON deliveries
      FOR SELECT USING (is_receiver());
  END IF;

  -- delivery_items
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Receivers can read delivery_items' AND tablename = 'delivery_items') THEN
    CREATE POLICY "Receivers can read delivery_items" ON delivery_items
      FOR SELECT USING (is_receiver());
  END IF;

  -- restaurants (so receivers can label deliveries by restaurant)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Receivers can read restaurants' AND tablename = 'restaurants') THEN
    CREATE POLICY "Receivers can read restaurants" ON restaurants
      FOR SELECT USING (is_receiver());
  END IF;

  -- items (names, categories, flower images)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Receivers can read items' AND tablename = 'items') THEN
    CREATE POLICY "Receivers can read items" ON items
      FOR SELECT USING (is_receiver());
  END IF;

  -- orders + order_items (so the dashboard can compute "ordered vs delivered")
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Receivers can read orders' AND tablename = 'orders') THEN
    CREATE POLICY "Receivers can read orders" ON orders
      FOR SELECT USING (is_receiver());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Receivers can read order_items' AND tablename = 'order_items') THEN
    CREATE POLICY "Receivers can read order_items" ON order_items
      FOR SELECT USING (is_receiver());
  END IF;

  -- availability_items (so we can resolve which item an order_item refers to)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Receivers can read availability_items' AND tablename = 'availability_items') THEN
    CREATE POLICY "Receivers can read availability_items" ON availability_items
      FOR SELECT USING (is_receiver());
  END IF;

  -- delivery_dates (date listing for the picker)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Receivers can read delivery_dates' AND tablename = 'delivery_dates') THEN
    CREATE POLICY "Receivers can read delivery_dates" ON delivery_dates
      FOR SELECT USING (is_receiver());
  END IF;
END $$;
