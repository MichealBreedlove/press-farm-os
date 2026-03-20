-- ============================================
-- Press Farm OS — Migration 001: Initial Schema
-- Tables: farms, restaurants, profiles, restaurant_users,
--         items, delivery_dates, availability_items,
--         orders, order_items
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. farms
-- ============================================
CREATE TABLE farms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  monthly_operating_cost decimal(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 2. restaurants
-- ============================================
CREATE TABLE restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 3. profiles (extends auth.users)
-- ============================================
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  role text NOT NULL DEFAULT 'chef' CHECK (role IN ('admin', 'chef')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 4. restaurant_users (join table)
-- ============================================
CREATE TABLE restaurant_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, restaurant_id)
);

-- ============================================
-- 5. items (master catalog)
-- ============================================
CREATE TABLE items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('flowers', 'micros_leaves', 'herbs_leaves', 'fruit_veg', 'kits')),
  unit_type text NOT NULL CHECK (unit_type IN ('ea', 'sm', 'lg', 'lbs', 'bu', 'qt', 'bx', 'cs', 'pt', 'kit')),
  default_price decimal(10,2),
  chef_notes text,
  internal_notes text,
  source text,
  is_archived boolean NOT NULL DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_farm ON items(farm_id);
CREATE INDEX idx_items_archived ON items(is_archived);

-- ============================================
-- 6. delivery_dates
-- ============================================
CREATE TABLE delivery_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  day_of_week text NOT NULL CHECK (day_of_week IN ('thursday', 'saturday', 'monday', 'custom')),
  ordering_open boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_dates_date ON delivery_dates(date);
CREATE INDEX idx_delivery_dates_ordering_open ON delivery_dates(ordering_open);

-- ============================================
-- 7. availability_items
-- ============================================
CREATE TABLE availability_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  delivery_date date NOT NULL REFERENCES delivery_dates(date) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'limited', 'unavailable')),
  limited_qty decimal(10,2),
  cycle_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(item_id, restaurant_id, delivery_date)
);

CREATE INDEX idx_availability_restaurant_date ON availability_items(restaurant_id, delivery_date);
CREATE INDEX idx_availability_item ON availability_items(item_id);
CREATE INDEX idx_availability_status ON availability_items(status);

-- ============================================
-- 8. orders
-- ============================================
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  chef_id uuid NOT NULL REFERENCES profiles(id),
  delivery_date date NOT NULL REFERENCES delivery_dates(date),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'in_progress', 'fulfilled', 'cancelled')),
  freeform_notes text,
  submitted_at timestamptz,
  fulfilled_at timestamptz,
  closed_for_ordering boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, delivery_date)
);

CREATE INDEX idx_orders_delivery_date ON orders(delivery_date);
CREATE INDEX idx_orders_chef ON orders(chef_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_restaurant_date ON orders(restaurant_id, delivery_date);

-- ============================================
-- 9. order_items
-- ============================================
CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  availability_item_id uuid NOT NULL REFERENCES availability_items(id),
  quantity_requested decimal(10,2) NOT NULL,
  quantity_fulfilled decimal(10,2),
  is_shorted boolean NOT NULL DEFAULT false,
  shortage_reason text,
  unit_price_at_order decimal(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_availability ON order_items(availability_item_id);
