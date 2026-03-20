# Press Farm OS — Database Schema

**Version:** 2.0
**Date:** 2026-03-19
**Database:** Supabase (PostgreSQL 15+)
**Auth:** Supabase Auth (built-in `auth.users` table)
**Updated:** Incorporates Daily Delivery Tracking Sheet structure (289-item KEY tab, delivery logging, financial reporting)

---

## Entity Relationship Overview

```
farms 1──M restaurants
restaurants 1──M restaurant_users (join table)
auth.users 1──M restaurant_users
items 1──M availability_items
restaurants 1──M availability_items
restaurants 1──M orders
auth.users 1──M orders (chef)
orders 1──M order_items
availability_items 1──M order_items
items 1──M price_history
items 1──M price_catalog
orders 1──M notifications
deliveries 1──M delivery_items
items 1──M delivery_items
farms 1──M farm_expenses
financial_periods (view) ── aggregates deliveries + farm_expenses
```

---

## Table Definitions

### 1. `farms`

The farm entity. Phase 1 has exactly one row. Future-proofed for 10-acre expansion.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `name` | text | NO | | "Press Farm" |
| `address` | text | YES | | "22 Tallent Lane, Yountville, CA" |
| `monthly_operating_cost` | decimal(10,2) | YES | | ~2000.00. Admin updates monthly. |
| `created_at` | timestamptz | NO | `now()` | |
| `updated_at` | timestamptz | NO | `now()` | |

### 2. `restaurants`

Two rows: Press and Understudy. Linked to farm.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `farm_id` | uuid | NO | | FK → `farms.id` |
| `name` | text | NO | | "Press" or "Understudy" |
| `slug` | text | NO | | "press" or "understudy". URL-safe. Unique. |
| `created_at` | timestamptz | NO | `now()` | |
| `updated_at` | timestamptz | NO | `now()` | |

### 3. `profiles`

Extends Supabase `auth.users` with app-specific fields. Created via trigger on auth.users insert.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | | PK. Same as `auth.users.id`. |
| `full_name` | text | YES | | Display name |
| `role` | text | NO | `'chef'` | `admin` or `chef` |
| `is_active` | boolean | NO | `true` | Admin can deactivate |
| `created_at` | timestamptz | NO | `now()` | |
| `updated_at` | timestamptz | NO | `now()` | |

### 4. `restaurant_users`

Join table: which users belong to which restaurant(s). Admin has rows for both. Chefs have one.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `user_id` | uuid | NO | | FK → `profiles.id` |
| `restaurant_id` | uuid | NO | | FK → `restaurants.id` |
| `created_at` | timestamptz | NO | `now()` | |

**Unique constraint:** `(user_id, restaurant_id)`

### 5. `items`

Master item catalog. Shared across restaurants. Availability is managed separately.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `farm_id` | uuid | NO | | FK → `farms.id` |
| `name` | text | NO | | e.g., "Nasturtium (Dime-Nickel)" |
| `category` | text | NO | | Enum enforced via CHECK |
| `unit_type` | text | NO | | Enum enforced via CHECK |
| `default_price` | decimal(10,2) | YES | | Market-equivalent $/unit |
| `chef_notes` | text | YES | | Visible to chefs. e.g., "Wild Harvest Unpredictable" |
| `internal_notes` | text | YES | | Admin-only. e.g., "Cover Crop" |
| `source` | text | YES | | e.g., "Peters Farm" |
| `is_archived` | boolean | NO | `false` | Soft delete |
| `sort_order` | integer | YES | `0` | For manual ordering within category |
| `created_at` | timestamptz | NO | `now()` | |
| `updated_at` | timestamptz | NO | `now()` | |

**CHECK constraints:**
- `category IN ('flowers', 'micros_leaves', 'herbs_leaves', 'fruit_veg', 'kits')`
- `unit_type IN ('ea', 'sm', 'lg', 'lbs', 'bu', 'qt', 'bx', 'cs', 'pt', 'kit')`

> **Seed data:** 289 items from the Daily Delivery Tracking Sheet KEY tab should be imported as initial item catalog data. Each item has a name, unit type, and price per unit.

### 6. `availability_items`

Per-restaurant, per-delivery-date availability. This is the core table that replaces the Excel color-coded rows.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `item_id` | uuid | NO | | FK → `items.id` |
| `restaurant_id` | uuid | NO | | FK → `restaurants.id` |
| `delivery_date` | date | NO | | Thu, Sat, or Mon |
| `status` | text | NO | `'available'` | `available`, `limited`, `unavailable` |
| `limited_qty` | decimal(10,2) | YES | | Only meaningful when status = `limited` |
| `cycle_notes` | text | YES | | Per-cycle chef-facing note override |
| `created_at` | timestamptz | NO | `now()` | |
| `updated_at` | timestamptz | NO | `now()` | |

