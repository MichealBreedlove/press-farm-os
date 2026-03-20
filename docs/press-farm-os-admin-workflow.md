# Press Farm OS — Admin Workflow

**Version:** 2.0
**Date:** 2026-03-19
**Persona:** Micheal Breedlove (sole admin, mobile-first)
**Updated:** Added delivery logging, financial dashboard, and Excel import workflows

---

## Overview

Micheal's workflow follows the harvest cycle: update availability → chefs order overnight → review orders in the morning → harvest → mark shortages if needed → deliver → mark fulfilled → track value monthly. All primary interactions happen on iPhone at the farm.

---

## Delivery Cycle Timeline

| Time | Day | Action |
|------|-----|--------|
| Afternoon | Day before harvest | Update availability for next delivery date |
| Evening | Day before harvest | Chefs place orders |
| Morning | Harvest day | Review incoming orders |
| Morning–Lunch | Harvest day | Harvest |
| Post-harvest | Harvest day | Mark shortages, notify chefs |
| Delivery | Harvest day | Deliver to restaurants |
| Post-delivery | Harvest day | Mark orders fulfilled |
| Post-delivery | Harvest day | **Log delivery** (item/qty/unit/price per line item) |
| End of month | Monthly | Review financial dashboard, enter expenses, finalize month |

**Delivery days:** Thursday, Saturday, Monday
**Harvest days:** Same (every other day)

---

## Workflow 1: Update Availability

**When:** Afternoon before delivery day
**Where:** iPhone at farm or restaurant computer
**Frequency:** 3× per week

### Steps

| # | Action | System Response |
|---|--------|----------------|
| 1.1 | Open app → tap "Availability" tab | Shows list of upcoming delivery dates |
| 1.2 | Tap next delivery date (e.g., "Thu, Mar 19") | Availability editor opens for that date |
| 1.3 | **Toggle restaurant:** Press / Understudy tabs | Items filter to selected restaurant |
| 1.4 | **Shortcut: "Duplicate Last Cycle"** button | Copies all availability_items from the previous delivery date for this restaurant. All statuses, limited_qty, and cycle_notes copied. |
| 1.5 | Scroll through items by category | Each item shows: name, current status toggle, limited_qty field, cycle_notes field |
| 1.6 | **Set status per item:** tap to cycle through Available → Limited → Unavailable | Status badge updates. If Limited, limited_qty input appears. |
| 1.7 | **Optional:** Enter limited_qty for limited items | Numeric input |
| 1.8 | **Optional:** Enter cycle_notes | Text field. e.g., "Slowly Growing Back" |
| 1.9 | Repeat for Understudy tab (or duplicate from Press if similar) | |
| 1.10 | Tap "Publish Availability" | availability_items rows created/updated. delivery_date.ordering_open = true. |
| 1.11 | **Email sent to all chefs for each restaurant** | "New availability posted for [date] — place your order" with link |

### "Duplicate Last Cycle" Detail

| Behavior | Detail |
|----------|--------|
| Source | Most recent delivery_date with availability_items for same restaurant |
| What copies | item_id, restaurant_id, status, limited_qty, cycle_notes |
| What doesn't copy | delivery_date (set to new date), id (new UUID), timestamps |
| After duplication | Admin reviews and tweaks individual items as needed |
| If no previous cycle exists | Button disabled. Admin creates from scratch. |

### Bulk Actions

| Action | Description |
|--------|-------------|
| "Mark All Available" | Sets all items to `available` for this restaurant+date |
| "Mark All Unavailable" | Sets all items to `unavailable` — useful for resetting |
| "Copy Press → Understudy" | Duplicates Press availability to Understudy for same date (only items that exist in both) |

---

## Workflow 2: Review Incoming Orders

**When:** Morning of harvest day
**Where:** iPhone at farm

### Steps

