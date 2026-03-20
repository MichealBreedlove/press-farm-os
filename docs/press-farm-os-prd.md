# Press Farm OS — Product Requirements Document (PRD)

**Version:** 2.0
**Date:** 2026-03-19
**Author:** Micheal Breedlove
**Status:** Phase 1 Spec (Updated with PRESS Kitchen file analysis)

---

## 1. Product Overview

Press Farm OS is a farm-to-kitchen ordering and availability management system for Press Farm (Yountville, CA). It replaces two separate SharePoint Excel order sheets with a web app that lets chefs order produce and lets the farm operator manage availability, fulfill orders, and track produce value.

**Core problem:** Manual Excel files with color-coded rows, no notifications, no mobile access, no audit trail.

**Core solution:** Mobile-first web app with per-restaurant availability portals, freeform ordering, email notifications, and monthly value reporting.

---

## 2. User Personas

| Persona | Name | Role | Device | Usage Pattern |
|---------|------|------|--------|---------------|
| Admin | Micheal Breedlove | Solo farm operator | iPhone (primary), restaurant desktop (secondary) | Updates availability, reviews orders, marks shortages, runs reports. On phone at farm, desktop when inside. |
| Chef (Press) | Rotating staff (1-2) | Press kitchen | Restaurant computer or phone | Places orders night before delivery. Rotating staff — needs frictionless auth. |
| Chef (Understudy) | Rotating staff (1-2) | Understudy kitchen | Restaurant computer or phone | Same as Press chef but sees different item catalog. |

---

## 3. User Stories

### 3.1 Admin (Micheal)

| ID | Story | Priority |
|----|-------|----------|
| A-1 | As admin, I can update item availability (available/limited/unavailable) per restaurant so chefs see accurate info. | P0 |
| A-2 | As admin, I can add/edit/archive items in the master catalog with name, category, unit type, and notes. | P0 |
| A-3 | As admin, I can duplicate last cycle's availability to quickly set up the next delivery window. | P0 |
| A-4 | As admin, I receive email notification when a chef submits an order. | P0 |
| A-5 | As admin, I can view all orders for the current delivery date, grouped by restaurant. | P0 |
| A-6 | As admin, I can mark individual order line items as shorted with a reason. | P0 |
| A-7 | As admin, I can mark an order as fulfilled. | P0 |
| A-8 | As admin, I can set market-equivalent prices per item for value tracking. | P0 |
| A-9 | As admin, I can generate a monthly value report showing total produce value delivered per restaurant. | P0 |
| A-14 | As admin, I can log a delivery with line items (item, qty, unit, price, total) matching the Daily Delivery Tracking Sheet structure. | P0 |
| A-15 | As admin, I can view per-delivery value (sum of all line items for a delivery date). | P0 |
| A-16 | As admin, I can view EOM (end of month) running totals. | P0 |
| A-17 | As admin, I can view quarterly income statements (production value vs. expenses vs. farmer pay). | P1 |
| A-18 | As admin, I can track farm expenses (date, category, description, amount). | P0 |
| A-19 | As admin, I can view "Most Ordered Items" analysis (by frequency and volume). | P1 |
| A-20 | As admin, I can import the 289-item price catalog from the KEY tab as seed data. | P0 (one-time migration) |
| A-21 | As admin, I can import historical delivery data from the DELIVERY TRACKER tab. | P1 (one-time migration) |
| A-10 | As admin, I can manage chef accounts (invite via magic link, deactivate). | P0 |
| A-11 | As admin, I can add internal notes per item (not visible to chefs). | P0 |
| A-12 | As admin, I can set which items are visible to which restaurant. | P0 |
| A-13 | As admin, I can view order history with filters (date range, restaurant). | P1 |

### 3.2 Chef