**Unique constraint:** `(item_id, restaurant_id, delivery_date)`

**CHECK constraint:** `status IN ('available', 'limited', 'unavailable')`

### 7. `orders`

One order per restaurant per delivery date. Chefs can edit until admin closes ordering.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `restaurant_id` | uuid | NO | | FK → `restaurants.id` |
| `chef_id` | uuid | NO | | FK → `profiles.id` |
| `delivery_date` | date | NO | | |
| `status` | text | NO | `'draft'` | `draft`, `submitted`, `in_progress`, `fulfilled`, `cancelled` |
| `freeform_notes` | text | YES | | Bottom-of-order special requests |
| `submitted_at` | timestamptz | YES | | |
| `fulfilled_at` | timestamptz | YES | | |
| `closed_for_ordering` | boolean | NO | `false` | Admin locks when starting fulfillment |
| `created_at` | timestamptz | NO | `now()` | |
| `updated_at` | timestamptz | NO | `now()` | |

**Unique constraint:** `(restaurant_id, delivery_date)`

**CHECK constraint:** `status IN ('draft', 'submitted', 'in_progress', 'fulfilled', 'cancelled')`

### 8. `order_items`

Individual line items within an order.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `order_id` | uuid | NO | | FK → `orders.id` ON DELETE CASCADE |
| `availability_item_id` | uuid | NO | | FK → `availability_items.id` |
| `quantity_requested` | decimal(10,2) | NO | | What chef asked for |
| `quantity_fulfilled` | decimal(10,2) | YES | | What was delivered. NULL until fulfillment. |
| `is_shorted` | boolean | NO | `false` | |
| `shortage_reason` | text | YES | | e.g., "Pest damage" |
| `unit_price_at_order` | decimal(10,2) | YES | | Snapshot from items.default_price at order time |
| `created_at` | timestamptz | NO | `now()` | |
| `updated_at` | timestamptz | NO | `now()` | |

### 9. `price_history`

Audit trail of price changes for value tracking accuracy.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `item_id` | uuid | NO | | FK → `items.id` |
| `price` | decimal(10,2) | NO | | |
| `effective_date` | date | NO | | |
| `set_by` | uuid | NO | | FK → `profiles.id` |
| `created_at` | timestamptz | NO | `now()` | |

### 10. `price_catalog`

The authoritative price list. Imported from the KEY tab (289 items). Replaces reliance on `items.default_price` — supports per-unit pricing where an item can have different prices for different units.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `item_id` | uuid | NO | | FK → `items.id` |
| `unit` | text | NO | | Enum: ea, sm, lg, lbs, bu, qt, bx, cs, pt, kit |
| `price_per_unit` | decimal(10,2) | NO | | Market-equivalent price |
| `effective_date` | date | NO | `CURRENT_DATE` | When this price became active |
| `source` | text | NO | `'market'` | `market` (market-equivalent) or `custom` (Micheal override) |
| `created_at` | timestamptz | NO | `now()` | |

**Unique constraint:** `(item_id, unit, effective_date)`

**CHECK constraint:** `unit IN ('ea', 'sm', 'lg', 'lbs', 'bu', 'qt', 'bx', 'cs', 'pt', 'kit')`

**CHECK constraint:** `source IN ('market', 'custom')`

> **Query pattern:** To get the current price for an item+unit, SELECT price_per_unit WHERE item_id = X AND unit = Y ORDER BY effective_date DESC LIMIT 1.

### 11. `deliveries`

Tracks actual deliveries made. One row per delivery date per restaurant. Source: DELIVERY TRACKER tab structure.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `delivery_date` | date | NO | | Date of delivery |
| `restaurant_id` | uuid | NO | | FK → `restaurants.id` |
| `status` | text | NO | `'pending'` | `pending`, `logged`, `finalized` |
| `total_value` | decimal(10,2) | YES | | Auto-calculated: SUM of delivery_items.line_total |
| `notes` | text | YES | | Optional delivery-level notes |
| `created_at` | timestamptz | NO | `now()` | |
| `updated_at` | timestamptz | NO | `now()` | |

**Unique constraint:** `(delivery_date, restaurant_id)`

**CHECK constraint:** `status IN ('pending', 'logged', 'finalized')`

### 12. `delivery_items`