| # | Action | System Response |
|---|--------|----------------|
| 2.1 | Open app → "Orders" tab | Shows orders for today's delivery date |
| 2.2 | **Order card per restaurant:** | Restaurant name, chef name, submitted time, item count, status badge |
| 2.3 | Tap Press order | Order detail: all line items with quantities, grouped by category |
| 2.4 | Tap Understudy order | Same view |
| 2.5 | **Combined harvest list** button | Merges both orders into a single printable/viewable list grouped by category. Shows: Item, Unit, Press Qty, Understudy Qty, Total. |

**Combined Harvest List Example:**

```
HARVEST LIST — Thursday, Mar 19
================================

FLOWERS
  Alyssum (50ct)          | Press: 2 EA  | Under: —     | Total: 2 EA
  Nasturtium (Dime-Nickel)| Press: 20 EA | Under: 10 EA | Total: 30 EA
  Borage                  | Press: 1 SM  | Under: 1 SM  | Total: 2 SM

HERBS/LEAVES
  Bay Leaf (California)   | Press: 15 EA | Under: —     | Total: 15 EA
  Mint, Chocolate         | Press: 1 SM  | Under: 1 SM  | Total: 2 SM

KITS
  Salad Mix A             | Press: 2 KIT | Under: 1 KIT | Total: 3 KIT
```

---

## Workflow 3: Close Ordering

**When:** Before starting harvest (morning)
**Where:** iPhone

| # | Action | System Response |
|---|--------|----------------|
| 3.1 | On Orders tab, tap "Close Ordering" for today's date | Confirmation dialog: "Close ordering for [date]? Chefs won't be able to edit." |
| 3.2 | Confirm | `delivery_dates.ordering_open = false`. All orders for that date locked. Status → `in_progress`. |

---

## Workflow 4: Mark Shortages

**When:** During or after harvest, before delivery
**Where:** iPhone at farm

### Steps

| # | Action | System Response |
|---|--------|----------------|
| 4.1 | Open an order (e.g., Press) | Line items listed |
| 4.2 | Tap an item that needs to be shorted | Item detail expands or modal opens |
| 4.3 | Enter `quantity_fulfilled` (less than requested) | `is_shorted` auto-set to `true` |
| 4.4 | Enter `shortage_reason` | Text field. e.g., "Low yield", "Pest damage", "Didn't make it" |
| 4.5 | Tap "Save" | order_item updated |
| 4.6 | Repeat for all shorted items | |
| 4.7 | Tap "Send Shortage Notices" | Batch email sent to affected chefs. One email per chef listing all shorted items. |

**Shortage quick-entry mode:**
- On the order detail screen, items that haven't been fulfilled yet show a yellow "Pending" badge.
- Tap "Quick Fulfill" to set all items to `quantity_fulfilled = quantity_requested` (no shortages).
- Then only adjust the items that were actually shorted.

---

## Workflow 5: Mark Order Fulfilled

**When:** After delivery
**Where:** iPhone or restaurant computer

| # | Action | System Response |
|---|--------|----------------|
| 5.1 | Open order | Shows all items with fulfillment status |
| 5.2 | **If all items already have quantity_fulfilled set** | "Mark Fulfilled" button is green/active |
| 5.3 | Tap "Mark Fulfilled" | order.status → `fulfilled`. order.fulfilled_at set. |
| 5.4 | **Email sent to chef:** | "Your order for [date] has been fulfilled." Final quantities listed. |
| 5.5 | Repeat for other restaurant's order | |

---

## Workflow 6: Manage Item Catalog

**When:** As needed (new items, price updates, archiving)
**Where:** iPhone or restaurant computer

### Add New Item

| # | Action | System Response |
|---|--------|----------------|
| 6.1 | Items tab → "Add Item" button | New item form |
| 6.2 | Enter: name, category (dropdown), unit_type (dropdown) | Required fields |
| 6.3 | Optional: default_price, chef_notes, internal_notes, source | |
| 6.4 | Save | Item added to master catalog. Not automatically added to availability. |

### Edit Item

| # | Action | System Response |
|---|--------|----------------|
| 6.5 | Items tab → tap item | Edit form pre-filled |
| 6.6 | Modify fields | |
| 6.7 | If changing default_price | New row created in price_history with effective_date = today |
| 6.8 | Save | Item updated. Changes reflected in next availability cycle. |

