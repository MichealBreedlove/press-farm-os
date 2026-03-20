# Press Farm OS — Chef Ordering Workflow

**Version:** 2.0
**Date:** 2026-03-19
**Persona:** Chef (Press or Understudy kitchen staff)
**Updated:** Expanded unit types to match Daily Delivery Tracking Sheet

---

## Overview

Chefs place orders the night before delivery (Thursday, Saturday, Monday). They see only items available for their restaurant, enter quantities, add notes, and submit. They receive email confirmations and shortage notifications.

---

## Step-by-Step Flow

### Step 1: Login (Magic Link)

| # | Action | System Response |
|---|--------|----------------|
| 1.1 | Chef navigates to `pressfarm.app` (or saved PWA on home screen) | Login screen with email input and "Send Magic Link" button |
| 1.2 | Chef enters email address | |
| 1.3 | Chef taps "Send Magic Link" | Supabase sends magic link email via Resend |
| 1.4 | Chef opens email, taps link | Browser opens → session authenticated → redirect to order page |

**Session duration:** 30 days. Chef won't need to re-auth unless session expires or admin deactivates.

**First-time flow:** Admin must invite chef first (creates account + assigns restaurant). Chef's first magic link click creates the session.

### Step 2: View Availability / Order Page

| # | What Chef Sees | Details |
|---|----------------|---------|
| 2.1 | **Header:** Restaurant name + next delivery date | e.g., "Press — Order for Thursday, Mar 19" |
| 2.2 | **Auto-selected delivery date** | App defaults to the next open delivery date. Chef can tap to select a different upcoming date if multiple are open. |
| 2.3 | **Items grouped by category** | Collapsible sections: Flowers → Micros-Leaves → Herbs/Leaves → Fruit/Veg → Kits |
| 2.4 | **Each item row shows:** | See item row layout below |

**Item Row Layout:**

```
┌────────────────────────────────────────────┐
│ 🟢 Nasturtium (Dime-Nickel)        EA     │
│ "Wild Harvest Unpredictable"               │
│                          [___] qty         │
├────────────────────────────────────────────┤
│ 🟡 Fava Leaves (max 3)             SM     │
│ "Slowly Growing Back"                      │
│                          [___] qty         │
├────────────────────────────────────────────┤
│ 🟢 Broccoli Flower                 LG     │
│                          [___] qty         │
├────────────────────────────────────────────┤
│ ⛔ Mint, Chocolate             ░░░░░░░░░░  │
│ "Dead Will Grow Back"          unavailable │
└────────────────────────────────────────────┘
```

**Status indicators:**
| Status | Visual | Behavior |
|--------|--------|----------|
| `available` | 🟢 Green dot | Quantity input enabled, no cap |
| `limited` | 🟡 Yellow dot + "(max X)" | Quantity input enabled, capped at `limited_qty` |
| `unavailable` | ⛔ Red dot + greyed out | Quantity input disabled, row dimmed |

**Notes display:**
- `chef_notes` from item master shows in grey italic below item name.
- `cycle_notes` from availability (if set) shows instead of/in addition to chef_notes with a "this cycle" label.

### Step 3: Enter Quantities

| # | Action | System Response |
|---|--------|----------------|
| 3.1 | Chef taps quantity field on an available item | Numeric keyboard opens (mobile). Field accepts decimals (e.g., 0.5). |
| 3.2 | Chef enters quantity | Value stored in local state. Running order summary updates. |
| 3.3 | If limited item and qty > limited_qty | Inline validation: "Max available: 3". Input clamped. |
| 3.4 | Chef can clear quantity to remove item from order | Item removed from order summary. |

**Quantity input specs:**
- Input type: `number` with `step="0.5"` and `min="0"`
- +/- stepper buttons flanking the input (44×44px touch targets)
- Default value: blank (not 0 — blank means "not ordering")
- Nonzero value = item is included in order

### Step 4: Add Freeform Notes

| # | Action | System Response |
|---|--------|----------------|
| 4.1 | Chef scrolls to bottom of item list | "Special Requests / Notes" textarea visible |
| 4.2 | Chef types freeform notes | e.g., "50ea tiny turnips", "extra herbs if available" |
| 4.3 | Notes are free text, no validation | Character limit: 1000 |

### Step 5: Review & Submit

| # | Action | System Response |
|---|--------|----------------|
| 5.1 | Chef taps "Review Order" button | Order summary overlay/page appears |
| 5.2 | **Summary shows:** | Delivery date, all items with quantities and units, freeform notes, restaurant name |
| 5.3 | Chef can tap "Edit" to go back | Returns to order form with values preserved |
| 5.4 | Chef taps "Submit Order" | Order status → `submitted`. `submitted_at` set. |
| 5.5 | **Success screen:** | "Order submitted for Thursday, Mar 19. You'll receive a confirmation email." |
| 5.6 | **Email sent to chef:** | Confirmation with order details |
| 5.7 | **Email sent to admin (Micheal):** | Notification that [Restaurant] submitted an order for [date] with summary |