| ID | Story | Priority |
|----|-------|----------|
| C-1 | As a chef, I can log in via magic link (email) without a password. | P0 |
| C-2 | As a chef, I can view available items for my restaurant with availability status and notes. | P0 |
| C-3 | As a chef, I can enter a quantity for each item I want to order. | P0 |
| C-4 | As a chef, I can add a freeform notes/special requests section to my order. | P0 |
| C-5 | As a chef, I receive email confirmation when my order is submitted. | P0 |
| C-6 | As a chef, I receive email notification when items are shorted with the reason. | P0 |
| C-7 | As a chef, I can view my past orders. | P1 |
| C-8 | As a chef, I can see which items are limited quantity vs. fully available. | P0 |

---

## 4. Feature Requirements

### 4.1 Item Catalog Management

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | text | Yes | e.g., "Nasturtium (Dime-Nickel)" |
| `category` | enum | Yes | Flowers, Micros-Leaves, Herbs/Leaves, Fruit/Veg, Kits |
| `unit_type` | enum | Yes | EA, SM (Small To Go), LG (Large To Go), LBS, BU (bunch), QT, BX (box), CS (case), PT (pint), Kit |
| `chef_notes` | text | No | Visible to chefs. e.g., "Wild Harvest Unpredictable" |
| `internal_notes` | text | No | Admin-only. e.g., "Cover Crop" |
| `default_price` | decimal | No | Market-equivalent price per unit for value tracking |
| `source` | text | No | e.g., "Peters Farm", "Press planters only" |
| `is_archived` | boolean | No | Soft delete — hides from availability but keeps history |

**Categories (Phase 1):**

| Category | Examples |
|----------|----------|
| Flowers | Alyssum (50ct), Mustard Flowers, Chrysanthemum, Nasturtium varieties, Borage, Calendula, Marigold |
| Micros-Leaves | Fava Leaves, Chickweed, Oxalis, Tatsoi, Pea Tendrils |
| Herbs/Leaves | Bay Leaf varieties, Mint varieties (Chocolate, Spearmint, Pineapple, Strawberry, Japanese), Rosemary, Sage, Thyme |
| Fruit/Veg | Radish (Cherry Belle), Kale varieties, Turnips, Beans |
| Kits | Salad Mix varieties, custom kits |

**Unit Types (expanded from Daily Delivery Tracking Sheet KEY tab):**

| Unit | Code | Description |
|------|------|-------------|
| Each | EA | Individual count (e.g., 400 Nasturtium Leaves) |
| Small To Go | SM | Small takeout container |
| Large To Go | LG | Large takeout container |
| Pounds | LBS | Weight-based (e.g., root vegetables) |
| Bunch | BU | Bundled herbs/greens |
| Quart | QT | Quart container |
| Box | BX | Box quantity |
| Case | CS | Full case |
| Pint | PT | Pint container |
| Kit | Kit | Pre-assembled salad/garnish kit |

> **Note:** Units sourced from the 289-item KEY tab in the Daily Delivery Tracking Sheet. The system must support all 9 unit types at launch.

### 4.2 Availability Management

Each delivery cycle, the admin publishes an availability list per restaurant. This is the bridge between the master item catalog and what chefs can actually order.

| Field | Type | Notes |
|-------|------|-------|
| `item_id` | FK → items | Which item |
| `restaurant_id` | FK → restaurants | Which restaurant (Press or Understudy) |
| `delivery_date` | date | Thu, Sat, or Mon |
| `status` | enum | `available`, `limited`, `unavailable` |
| `limited_qty` | integer | Only set when status = `limited`. Max orderable. |
| `cycle_notes` | text | Optional per-cycle override notes for chefs |

**Key behaviors:**

1. Items marked `unavailable` appear greyed out with strikethrough (replaces red rows in Excel).
2. Items marked `limited` show a yellow badge with max qty (replaces orange rows in Excel).
3. Items marked `available` show green/normal — no quantity cap.
4. Admin can bulk-duplicate a previous delivery date's availability to a new date ("Duplicate last cycle" button).
5. Availability is per-restaurant — Press may have items Understudy doesn't, and vice versa.
6. The delivery schedule is fixed: Thursday, Saturday, Monday. The app shows the next upcoming delivery date by default.