### Archive Item

| # | Action | System Response |
|---|--------|----------------|
| 6.9 | Items tab → tap item → "Archive" | Confirmation: "Archive [item]? It will no longer appear in availability." |
| 6.10 | Confirm | `is_archived = true`. Item hidden from availability and ordering. Historical orders preserved. |

---

## Workflow 7: Manage Users

**When:** Staff changes
**Where:** iPhone or restaurant computer

### Invite Chef

| # | Action | System Response |
|---|--------|----------------|
| 7.1 | Settings → Users → "Invite Chef" | Form: email, full_name, restaurant (dropdown) |
| 7.2 | Enter details, tap "Send Invite" | Supabase creates user with magic link. Email sent. restaurant_users row created. |
| 7.3 | Chef receives invite email | "You've been invited to Press Farm OS. Click to log in." |

### Deactivate Chef

| # | Action | System Response |
|---|--------|----------------|
| 7.4 | Settings → Users → tap chef → "Deactivate" | `profiles.is_active = false`. Session invalidated. Chef can't log in. |

---

## Workflow 8: Value Reporting

**When:** Monthly (or on-demand)
**Where:** iPhone or restaurant computer

### Generate Monthly Report

| # | Action | System Response |
|---|--------|----------------|
| 8.1 | Reports tab → "Monthly Value Report" | Date picker: select month/year |
| 8.2 | Select month (e.g., "February 2026") | Report generates |
| 8.3 | **Report contents:** | See below |

**Monthly Value Report Layout:**

```
MONTHLY PRODUCE VALUE REPORT
February 2026
═══════════════════════════════════════

SUMMARY
  Total Value Delivered:        $4,850.00
  Press:                        $3,200.00
  Understudy:                   $1,650.00
  Operating Cost:               $2,000.00
  Value-to-Cost Ratio:          2.43x

DELIVERIES
  Total Delivery Days:          12
  Total Orders Fulfilled:       24
  Total Line Items:             186
  Items Shorted:                8 (4.3%)

TOP 10 ITEMS BY VALUE
  #  | Item                    | Qty    | Value
  1  | Salad Mix A             | 24 KIT | $720.00
  2  | Nasturtium (Dime-Nickel)| 340 EA | $510.00
  3  | Bay Leaf (California)   | 180 EA | $360.00
  ...

TOP 10 ITEMS BY QUANTITY
  #  | Item                    | Qty     | Unit
  1  | Nasturtium (Dime-Nickel)| 340     | EA
  2  | Alyssum (50ct)          | 48      | EA
  3  | Mint, Chocolate         | 36      | SM TG
  ...

MONTH-OVER-MONTH
  Metric          | Jan 2026  | Feb 2026 | Change
  Total Value     | $4,200.00 | $4,850.00| +15.5%
  Press Value     | $2,800.00 | $3,200.00| +14.3%
  Understudy Value| $1,400.00 | $1,650.00| +17.9%
  Cost Ratio      | 2.10x     | 2.43x   | +0.33
```

### Update Operating Cost

| # | Action | System Response |
|---|--------|----------------|
| 8.4 | Reports tab → "Operating Cost" | Current monthly_operating_cost shown |
| 8.5 | Enter new amount | Saved to farms.monthly_operating_cost |

---

## Workflow 9: Log Delivery

**When:** After fulfilling and delivering orders (post-delivery)
**Where:** iPhone or restaurant computer
**Frequency:** 3× per week (every delivery day)

> **Purpose:** This is the financial source of truth — what actually left the farm. Replaces the DELIVERY TRACKER tab in the Daily Delivery Tracking Sheet. Value calculations and income statements pull from delivery logs, NOT order fulfillment data.

### Steps