Individual line items within a delivery. Mirrors the DELIVERY TRACKER tab columns: Date, Item, Quantity, Unit, Price, Total.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `delivery_id` | uuid | NO | | FK → `deliveries.id` ON DELETE CASCADE |
| `item_id` | uuid | NO | | FK → `items.id` |
| `quantity` | decimal(10,2) | NO | | Amount delivered |
| `unit` | text | NO | | Enum: ea, sm, lg, lbs, bu, qt, bx, cs, pt, kit |
| `unit_price` | decimal(10,2) | NO | | Price per unit (auto-filled from price_catalog, editable) |
| `line_total` | decimal(10,2) | NO | | Auto-calculated: quantity × unit_price |
| `created_at` | timestamptz | NO | `now()` | |

**CHECK constraint:** `unit IN ('ea', 'sm', 'lg', 'lbs', 'bu', 'qt', 'bx', 'cs', 'pt', 'kit')`

### 13. `farm_expenses`

Operating cost tracking. Source: Farm Expenses tab in Daily Delivery Tracking Sheet.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `farm_id` | uuid | NO | | FK → `farms.id` |
| `date` | date | NO | | When expense occurred |
| `category` | text | NO | | e.g., Seeds, Soil, Equipment, Gas, Supplies |
| `description` | text | YES | | What was purchased |
| `amount` | decimal(10,2) | NO | | Cost |
| `receipt_url` | text | YES | | Optional link to receipt image (Phase 2) |
| `created_at` | timestamptz | NO | `now()` | |
| `updated_at` | timestamptz | NO | `now()` | |

### 14. `financial_periods` (VIEW)

Materialized view for monthly/quarterly financial rollups. Combines delivery values and expenses.

```sql
CREATE OR REPLACE VIEW financial_periods AS
SELECT
  date_trunc('month', d.delivery_date) AS period_start,
  'monthly' AS period_type,
  d.restaurant_id,
  r.name AS restaurant_name,
  SUM(d.total_value) AS total_delivery_value,
  (SELECT COALESCE(SUM(fe.amount), 0)
   FROM farm_expenses fe
   WHERE date_trunc('month', fe.date) = date_trunc('month', d.delivery_date)
  ) AS total_expenses,
  COUNT(DISTINCT d.delivery_date) AS delivery_count
FROM deliveries d
JOIN restaurants r ON r.id = d.restaurant_id
WHERE d.status = 'finalized'
GROUP BY date_trunc('month', d.delivery_date), d.restaurant_id, r.name;
```

> **Income statement benchmark:** Q1 2026 from Daily Delivery Tracking Sheet = $21,633 production value / $1,536 expenses / $12K farmer pay.

### 15. `notifications`

Log of all notifications sent. Useful for debugging delivery issues.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `type` | text | NO | | `order_submitted`, `order_confirmed`, `shortage`, `fulfilled`, `availability_published` |
| `recipient_id` | uuid | NO | | FK → `profiles.id` |
| `order_id` | uuid | YES | | FK → `orders.id`. NULL for availability notifications. |
| `channel` | text | NO | `'email'` | `email` (Phase 1), `sms` (Phase 2) |
| `subject` | text | YES | | Email subject line |
| `body_preview` | text | YES | | First 200 chars of body |
| `sent_at` | timestamptz | YES | | NULL if failed |
| `error` | text | YES | | Error message if send failed |
| `created_at` | timestamptz | NO | `now()` | |

### 11. `delivery_dates`

Tracks delivery date metadata. Allows admin to open/close ordering per date.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `date` | date | NO | | UNIQUE |
| `day_of_week` | text | NO | | `thursday`, `saturday`, `monday` |
| `ordering_open` | boolean | NO | `true` | Admin can close ordering |
| `created_at` | timestamptz | NO | `now()` | |

---

## SQL CREATE TABLE Statements