### 4.3 Ordering Workflow

**Order placement window:** No hard cutoff time. Chefs order "night before" delivery. Orders lock when admin begins fulfillment (admin manually closes ordering for a delivery date).

| Field | Type | Notes |
|-------|------|-------|
| `order_id` | uuid | PK |
| `restaurant_id` | FK | Which restaurant |
| `chef_id` | FK → users | Who placed it |
| `delivery_date` | date | Which delivery date |
| `status` | enum | `draft`, `submitted`, `in_progress`, `fulfilled`, `cancelled` |
| `submitted_at` | timestamp | When chef submitted |
| `fulfilled_at` | timestamp | When admin marked fulfilled |
| `freeform_notes` | text | Bottom-of-order notes (e.g., "50ea tiny turnips") |

**Order line items:**

| Field | Type | Notes |
|-------|------|-------|
| `order_item_id` | uuid | PK |
| `order_id` | FK | Parent order |
| `availability_item_id` | FK | Links to specific availability entry |
| `quantity_requested` | decimal | What chef asked for (supports 0.5, etc.) |
| `quantity_fulfilled` | decimal | What was actually delivered (null until fulfilled) |
| `is_shorted` | boolean | True if fulfilled < requested |
| `shortage_reason` | text | e.g., "Pest damage", "Low yield this week" |
| `unit_price_at_order` | decimal | Snapshot of price at time of order for value tracking |

**Ordering rules:**
1. Chef can only order items with status `available` or `limited` for their restaurant.
2. If item is `limited`, quantity cannot exceed `limited_qty`.
3. Chef can order fractional quantities (e.g., 0.5 Qt).
4. Each restaurant gets one order per delivery date (subsequent submissions update the existing order).
5. Orders can be edited until admin closes the ordering window.

### 4.4 Notification Specs

| Trigger | Recipient | Channel | Content |
|---------|-----------|---------|---------|
| Chef submits order | Admin (Micheal) | Email (Resend) | Order summary: restaurant, delivery date, line items with quantities, freeform notes |
| Chef submits order | Chef | Email (Resend) | Order confirmation: your order for [date], line items, notes |
| Admin shorts item(s) | Chef who ordered | Email (Resend) | Shortage notice: item name, requested qty, fulfilled qty, reason |
| Admin marks order fulfilled | Chef | Email (Resend) | Fulfillment confirmation: final quantities delivered |
| Availability published | All chefs for that restaurant | Email (Resend) | New availability posted for [date] — link to order |

**Phase 2 additions:** Twilio SMS for shortage notifications (morning sous chef text).

### 4.5 Value Tracking & Reporting

**Purpose:** Demonstrate produce value to justify farm operating costs. Q1 2026 benchmark from Daily Delivery Tracking Sheet: $21,633 in farm production value against $1,536 in expenses and $12K farmer pay.

| Metric | Calculation |
|--------|-------------|
| Order value | SUM(quantity_fulfilled × unit_price_at_order) per order |
| Delivery value | SUM of all delivery_items line_total for a delivery date (see §4.6) |
| EOM running total | Cumulative delivery value through the current month |
| Monthly value (per restaurant) | SUM of all delivery values in the month |
| Monthly value (total) | Press + Understudy monthly totals |
| Quarterly income | Total production value − total expenses − farmer pay |
| Cost ratio | Monthly produce value ÷ monthly operating cost |

**Monthly report includes:**
1. Total value delivered (broken down by restaurant)
2. Top 10 items by value
3. Top 10 items by quantity ordered
4. Most ordered items analysis (frequency + volume)
5. Comparison to previous month
6. Operating cost + expense tracking (from farm_expenses table)
7. Value-to-cost ratio
8. EOM running total