| # | Action | System Response |
|---|--------|----------------|
| 9.1 | Open app → "Deliveries" tab (or from fulfilled order) | Shows today's delivery date with option to log |
| 9.2 | Tap "Log Delivery" for restaurant (e.g., Press) | Delivery form opens. Pre-populated from fulfilled order items if available. |
| 9.3 | **Each line item shows:** item name, quantity, unit, unit_price, line_total | Unit price auto-fills from price_catalog (most recent price for item+unit). Editable. |
| 9.4 | Adjust quantities/prices if actual delivery differs from order | line_total recalculates automatically (qty × unit_price) |
| 9.5 | **Add items not on original order** (e.g., extras given) | "Add Item" button → search catalog → enter qty/unit/price |
| 9.6 | **Remove items** that weren't actually delivered | Swipe to remove or tap delete |
| 9.7 | View delivery total at bottom | Running SUM of all line_total values |
| 9.8 | Optional: add delivery-level notes | Text field |
| 9.9 | Tap "Save Delivery" | delivery.status → `logged`. delivery.total_value calculated. |
| 9.10 | Repeat for Understudy | |

### Quick-Log from Fulfilled Order

| Behavior | Detail |
|----------|--------|
| Pre-population | When a fulfilled order exists for this date+restaurant, delivery items pre-fill from order_items (quantity_fulfilled, unit_price_at_order) |
| Micheal reviews | Adjusts any discrepancies between what was ordered and what was actually delivered |
| No order exists | Micheal can log ad-hoc deliveries (e.g., extras, samples) without a corresponding order |

### EOM Finalization

| # | Action | System Response |
|---|--------|----------------|
| 9.11 | At month end, open Deliveries tab → "Finalize Month" | Shows all logged deliveries for the month with running total |
| 9.12 | Review delivery totals | EOM running total displayed prominently |
| 9.13 | Tap "Finalize" | All delivery statuses → `finalized`. Month locked. Feeds into financial_periods view. |

---

## Workflow 10: Financial Dashboard

**When:** Monthly (or on-demand for quick checks)
**Where:** iPhone or restaurant computer

### Steps

| # | Action | System Response |
|---|--------|----------------|
| 10.1 | Reports tab → "Financial Dashboard" | Dashboard with current month summary |
| 10.2 | **Summary cards at top:** | Total Value MTD, Total Expenses MTD, Net Value, EOM Running Total |
| 10.3 | **Monthly breakdown:** | Value by restaurant (Press / Understudy), delivery count, average delivery value |
| 10.4 | **Quarterly Income Statement view:** | Production value vs. expenses vs. farmer pay. Benchmark: Q1 2026 = $21,633 / $1,536 / $12K |
| 10.5 | **Most Ordered Items:** | Ranked by frequency and total volume, filterable by date range |
| 10.6 | **Expense tracking:** | List of all farm_expenses for the period |

### Enter Farm Expense

| # | Action | System Response |
|---|--------|----------------|
| 10.7 | Reports tab → "Add Expense" | Expense form |
| 10.8 | Enter: date, category (dropdown), description, amount | Category examples: Seeds, Soil, Equipment, Gas, Supplies |
| 10.9 | Optional: attach receipt photo (Phase 2) | |
| 10.10 | Save | Expense added to farm_expenses. Dashboard totals update. |

### Income Statement View

```
QUARTERLY INCOME STATEMENT
Q1 2026 (Jan - Mar)
═══════════════════════════════════════

REVENUE (Production Value)
  Press:                        $15,200.00
  Understudy:                   $6,433.00
  Total Production Value:       $21,633.00

EXPENSES
  Seeds:                        $420.00
  Soil/Amendments:              $310.00
  Equipment:                    $280.00
  Gas/Transport:                $226.00
  Supplies:                     $300.00
  Total Expenses:               $1,536.00

FARMER PAY
  Micheal Breedlove:            $12,000.00

NET MARGIN
  Production - Expenses - Pay:  $8,097.00
  Cost Ratio:                   14.1x (value ÷ expenses)
```

---

## Workflow 11: Import from Excel (One-Time Migration)

**When:** Initial app setup
**Where:** Restaurant computer (needs file access)

> **Purpose:** One-time import of historical data from the Daily Delivery Tracking Sheet to populate the system with existing items, prices, and delivery history.

### Import Price Catalog (KEY Tab)

