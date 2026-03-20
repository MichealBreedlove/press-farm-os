-- ============================================
-- Press Farm OS — Migration 002: Row Level Security
-- ============================================

-- Enable RLS on all tables
ALTER TABLE farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Helper functions
-- ============================================

-- Check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Get restaurant IDs for current user
CREATE OR REPLACE FUNCTION user_restaurant_ids()
RETURNS SETOF uuid AS $$
  SELECT restaurant_id FROM restaurant_users
  WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================
-- farms
-- ============================================
CREATE POLICY "Authenticated users can view farms" ON farms
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage farms" ON farms
  FOR ALL USING (is_admin());

-- ============================================
-- restaurants
-- ============================================
CREATE POLICY "Authenticated users can view restaurants" ON restaurants
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage restaurants" ON restaurants
  FOR ALL USING (is_admin());

-- ============================================
-- profiles
-- ============================================
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (id = auth.uid() OR is_admin());

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Admin can manage profiles" ON profiles
  FOR ALL USING (is_admin());

-- ============================================
-- restaurant_users
-- ============================================
CREATE POLICY "Users can view own restaurant assignment" ON restaurant_users
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Admin can manage restaurant users" ON restaurant_users
  FOR ALL USING (is_admin());

-- ============================================
-- items
-- ============================================
CREATE POLICY "Authenticated users can view active items" ON items
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_archived = false);

CREATE POLICY "Admin can view all items including archived" ON items
  FOR SELECT USING (is_admin());

CREATE POLICY "Admin can manage items" ON items
  FOR ALL USING (is_admin());

-- ============================================
-- delivery_dates
-- ============================================
CREATE POLICY "Authenticated users can view delivery dates" ON delivery_dates
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage delivery dates" ON delivery_dates
  FOR ALL USING (is_admin());

-- ============================================
-- availability_items
-- ============================================
CREATE POLICY "Chefs see own restaurant availability" ON availability_items
  FOR SELECT USING (
    restaurant_id IN (SELECT user_restaurant_ids())
    OR is_admin()
  );

CREATE POLICY "Admin can manage availability" ON availability_items
  FOR ALL USING (is_admin());

-- ============================================
-- orders
-- ============================================
CREATE POLICY "Chefs can view own restaurant orders" ON orders
  FOR SELECT USING (
    restaurant_id IN (SELECT user_restaurant_ids())
    OR is_admin()
  );

CREATE POLICY "Chefs can insert orders for own restaurant" ON orders
  FOR INSERT WITH CHECK (
    restaurant_id IN (SELECT user_restaurant_ids())
  );

CREATE POLICY "Chefs can update open orders for own restaurant" ON orders
  FOR UPDATE USING (
    restaurant_id IN (SELECT user_restaurant_ids())
    AND closed_for_ordering = false
  );

CREATE POLICY "Admin can manage orders" ON orders
  FOR ALL USING (is_admin());

-- ============================================
-- order_items
-- ============================================
CREATE POLICY "Users can view order items for own restaurant" ON order_items
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders
      WHERE restaurant_id IN (SELECT user_restaurant_ids())
    )
    OR is_admin()
  );

CREATE POLICY "Chefs can manage order items for open orders" ON order_items
  FOR ALL USING (
    order_id IN (
      SELECT id FROM orders
      WHERE restaurant_id IN (SELECT user_restaurant_ids())
      AND closed_for_ordering = false
    )
    OR is_admin()
  );