> **Data source:** Value calculations use delivery_items (§4.6) as the primary source, NOT order fulfillment data. Deliveries are what actually left the farm — orders are what was requested.

### 4.6 Delivery Tracking

**Source:** Daily Delivery Tracking Sheet — the master financial tracking system currently in Excel.

Each delivery is logged as a set of line items. This replaces the DELIVERY TRACKER tab.

| Field | Type | Notes |
|-------|------|-------|
| `delivery_date` | date | Date of delivery |
| `restaurant_id` | FK | Which restaurant received the delivery |
| `status` | enum | `pending`, `logged`, `finalized` |
| `total_value` | decimal | Auto-calculated: SUM of line_total across all items |
| `notes` | text | Optional delivery-level notes |

**Delivery line items:**

| Field | Type | Notes |
|-------|------|-------|
| `item_id` | FK → items | Which item delivered |
| `quantity` | decimal | Amount delivered |
| `unit` | enum | EA, SM, LG, LBS, BU, QT, BX, CS, PT |
| `unit_price` | decimal | Price per unit (pulled from price catalog, editable per line) |
| `line_total` | decimal | Auto-calculated: quantity × unit_price |

**Key behaviors:**

1. After fulfilling an order, Micheal logs what was actually delivered. This may differ from order quantities.
2. Unit price auto-fills from the price catalog (KEY tab data) but can be overridden per line.
3. Per-delivery value = SUM of all line_total values for that delivery date.
4. EOM (end of month) running total displayed on dashboard — accumulates through the month.
5. Historical data: the DELIVERY TRACKER tab goes back to early 2025 (e.g., 2025-01-01: Nasturtium Leaf 400 EA @ $0.35 = $140).

### 4.7 Price Catalog

**Source:** KEY tab in Daily Delivery Tracking Sheet — 289 items with Unit and Price Per Unit.

Replaces the single `default_price` field on items with a dedicated price catalog supporting per-unit pricing.

| Field | Type | Notes |
|-------|------|-------|
| `item_id` | FK → items | Which item |
| `unit` | enum | EA, SM, LG, LBS, BU, QT, BX, CS, PT |
| `price_per_unit` | decimal | Market-equivalent price |
| `effective_date` | date | When this price became active |
| `source` | enum | `market` (market-equivalent), `custom` (Micheal override) |

**Key behaviors:**

1. An item can have different prices for different units (e.g., Nasturtium Leaf @ $0.35/EA vs. $6.00/SM).
2. The 289-item KEY tab is imported as seed data at launch.
3. Price changes create new rows with new effective_date — old prices preserved for historical accuracy.
4. When logging a delivery, the most recent price for that item+unit combo auto-fills.

### 4.8 Financial Reporting

**Source:** Income Statement tabs, Farm Expenses tab, Monthly summary tabs in Daily Delivery Tracking Sheet.

| Report | Frequency | Contents |
|--------|-----------|----------|
| Delivery Value Summary | Per-delivery | Line items, quantities, prices, total value for one delivery date |
| Monthly Value Report | Monthly | Total value by restaurant, top items by value/volume, expense summary, MoM comparison |
| Quarterly Income Statement | Quarterly | Production value, expenses breakdown, farmer pay, net margin. Q1 2026 benchmark: $21,633 value / $1,536 expenses / $12K farmer pay. |
| Most Ordered Items | On-demand | Ranked list by order frequency and total volume, filterable by date range |
| Farm Expense Report | Monthly | All expenses by category with running total |

**Farm expenses tracked:**

| Field | Type | Notes |
|-------|------|-------|
| `date` | date | When expense occurred |
| `category` | text | e.g., Seeds, Soil, Equipment, Gas, Supplies |
| `description` | text | What was purchased |
| `amount` | decimal | Cost |
| `receipt_url` | text | Optional link to receipt image (Phase 2) |

### 4.9 Auth & Permissions Model