| # | Action | System Response |
|---|--------|----------------|
| 11.1 | Settings → "Data Import" → "Import Price Catalog" | File upload form |
| 11.2 | Upload Daily Delivery Tracking Sheet (.xlsx) | System reads KEY tab |
| 11.3 | **Preview shows:** 289 items with Item Name, Unit, Price Per Unit | Micheal reviews for accuracy |
| 11.4 | **Mapping:** Each row creates an `items` record + `price_catalog` record | Item name → items.name, Unit → price_catalog.unit, Price Per Unit → price_catalog.price_per_unit |
| 11.5 | **Category assignment:** Auto-categorize where possible, flag unknowns for manual review | Flowers, Micros-Leaves, Herbs/Leaves, Fruit/Veg, Kits |
| 11.6 | Tap "Import" | Items and prices created. Summary: "289 items imported, 289 prices set." |

### Import Historical Deliveries (DELIVERY TRACKER Tab)

| # | Action | System Response |
|---|--------|----------------|
| 11.7 | Settings → "Data Import" → "Import Delivery History" | File upload form |
| 11.8 | Upload same .xlsx file | System reads DELIVERY TRACKER tab |
| 11.9 | **Preview shows:** Line items with Date, Item, Quantity, Unit, Price, Total | Micheal reviews |
| 11.10 | **Mapping:** Groups by date → creates `deliveries` rows, each line → `delivery_items` | Items matched by name to imported catalog |
| 11.11 | **Unmatched items flagged** for manual mapping | |
| 11.12 | Tap "Import" | Historical deliveries created. Status = `finalized`. |

### Import Validation

| Check | Action if Failed |
|-------|-----------------|
| Duplicate item names | Show list, let admin merge or rename |
| Unrecognized units | Map to closest match or flag |
| Missing prices | Use $0.00 with flag for admin to update |
| Date parsing errors | Show raw dates for manual correction |

---

## Admin Navigation (Mobile Bottom Tabs)

| Tab | Icon | Primary Screen |
|-----|------|----------------|
| Orders | 📋 | Today's orders + upcoming. Quick access to harvest list. |
| Availability | 📊 | Manage availability by delivery date. Duplicate last cycle. |
| Deliveries | 📦 | Log deliveries, view delivery history, EOM finalization. |
| Items | 🌱 | Master item catalog. Add/edit/archive. Price catalog. |
| Reports | 📈 | Financial dashboard. Monthly/quarterly reports. Expenses. Most ordered items. |
| Settings | ⚙️ | User management. Farm settings. Data import. |

> **Note:** 6 tabs may be too many for mobile bottom nav. Consider putting Settings behind a hamburger menu, or combining Deliveries into the Orders flow as a sub-action.

---

## Edge Cases (Admin)

| # | Scenario | System Behavior |
|---|----------|----------------|
| EA-1 | No orders received for a delivery date | Orders tab shows "No orders for [date]". Micheal can still close ordering. |
| EA-2 | Admin tries to duplicate availability but no previous cycle exists | "Duplicate" button disabled. Tooltip: "No previous availability to copy." |
| EA-3 | Admin marks shortage after already fulfilling order | Reopen order: status reverts to `in_progress`. Edit shortages. Re-fulfill. |
| EA-4 | Admin needs to cancel an order | "Cancel Order" option. Status → `cancelled`. Chef notified. |
| EA-5 | Item is on both Press and Understudy availability but needs different notes | cycle_notes is per availability_item (per restaurant, per date). Different notes supported. |
| EA-6 | New item added mid-cycle | Item exists in catalog but won't appear in already-published availability. Must be manually added to current cycle. |
| EA-7 | Chef edits order after admin already reviewed | Admin receives "Order Updated" email notification. Must re-review. |
| EA-8 | Power loss / network loss during availability update | All changes saved per-field (auto-save on blur). No "save all" button needed. |
| EA-9 | Admin wants to see what was ordered historically on a specific date | Orders tab → filter by date. Full history preserved. |
| EA-10 | Admin needs to add a one-off delivery date (not Thu/Sat/Mon) | Settings → "Add Custom Delivery Date". Creates delivery_dates row. Availability can then be set. |
