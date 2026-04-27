# Press Farm OS — End-to-End Test Walkthrough

Use this checklist to verify every major workflow on a fresh deploy. Run through it once after major changes or before inviting real chefs.

**Estimated time:** 20–25 minutes
**Prerequisites:** A test chef account, signed in admin account, at least one delivery date in the future, at least 5 items in catalog

---

## Setup (5 min)

### Create a test chef
1. Sign in as admin → **Settings → Users**
2. Click **+ Invite Chef**
3. Use a real email you can access (gmail, etc. — NOT your admin email)
4. Full name: `Test Chef`
5. Restaurant: `Press` (or whichever)
6. Click **Send Magic Link Invite**
7. Open the magic link email on your phone, click → confirms login

### Set yourself up to switch accounts easily
- iPhone: open Safari incognito for the chef, regular Safari for admin
- Or use 2 different browsers (Chrome + Firefox)

---

## Workflow 1: Admin publishes availability (3 min)

1. Admin → **Availability**
2. Click an upcoming delivery date (e.g., next Thursday)
3. Default mode is **All Restaurants** — you should see all 3 restaurant tabs at top
4. Mark 5–10 items **Available** (green ✓), one **Limited** (set qty to 5)
5. For one item with sizes (e.g., Nasturtium), tap a size to deselect it — verify it greys out with strikethrough
6. Click **Save All Restaurants**
7. ✅ Should see "Saved to all restaurants" confirmation
8. Click on any restaurant tab — verify the items show the same statuses

### Verify availability email
- Check inbox of test chef account
- ✅ Email arrives from `availability@pressfarm.io`
- ✅ Subject mentions delivery date
- ✅ Click "Place Order" link → goes to login (or order form if logged in)

---

## Workflow 2: Chef places an order (5 min)

1. Sign in as test chef on phone
2. Tap home tab → should land on **Order** page
3. Verify:
   - ✅ Header shows correct delivery date
   - ✅ Search bar at top
   - ✅ Items grouped by category
   - ✅ Press chefs see "Events" badge on items from Events availability
   - ✅ Limited items show "LIMITED" badge with chef notes if any
4. Try the search:
   - Type "nast" → only nasturtium-related items show
   - Clear → all categories return
5. Pick an item with sizes:
   - Tap the "X sizes" button → row expands with per-size steppers
   - Use + button to set qty 2 of one size, qty 1 of another
   - ✅ "Total: 3" appears next to item name
6. Pick an item without sizes:
   - Use + button to set qty 1
   - Tap the new note input → type "Please pick young leaves"
7. Pick an item with colors:
   - Tap a color chip → it becomes purple-filled
   - ✅ Selected color persists
8. Scroll to bottom → add a freeform note: "Delivery 9am please"
9. Tap **Review Order**
10. Review page:
    - ✅ All items listed with quantities
    - ✅ Notes shown
    - ✅ Item count correct
11. Tap **Submit Order**
12. ✅ Confirmation page shows
13. Tap **History** in nav → verify order shows up with status "Submitted"

### Verify admin notification
- Switch to admin
- ✅ Email arrives from `orders@pressfarm.io` with full order details
- Check `/admin/orders` → ✅ The order appears under correct date/restaurant

---

## Workflow 3: Admin processes the order (5 min)

1. Admin → **Orders** → tap the test order
2. ✅ Order status is "Submitted"
3. Tap **Start Picking** → status moves to "In Progress" (gold badge)

### Mark a shortage inline
4. Tap any item row in the order
5. Inline editor expands:
   - Enter qty 1 less than requested
   - Tap **Pest damage** quick chip
   - ✅ "X short" appears at right
   - Tap **Save**
6. ✅ Item row turns orange, shows fulfilled qty + line-through requested qty
7. Reload page → ✅ shortage persists
8. Tap the same item again → tap **Clear**
9. ✅ Item returns to normal (no shortage)
10. Mark a real shortage on a different item, save

### Complete the order
11. Scroll down → tap **Mark Fulfilled**
12. ✅ Order status becomes "Fulfilled" (green badge)

### Verify chef notifications
- Chef inbox: ✅ Two emails arrived from `orders@pressfarm.io`:
  - **Shortage notice** for the shorted item
  - **Order fulfilled** confirmation
- Chef → History → tap the order → ✅ Shortage shows with reason

---

## Workflow 4: Admin logs delivery + finalizes (3 min)

1. Admin → **Deliveries**
2. ✅ Calendar view loads by default with the test delivery date marked
3. Toggle to **List** view → verify same data
4. Tap the delivery date in calendar OR click "Log Delivery" on upcoming
5. ✅ Form pre-populates from the order's items
6. Tap **+ Bonus Item** → pick something not in the order, enter qty 1
7. ✅ Item gets **BONUS** tag
8. Click **Log Delivery**
9. ✅ Returns to calendar with the date marked green

### Verify harvest list
10. Admin → **Orders** → tap the order
11. Tap **View Harvest List**
12. ✅ Combined picking list shows all items by category
13. ✅ Container Calculator at top: "Lg to-go: 2, Sm to-go: 1, etc."
14. Tap **Print** → printable PDF view loads

---

## Workflow 5: Reports + Dashboard (3 min)

1. Admin → **Dashboard**
2. ✅ Live stats show:
   - Month revenue (includes the delivery you just logged)
   - Pending orders count (0 now that you fulfilled)
   - Labor hours (0 unless logged)
3. Tap revenue card → ✅ jumps to deliveries filtered by current month
4. Back → tap **Reports**
5. ✅ Monthly chart, top items
6. **Reports → Executive Summary** → ✅ printable single-page summary

### Send weekly digest
7. Dashboard → **Send Weekly Digest** button
8. ✅ Admin email receives summary

---

## Workflow 6: Admin housekeeping (3 min)

1. **Items** page:
   - Search "rad" → ✅ flat list of radish items
   - Tap an item → ✅ edit form loads
2. **Expenses**:
   - Add a test expense ($10, "Seeds", any vendor)
   - ✅ Shows up in monthly total
3. **Labor**:
   - Add a labor entry (date today, 4 hours, $20/hr)
   - ✅ Total updates
4. **Notes**:
   - Add an observation
   - Reload → ✅ persists in DB

---

## Pass Criteria

- ✅ All 6 workflows complete without crashes
- ✅ All 4 emails delivered (availability, order received, shortage, fulfilled)
- ✅ Mobile UI: every button is tappable, no overlap with bottom nav
- ✅ Search works on order form, availability editor, items
- ✅ DB persists everything across reloads

## Found a bug?

1. Note exact steps to reproduce
2. Screenshot if visual
3. Check Vercel logs for the error
4. File in `/admin/settings/suggestions` so it persists

---

*Last updated: 2026-04*