```sql
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

-- Trigger: auto-create profile on auth.users insert
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

-- ============================================
-- 6. delivery_dates
-- ============================================
CREATE TABLE delivery_dates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  day_of_week text NOT NULL CHECK (day_of_week IN ('thursday', 'saturday', 'monday')),
  ordering_open boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_dates_date ON delivery_dates(date);

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

-- ============================================
-- 10. price_history
-- ============================================
CREATE TABLE price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  price decimal(10,2) NOT NULL,
  effective_date date NOT NULL,
  set_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_price_history_item ON price_history(item_id);

-- ============================================
-- 11. notifications
-- ============================================
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('order_submitted', 'order_confirmed', 'shortage', 'fulfilled', 'availability_published')),
  recipient_id uuid NOT NULL REFERENCES profiles(id),
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms')),
  subject text,
  body_preview text,
  sent_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX idx_notifications_order ON notifications(order_id);
CREATE INDEX idx_notifications_type ON notifications(type);

-- ============================================
-- 12. price_catalog (KEY tab import target)
-- ============================================
CREATE TABLE price_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  unit text NOT NULL CHECK (unit IN ('ea', 'sm', 'lg', 'lbs', 'bu', 'qt', 'bx', 'cs', 'pt', 'kit')),
  price_per_unit decimal(10,2) NOT NULL,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  source text NOT NULL DEFAULT 'market' CHECK (source IN ('market', 'custom')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(item_id, unit, effective_date)
);

CREATE INDEX idx_price_catalog_item_unit ON price_catalog(item_id, unit);
CREATE INDEX idx_price_catalog_effective ON price_catalog(effective_date);

-- ============================================
-- 13. deliveries (DELIVERY TRACKER replacement)
-- ============================================
CREATE TABLE deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_date date NOT NULL,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'logged', 'finalized')),
  total_value decimal(10,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(delivery_date, restaurant_id)
);

CREATE INDEX idx_deliveries_date ON deliveries(delivery_date);
CREATE INDEX idx_deliveries_restaurant ON deliveries(restaurant_id);
CREATE INDEX idx_deliveries_status ON deliveries(status);

-- ============================================
-- 14. delivery_items (line items per delivery)
-- ============================================
CREATE TABLE delivery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id),
  quantity decimal(10,2) NOT NULL,
  unit text NOT NULL CHECK (unit IN ('ea', 'sm', 'lg', 'lbs', 'bu', 'qt', 'bx', 'cs', 'pt', 'kit')),
  unit_price decimal(10,2) NOT NULL,
  line_total decimal(10,2) NOT NULL GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_items_delivery ON delivery_items(delivery_id);
CREATE INDEX idx_delivery_items_item ON delivery_items(item_id);

-- Trigger: auto-update deliveries.total_value when delivery_items change
CREATE OR REPLACE FUNCTION update_delivery_total()
RETURNS trigger AS $$
BEGIN
  UPDATE deliveries
  SET total_value = (
    SELECT COALESCE(SUM(line_total), 0)
    FROM delivery_items
    WHERE delivery_id = COALESCE(NEW.delivery_id, OLD.delivery_id)
  ),
  updated_at = now()
  WHERE id = COALESCE(NEW.delivery_id, OLD.delivery_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER recalc_delivery_total
  AFTER INSERT OR UPDATE OR DELETE ON delivery_items
  FOR EACH ROW EXECUTE FUNCTION update_delivery_total();

-- ============================================
-- 15. farm_expenses
-- ============================================
CREATE TABLE farm_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  date date NOT NULL,
  category text NOT NULL,
  description text,
  amount decimal(10,2) NOT NULL,
  receipt_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_farm_expenses_date ON farm_expenses(date);
CREATE INDEX idx_farm_expenses_farm ON farm_expenses(farm_id);
CREATE INDEX idx_farm_expenses_category ON farm_expenses(category);

-- ============================================
-- 16. financial_periods (VIEW)
-- ============================================
CREATE OR REPLACE VIEW financial_periods AS
SELECT
  date_trunc('month', d.delivery_date) AS period_start,
  'monthly' AS period_type,
  d.restaurant_id,
  r.name AS restaurant_name,
  SUM(d.total_value) AS total_delivery_value,
  (SELECT COALESCE(SUM(fe.amount), 0)
   FROM farm_expenses fe
   WHERE date_trunc('month', fe.date) = date_trunc('month', d.delivery_date)
  ) AS total_expenses,
  COUNT(DISTINCT d.delivery_date) AS delivery_count
FROM deliveries d
JOIN restaurants r ON r.id = d.restaurant_id
WHERE d.status = 'finalized'
GROUP BY date_trunc('month', d.delivery_date), d.restaurant_id, r.name;

-- ============================================
-- Row Level Security (RLS)
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
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper function: check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function: get restaurant IDs for current user
CREATE OR REPLACE FUNCTION user_restaurant_ids()
RETURNS SETOF uuid AS $$
  SELECT restaurant_id FROM restaurant_users
  WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles: users can read their own, admins can read all
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (id = auth.uid() OR is_admin());

CREATE POLICY "Admin can update profiles" ON profiles
  FOR UPDATE USING (is_admin());

-- Restaurants: all authenticated users can read
CREATE POLICY "Authenticated users can view restaurants" ON restaurants
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Items: all authenticated users can read non-archived items
CREATE POLICY "Authenticated users can view items" ON items
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_archived = false);

CREATE POLICY "Admin can manage items" ON items
  FOR ALL USING (is_admin());

-- Availability: chefs see their restaurant only, admin sees all
CREATE POLICY "Chefs see own restaurant availability" ON availability_items
  FOR SELECT USING (
    restaurant_id IN (SELECT user_restaurant_ids())
    OR is_admin()
  );

CREATE POLICY "Admin can manage availability" ON availability_items
  FOR ALL USING (is_admin());

-- Orders: chefs see/edit their restaurant's orders, admin sees all
CREATE POLICY "Chefs can view own restaurant orders" ON orders
  FOR SELECT USING (
    restaurant_id IN (SELECT user_restaurant_ids())
    OR is_admin()
  );

CREATE POLICY "Chefs can insert orders for own restaurant" ON orders
  FOR INSERT WITH CHECK (
    restaurant_id IN (SELECT user_restaurant_ids())
  );

CREATE POLICY "Chefs can update own restaurant orders" ON orders
  FOR UPDATE USING (
    restaurant_id IN (SELECT user_restaurant_ids())
    AND closed_for_ordering = false
  );

CREATE POLICY "Admin can manage orders" ON orders
  FOR ALL USING (is_admin());

-- Order items: follow parent order's access
CREATE POLICY "Users can view order items" ON order_items
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM orders
      WHERE restaurant_id IN (SELECT user_restaurant_ids())
    )
    OR is_admin()
  );

CREATE POLICY "Chefs can manage order items" ON order_items
  FOR ALL USING (
    order_id IN (
      SELECT id FROM orders
      WHERE restaurant_id IN (SELECT user_restaurant_ids())
      AND closed_for_ordering = false
    )
    OR is_admin()
  );

-- Notifications: users see their own
CREATE POLICY "Users see own notifications" ON notifications
  FOR SELECT USING (recipient_id = auth.uid() OR is_admin());

-- Delivery dates: all authenticated can read
CREATE POLICY "Authenticated users can view delivery dates" ON delivery_dates
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage delivery dates" ON delivery_dates
  FOR ALL USING (is_admin());

-- Price history: admin only
CREATE POLICY "Admin can manage price history" ON price_history
  FOR ALL USING (is_admin());

-- Farms: all authenticated can read
CREATE POLICY "Authenticated users can view farms" ON farms
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage farms" ON farms
  FOR ALL USING (is_admin());

-- Restaurant users: admin manages, users can see own
CREATE POLICY "Users can view own restaurant assignment" ON restaurant_users
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Admin can manage restaurant users" ON restaurant_users
  FOR ALL USING (is_admin());

-- Price catalog: all authenticated can read, admin manages
CREATE POLICY "Authenticated users can view price catalog" ON price_catalog
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin can manage price catalog" ON price_catalog
  FOR ALL USING (is_admin());

-- Deliveries: admin only (chefs don't see delivery tracking)
CREATE POLICY "Admin can manage deliveries" ON deliveries
  FOR ALL USING (is_admin());

-- Delivery items: admin only
CREATE POLICY "Admin can manage delivery items" ON delivery_items
  FOR ALL USING (is_admin());

-- Farm expenses: admin only
CREATE POLICY "Admin can manage farm expenses" ON farm_expenses
  FOR ALL USING (is_admin());

-- ============================================
-- Updated_at trigger (reusable)
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON farms FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON restaurants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON availability_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON deliveries FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON farm_expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Seed Data
-- ============================================
INSERT INTO farms (name, address, monthly_operating_cost)
VALUES ('Press Farm', '22 Tallent Lane, Yountville, CA', 2000.00);

INSERT INTO restaurants (farm_id, name, slug)
VALUES
  ((SELECT id FROM farms LIMIT 1), 'Press', 'press'),
  ((SELECT id FROM farms LIMIT 1), 'Understudy', 'understudy');
```

---

## Schema Diagram (Text)

```
┌──────────┐     ┌──────────────┐     ┌─────────────────┐
│  farms   │────<│ restaurants  │────<│ restaurant_users│
└──────────┘     └──────────────┘     └────────┬────────┘
     │                  │                       │
     │                  │                  ┌────┴────┐
     │                  │                  │profiles │
     │                  │                  └────┬────┘
     │                  │                       │
┌────┴────┐     ┌──────┴──────────┐      ┌─────┴─────┐
│  items  │────<│availability_items│     │  orders   │
└────┬────┘     └────────┬────────┘     └─────┬─────┘
     │                   │                     │
┌────┴──────────┐  ┌─────┴──────┐       ┌─────┴──────┐
│ price_history │  │order_items │<──────│order_items │
└───────────────┘  └────────────┘       └────────────┘
                                              │
                                        ┌─────┴───────┐
                                        │notifications│
                                        └─────────────┘
```
