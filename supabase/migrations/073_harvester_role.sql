-- 073: Harvester role
--
-- Adds a fourth role 'harvester' for farm crew who work the pick list.
-- Harvesters see ONE thing: the combined harvest list for a delivery date
-- (the same cross-restaurant grid at the top of /admin/orders/[date]) plus
-- the ability to add extra items to a delivery during pick-and-pack.
-- They can't see prices, orders, reports, or anything else — their portal
-- is /harvest, bilingual English/Spanish.
--
-- Harvester accounts don't need a restaurant_users assignment (they pick
-- for every restaurant at once).
--
-- APPLIED to prod 2026-07-18 via the Supabase MCP (as two tracked
-- migrations: harvester_role + harvester_role_private_helper). This file is
-- the consolidated net result.
--
-- NOTE: prod's role-helper functions (is_admin / is_receiver /
-- user_restaurant_ids) were moved into a `private` schema by an untracked
-- hardening pass — private isn't exposed through PostgREST, search_path is
-- pinned empty, and EXECUTE is limited to authenticated. is_harvester
-- follows that live pattern, not the older public-schema style of 024.

-- 1. Update the role CHECK constraint to allow 'harvester'.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'chef', 'receiver', 'harvester'));

-- 2. Helper: is the current user an active harvester?
CREATE OR REPLACE FUNCTION private.is_harvester()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (select auth.uid()) AND role = 'harvester' AND is_active = true
  );
$$;

REVOKE EXECUTE ON FUNCTION private.is_harvester() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_harvester() TO authenticated;

-- 3. RLS — harvesters get SELECT-only access to the ordering context the
--    harvest list is built from. No write policies: the add-extra flow goes
--    through /api/orders/[orderId]/extras, which role-gates server-side and
--    writes with the service-role client (same pattern as the receiver
--    dashboard reads).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Harvesters can read orders' AND tablename = 'orders') THEN
    CREATE POLICY "Harvesters can read orders" ON orders
      FOR SELECT USING (private.is_harvester());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Harvesters can read order_items' AND tablename = 'order_items') THEN
    CREATE POLICY "Harvesters can read order_items" ON order_items
      FOR SELECT USING (private.is_harvester());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Harvesters can read availability_items' AND tablename = 'availability_items') THEN
    CREATE POLICY "Harvesters can read availability_items" ON availability_items
      FOR SELECT USING (private.is_harvester());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Harvesters can read items' AND tablename = 'items') THEN
    CREATE POLICY "Harvesters can read items" ON items
      FOR SELECT USING (private.is_harvester());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Harvesters can read restaurants' AND tablename = 'restaurants') THEN
    CREATE POLICY "Harvesters can read restaurants" ON restaurants
      FOR SELECT USING (private.is_harvester());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Harvesters can read delivery_dates' AND tablename = 'delivery_dates') THEN
    CREATE POLICY "Harvesters can read delivery_dates" ON delivery_dates
      FOR SELECT USING (private.is_harvester());
  END IF;

  -- deliveries + delivery_items so the /harvest page can show the extras
  -- (is_bonus lines) already added for the date.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Harvesters can read deliveries' AND tablename = 'deliveries') THEN
    CREATE POLICY "Harvesters can read deliveries" ON deliveries
      FOR SELECT USING (private.is_harvester());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Harvesters can read delivery_items' AND tablename = 'delivery_items') THEN
    CREATE POLICY "Harvesters can read delivery_items" ON delivery_items
      FOR SELECT USING (private.is_harvester());
  END IF;
END $$;
