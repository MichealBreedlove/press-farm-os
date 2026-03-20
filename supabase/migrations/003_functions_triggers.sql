-- ============================================
-- Press Farm OS — Migration 003: Functions & Triggers
-- ============================================

-- ============================================
-- Reusable updated_at trigger function
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON farms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON restaurants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON availability_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Auto-create profile on auth.users insert
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'chef')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- Auto-update delivery total when delivery_items change
-- (defined here, trigger created in 005 after deliveries table exists)
-- ============================================
CREATE OR REPLACE FUNCTION update_delivery_total()
RETURNS trigger AS $$
BEGIN
  UPDATE deliveries
  SET
    total_value = (
      SELECT COALESCE(SUM(line_total), 0)
      FROM delivery_items
      WHERE delivery_id = COALESCE(NEW.delivery_id, OLD.delivery_id)
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.delivery_id, OLD.delivery_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