| Role | Auth Method | Permissions |
|------|-------------|-------------|
| Admin | Email + password (Supabase Auth) | Full CRUD on all tables. View all restaurants. Manage users. |
| Chef | Magic link (Supabase Auth, passwordless) | View availability for own restaurant only. Create/edit orders for own restaurant only. View own order history. |

**Row Level Security (RLS) rules:**
1. Chefs can only SELECT availability_items WHERE restaurant_id matches their assigned restaurant.
2. Chefs can only INSERT/UPDATE orders WHERE restaurant_id matches their assigned restaurant.
3. Chefs can only SELECT orders WHERE chef_id = their own user ID.
4. Admin bypasses RLS via service role or admin flag.

**Magic link flow:**
1. Admin invites chef by entering their email + assigning restaurant.
2. Chef receives email with "Log in to Press Farm OS" link.
3. Link authenticates and sets session. No password ever created.
4. Session lasts 30 days (configurable). Chef clicks magic link again if expired.
5. Admin can deactivate a chef account immediately (rotating staff).

---

## 5. Mobile-First Design Requirements

| Requirement | Detail |
|-------------|--------|
| Primary breakpoint | 375px (iPhone SE and up) |
| Layout | Single-column card layout on mobile |
| Touch targets | Minimum 44×44px for all interactive elements |
| Availability list | Swipeable cards or collapsible category sections |
| Quantity input | Large number input with +/- steppers |
| Admin dashboard | Bottom tab navigation: Orders, Availability, Items, Reports |
| Chef portal | Two screens: Order (availability list + quantities) and History |
| Offline | Not required Phase 1. All operations require network. |
| PWA | Progressive Web App for "Add to Home Screen" on iPhone. No app store. |

---

## 6. Out of Scope — Phase 1

| Feature | Reason | Phase |
|---------|--------|-------|
| SMS notifications (Twilio) | Phase 2 after email flow validated | 2 |
| 10-acre farm management | Farm not yet operational | Future |
| Multi-farm support | Only one farm active | Future |
| Invoicing / billing | Farm is in-house, no invoicing needed | N/A |
| Inventory tracking (quantities on hand) | Micheal manages mentally; too complex for v1 | 2 |
| Photo uploads per item | Nice to have but not blocking | 2 |
| Farm-to-dish mapping | Maps farm items → specific menu dishes with garnishes, source locations (Press Bed, Meadowood, Press Farm/Wild Forage), and availability concerns. Data exists in Farm Product Sheet. | 2 |
| Planting timeline integration | Seed start, transplant, removal dates for ~20 crop categories. Data exists in Planting Timeline sheet. | 2 |
| Seed inventory tracking | Seed stock by type, variety, weight. Data exists in Current Seed Inventory sheet. | 2 |
| Vendor ordering integration | PRESS Ordering 2026 sheet tracks all vendor orders (not just farm). Par levels, delivery schedules, order-by times. Farm order is one of many. | Future |
| Recipe/usage integration | Out of scope entirely | Future |
| Weather integration | Out of scope entirely | Future |
| Barcode/QR scanning | Out of scope entirely | Future |
| Multi-language support | All users are English | N/A |
| Dark mode | Not a priority | 2 |

---

## 7. Success Metrics

| Metric | Target |
|--------|--------|
| Order submission time (chef) | < 3 minutes |
| Availability update time (admin) | < 5 minutes per cycle |
| Shortage notification delivery | < 2 minutes after admin marks |
| Monthly report generation | < 10 seconds |
| Chef adoption | Both restaurants using within 1 week of launch |
| Zero missed orders | No orders lost or undelivered due to system failure |

---

## 8. Delivery Schedule

| Milestone | Target |
|-----------|--------|
| Schema + seed data | Week 1 |
| Auth + chef portal (ordering) | Week 2 |
| Admin portal (availability + orders) | Week 3 |
| Notifications (Resend) | Week 4 |
| Value reporting | Week 5 |
| Testing with real data | Week 6 |
| Go-live | Week 7 |