### Step 6: Edit Order (Before Fulfillment)

| # | Action | System Response |
|---|--------|----------------|
| 6.1 | Chef returns to app before ordering closes | Sees existing order with previously entered quantities |
| 6.2 | Chef modifies quantities or notes | Changes saved |
| 6.3 | Chef taps "Update Order" | Updated order submitted. Admin receives update notification. |
| 6.4 | **If ordering is closed** (admin locked it) | Banner: "Ordering is closed for this delivery date. Contact Micheal for changes." All inputs disabled. |

### Step 7: Receive Shortage Notification

| # | Action | System Response |
|---|--------|----------------|
| 7.1 | Admin marks items as shorted during fulfillment | |
| 7.2 | **Email sent to chef:** | Subject: "Shortage Notice — [Date]" |
| 7.3 | **Email body contains:** | Table of shorted items: Item Name, Requested Qty, Fulfilled Qty, Reason |
| 7.4 | Chef reads email on phone or computer | No action required from chef |

**Shortage email example:**
```
Subject: Shortage Notice — Thursday, Mar 19

Hi Ryan,

Some items on your order for Thursday, Mar 19 have been adjusted:

| Item              | Requested | Fulfilled | Reason            |
|-------------------|-----------|-----------|-------------------|
| Fava Leaves       | 3 SM      | 1 SM      | Low yield          |
| Nasturtium (D-N)  | 20 EA     | 12 EA     | Pest damage        |

All other items fulfilled as requested.

— Press Farm OS
```

### Step 8: Receive Fulfillment Confirmation

| # | Action | System Response |
|---|--------|----------------|
| 8.1 | Admin marks order as fulfilled | |
| 8.2 | **Email sent to chef:** | Subject: "Order Fulfilled — [Date]" |
| 8.3 | **Email body:** | Final quantities delivered for each item |

### Step 9: View Order History (Optional)

| # | Action | System Response |
|---|--------|----------------|
| 9.1 | Chef taps "History" tab/link | List of past orders, most recent first |
| 9.2 | Each row shows: date, status, item count | |
| 9.3 | Chef taps an order | Detail view: all items, quantities requested vs. fulfilled, shortage reasons, freeform notes |

---

## Edge Cases

| # | Scenario | System Behavior |
|---|----------|----------------|
| E-1 | Chef tries to order after admin closes ordering | All quantity inputs disabled. Banner: "Ordering closed for [date]." |
| E-2 | Chef tries to order for a past delivery date | Past dates not shown in date selector. Only future open dates available. |
| E-3 | Chef's account is deactivated by admin | Magic link stops working. Existing session invalidated. Login screen shows "Account inactive — contact Micheal." |
| E-4 | Two chefs from same restaurant try to submit | Only one order per restaurant per delivery date. Second chef sees existing order and can edit it. No conflicts — last save wins. |
| E-5 | Chef enters 0 quantity for an item | Item not included in order. Same as leaving blank. |
| E-6 | Chef enters quantity exceeding limited_qty | Input clamped to max. Toast: "Max available is [X]." |
| E-7 | No items are available for chef's restaurant | Empty state: "No items available for the next delivery. Check back later." |
| E-8 | Chef opens app but no delivery dates are open | Empty state: "No upcoming deliveries. Next delivery dates will be posted soon." |
| E-9 | Magic link expired (>30 days) | Login page shown. Chef requests new magic link. |
| E-10 | Chef submits order with only freeform notes (no line items) | Allowed. Order created with just freeform_notes. Admin sees it. |
| E-11 | Network error during submit | Error toast: "Failed to submit. Check connection and try again." Order stays in draft. Retry button. |
| E-12 | Chef assigned to wrong restaurant | Admin fixes in user management. Chef sees correct items on next login. |

---

## Screen Inventory

| Screen | Route | Description |
|--------|-------|-------------|
| Login | `/login` | Email input + "Send Magic Link" button |
| Order | `/order` | Main ordering interface. Default screen after login. |
| Order Review | `/order/review` | Summary before submit |
| Order Confirmation | `/order/confirmed` | Post-submit success |
| Order History | `/history` | List of past orders |
| Order Detail | `/history/[orderId]` | Single order details |

---

## Notification Matrix (Chef Perspective)

| Event | Email Subject | Timing |
|-------|--------------|--------|
| Order submitted | "Order Confirmed — [Date]" | Immediate on submit |
| Items shorted | "Shortage Notice — [Date]" | When admin marks shortages |
| Order fulfilled | "Order Fulfilled — [Date]" | When admin marks fulfilled |
| Availability published | "New Availability — [Date]" | When admin publishes availability |
