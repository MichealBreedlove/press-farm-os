# Press Farm OS — Site Audit (2026-09-15)

Scope: every route under `src/app/` (admin, chef, receiver, harvester, public), navigation, and interactivity.
Branch: `claude/website-improvements-redesign-qeky0u`. Items **0**, **0a**, **0b** are already shipped on this branch.

Micheal's calls (2026-09-15): `/admin/reports/expenses` **stays** (he uses it). `/admin/microgreens/calendar` **stays**. Cutoff is now **3:30 PM**. Events = Events account orders on `/events/order` + chefs use the "For an event" checkbox; the `/events` request queue is retired.

Legend — **Effort**: S = under an hour, M = half a day, L = a day or more. **Type**: Remove / Combine / Improve / Fix.

---

## 0. Shipped on this branch: interactive calendar

| What | Before | Now |
|---|---|---|
| Month nav | Full page reload via `?year=&month=` | Client-side, neighbours prefetched. ‹ › buttons, swipe, ← → keys, `T` = today |
| Data on the grid | Orders, deliveries, published, notified | 7 toggleable layers: orders, deliveries, tasks, harvest forecast, event requests, notes, labor. Persisted per device |
| Tap a day | Link to `/admin/orders/[date]` | Day panel (side column on desktop, under the grid on phone) with everything on that date |
| Actions from a day | None | Open/close ordering, complete / snooze / reopen tasks, add task, add note, delete note, jump to availability / orders / delivery log |
| Harvest forecast | Separate `?view=forecast` grid | A layer on the same grid (old URL still works) |
| Markers | Dots only | Delivery day ring, ordering-closed dot, overdue-task red, today pill |
| Phone | Grid only | Agenda list under the grid ("Coming up this month") |

Files: `src/app/admin/calendar/{page,CalendarClient,DayPanel,layers}.tsx`, `src/lib/calendar/*`, `src/app/api/calendar/route.ts`, `tests/lib/calendar.test.ts` (8 tests).

## 0a. Shipped: ordering cutoff moved to 3:30 PM and made visible

| What | Detail |
|---|---|
| Rule | At or after 3:30 PM Pacific, today's date is no longer orderable; the earliest is tomorrow. Before that, today is fine. Your open/close toggle on each date is still the primary gate; this is the backstop. |
| Where enforced | Order form date pick, `POST /api/orders`, `POST /api/order/open-date` (admins exempt), `POST /api/events/order` |
| Now visible | `/order` header shows "Ordering for today closes at 3:30 PM" when the form is on today's date. `/events/order` subtitle says same-day delivery closes at 3:30 PM. Error copy updated. |
| Files | `src/lib/utils.ts` (`ORDER_CUTOFF_*`, `minOrderableDatePacific`, new `closesTodayPacific`), the three API routes, `tests/lib/utils.test.ts` |

## 0b. Shipped: events flow simplified

| Who | How they order for an event |
|---|---|
| Events account | `/events/order` — event name, event date, delivery date. Auto-confirms. Unchanged. |
| Press / Under-Study chefs | "For an event" checkbox on their normal `/order` form. Unchanged. |
| Retired | `/events` chef request queue (`EventsClient.tsx`, 489 lines). The route now redirects: Events account → `/events/order`, everyone else → `/order`. "Events" tab removed from chef nav. `/admin/event-requests` stays for past requests; the `event_requests` API is untouched. |
| Calendar | The Events layer now shows Events-team orders on their **event date** (with a link to the delivery date's orders page) alongside any legacy requests. |

---

## 1. Remove (dead, orphaned, or one-time)

| # | Route / file | Why | Effort |
|---|---|---|---|
| 1.1 | `src/app/order/client.tsx` (280 lines) | Zero importers. Superseded single-unit order form. | S |
| 1.2 | `src/app/admin/deliveries/finalize/page.tsx` | Zero inbound links. Same `FinalizeButton` + month total already on `/admin/deliveries`. | S |
| ~~1.3~~ | `src/app/admin/reports/expenses/page.tsx` | **Keep** — Micheal uses this URL. (It redirects to `/admin/expenses`; that's fine.) | — |
| ~~1.4~~ | `src/app/admin/setup-shared-accounts/` + its API | **Deleted** (Micheal, 2026-09-15). It wiped every non-admin login and their orders on submit. Shared accounts are created one at a time in `/admin/settings/users`. | — |
| 1.5 | `/admin/ui-kit` from BottomNav + dashboard cards | 564-line brand reference is a developer artifact. Keep the page, drop it from operator nav. | S |
| 1.6 | `/admin/items/audit` + `/admin/items/bulk-fill` links in `ItemsClient.tsx` | One-shot AI cleanup utilities permanently in the catalog toolbar. Move under Settings → Data tools. | S |
| 1.7 | `/order/confirmed` | Only says "submitted" then links to `/order` or `/history`. Cannot link the order it just placed (only has a date string in sessionStorage). Replace with redirect to `/history/[orderId]` + success banner. | M |
| ~~1.8~~ | `/admin/forecast` | **Kept.** It answers "how much of each item will chefs order next Thu/Sat/Mon" from delivery history, not "what's growing". Emoji + `text-blue-900` fixed. | — |

## 2. Combine (duplicate surfaces)

| # | Today | Proposal | Effort |
|---|---|---|---|
| 2.1 | **Six calendars**: `/admin/calendar`, `/admin/microgreens/calendar`, `/admin/foraging-calendar`, deliveries page `CalendarView` (+ `ViewToggle`), chef `/calendar`, chef `/order/forecast` | `/admin/calendar` is now the admin one (done). Next: drop `CalendarView`/`ViewToggle` from `/admin/deliveries` (link to `/admin/calendar` with the deliveries layer). **Microgreens calendar stays** (Micheal likes it); optionally mirror its tray stages as a layer without removing the page. Foraging stays as a reference page. | M |
| 2.2 | **Orders vs Explorer**: `/admin/orders` (one date, no filters) and `/admin/orders/explorer` (568 lines, filters) reachable only from a small hero accessory | Make Explorer's GET-form filter bar the top of `/admin/orders`; retire the separate route. | M |
| 2.3 | **Chef calendar vs forecast**: `/calendar` (month grid + agenda) and `/order/forecast` (year → month → week drawer, ~650 lines incl. `components/order/forecast/*`) read the same `getCalendarEvents` data. `/order/forecast` has **no inbound link anywhere**. | Either put the year view behind a tab on `/calendar` or delete it. | M |
| ~~2.4~~ | Events | **Done** — see 0b. | — |
| 2.5 | **Notes vs Tasks vs Inbox**: three capture inboxes (`/admin/notes`, `/admin/tasks`, `/admin/inbox`) with no links between them; notes can't become tasks. | Add "Make a task" on a note; the calendar day panel already shows both side-by-side. Longer term: notes become a tab on Tasks. | M |
| 2.6 | **Reports split across 8 pages** and two link sets: 4 cards on `reports/page.tsx`, 4 more at the bottom of `ReportsDashboard.tsx:299-341`. Executive already contains P&L + YoY + top items, duplicating `income`, `yoy`, `items`. | One report hub with a period picker; fold `income`/`yoy`/`items` into Executive sections. | L |
| 2.7 | **Growing plan across four pages**: `/admin/crop-plan`, `/admin/planter-boxes`, `/admin/seeds`, `/admin/microgreens` — four models of "what's growing", cross-linked only seeds → crop-plan | Add a "Growing" hub with the four as tabs; share the planting → item link. | L |
| 2.8 | **`/receiver/archive` vs `/history`** | Same "past deliveries by date" idea, two components, two empty-state styles. Share one list component. | S |
| 2.9 | **Three admin directories that disagree**: BottomNav More sheet (23 links), dashboard cards (~20; missing Microgreens, Inbox, Tasks), Settings hub | Generate all three from one `ADMIN_NAV` constant. | S |
| 2.10 | **Item picker written three times**: `OrderForm.tsx`/`item-row.tsx`, `EventsClient.tsx`, `EventOrderClient.tsx` | One `ItemPicker` component. | L |

## 3. Improve (interactivity + flow)

### Admin

| # | Where | Gap | Proposal | Effort |
|---|---|---|---|---|
| 3.1 | `/admin/deliveries` | "Log a Delivery" sits below the month card, calendar/list toggle and full history — 2 taps + a long scroll for a daily task | Move "Log delivery for [next date]" to the top; calendar day panel now also links straight to `/admin/deliveries/[date]`. | S |
| 3.2 | `/admin/availability` | No search, no "duplicate last cycle" at list level; no `EditorialHero` on the most-used tab | Add hero + a per-date "Copy from previous" button (API `/api/availability/duplicate` already exists). | S |
| 3.3 | `/admin/orders/[date]` | Harvest list is a print-only block | Inline pick checkboxes already exist on `/harvest`; embed that component. | M |
| 3.4 | `/admin/microgreens/harvests` | Log with no "log a harvest" button, no filter, no pagination | Add inline log form + crop/date filter. | M |
| 3.5 | `/admin/inbox/archived` | Subtitle promises "restore" but there is no control | Add unarchive button (API exists for archive). | S |
| 3.6 | `/admin/orders/[date]/notifications` | History only, reachable only from inside `NotifyReceiverButton` | Add "Resend" + link from the day panel. | S |
| 3.7 | `/admin/settings/data-check` | Lists integrity problems with no jump-to-record links | Link each row to the item/order. | S |
| 3.8 | All report pages | Fixed period, only a `PrintButton` | Period + restaurant picker (Explorer's GET-form pattern). | M |
| 3.9 | `/admin/weekly-update/page.tsx:47` | `auth.admin.getUserById` per chef in a loop; no `loading.tsx` | Batch the lookup; add a route `loading.tsx`. | S |
| 3.10 | Heavy pages with no skeleton | Only `src/app/admin/loading.tsx` exists; Explorer, Executive, Income, Weekly Update block navigation | Add `loading.tsx` with `FlowerSpinner` per route group. | S |

### Chef

| # | Where | Gap | Proposal | Effort |
|---|---|---|---|---|
| ~~3.11~~ | `/order` | Cutoff never shown | **Done** — see 0a. | — |
| 3.12 | `/order` | Delivery date is chosen for the chef; changing it is a 12px link with an emoji (`PickCustomDateLink.tsx:83-90`) | Date chips at the top (next 3 open dates) like `/events/order` already has. | M |
| 3.13 | `/history/[orderId]` | No reorder | "Order this again" → prefill `/order` with the same lines (keys already documented in CLAUDE.md). | M |
| 3.14 | `/order` | Search only; no category chips, favorites, "ordered last time", or "limited only" filter on a ~300-item catalog | Chips row under the search box; "Last order" section at top. | M |
| 3.15 | `/calendar` | Day cells link to `/order?date=ISO`, but `/order` silently ignores the date unless it is an open delivery date (`order/page.tsx:148-156`) | Link only delivery-date cells, or show "that date isn't open, showing next" on `/order`. | S |
| 3.16 | `/calendar` | Agenda rows ("Squash Blossoms, Aug 12 – Sep 3") are inert | Tap → `/order` scrolled to that item, or "notify me when it's in". | M |
| 3.17 | `/history` | No search, no date or status filter | Status chips + month picker. | S |
| 3.18 | Role gating | `/order`, `/calendar`, `/history`, `/events` check auth only; a receiver/harvester typing `/history` gets "No restaurant found" | Redirect by role in `src/lib/supabase/middleware.ts` (or the layouts). | S |
| 3.19 | PWA install prompt | Mounts only on `/history` and `/receiver` | Mount in the chef layout. | S |

## 4. Fix (bugs and brand inconsistencies)

| # | File | Problem | Effort |
|---|---|---|---|
| 4.1 | `forecast/page.tsx:153`, `crop-plan/CropPlanTimeline.tsx:218,273`, `reports/executive/ExecutiveDashboard.tsx:161,211,242,273,305` | **8 broken Tailwind classes** like `bg-farm-cream/60/40` (double opacity) render nothing. | S |
| 4.2 | `deliveries/finalize/page.tsx:72` | Back arrow is `text-farm-muted` inside the dark `page-header` (invisible). Moot if 1.2 lands. | S |
| 4.3 | `history/page.tsx`, `history/[orderId]/page.tsx`, `order/review/page.tsx`, `order/forecast/page.tsx`, `microgreens/trays/[id]`, `setup-shared-accounts` | Raw `text-gray-*` / `bg-gray-50` / `text-blue-900` / non-brand purples outside the documented `farm-*` / `pf-*` / status families. | S |
| 4.4 | `OnboardingTour.tsx:73` | `bg-black/60` overlay; rest of app uses `bg-farm-dark/40`. | S |
| 4.5 | 8 admin pages | Missing `EditorialHero`: `availability/`, `availability/[date]/`, `availability/[date]/offer-sheet`, `deliveries/finalize`, `items/[itemId]`, `reports/expenses`, `setup-shared-accounts`, `ui-kit`. | S |
| 4.6 | `deliveries/[date]`, `inbox/[id]`, `forecast`, `weekly-update` | Two back buttons (header arrow **and** hero `backHref`). Back target hard-coded to `/admin/dashboard` on `crop-plan`, `notes`, `foraging-calendar`, `forecast` even when arrived from a list. | S |
| 4.7 | `inbox/page.tsx:109`, `inbox/[id]:122`, `settings/emails:24`, `settings/suggestions:26`, `weekly-update:59`, `deliveries/[date]:118`, `reports/page.tsx` cards | `<a href>` (full reload) instead of `<Link>`. | S |
| 4.8 | Empty states | Shared `EmptyState` used in 5 places; hand-rolled in `history`, `receiver/archive`, `orders/[date]:283`; bare `<p>` in `events`, `order/forecast`, `microgreens/harvests`, `microgreens/crops`, `planter-boxes`, `forecast`, `availability`. | S |
| 4.9 | Touch targets under 44px | `category-section.tsx:113` Remove (32px), `OnboardingTour.tsx:84` close (36px), `:126` Skip (32px), review page back chevron (bare glyph). | S |
| 4.10 | `ChefNav.tsx:51-57` | Sign-out sits in the tab bar next to Order/Calendar/Events/History, guarded by a native `confirm()`. Move to a profile/menu row. | S |
| 4.11 | Chef page chrome | `page-header` on `/order`, `/history`, `/receiver`; `EditorialHero` on `/calendar`, `/events`, `/events/order`, `/receiver/archive`. Receiver and harvester get no nav at all. | M |
| 4.12 | `history/page.tsx:37` | `searchParams` typed as a plain object; every sibling types it as a `Promise` (Next 15 hazard). | S |
| 4.13 | `BottomNav.tsx` `isActive` | Prefix match lights both "Reports" and "Executive P&L" rows on `/admin/reports/executive`. | S |
| 4.14 | `/about` | Only public page; `/` redirects anonymous users to `/login`, so it's reachable only via the login logo/footer. | S |

---

## Suggested order of work

1. ~~**Quick wins**~~ — **Done (commit on this branch):** 1.1, 1.2, 1.5, 3.15, 4.1, 4.2, 4.7, 4.13. 1.8 (`/admin/forecast`) was **kept**: on a closer read it forecasts *order demand per item from the last 8 weeks*, which the calendar does not do. Its broken classes and off-palette colour were fixed instead.
2. ~~**Calendar consolidation**~~ — **Done.** Deliveries page lost its own calendar; "Log a Delivery" is first. Microgreens calendar kept.
3. ~~**Chef ordering flow**~~ — **Done.** Date chips, "Order again", category + Last-order chips, history status/month filters (3.12, 3.13, 3.14, 3.17).
4. ~~**Orders + Explorer merge**~~ — **Done.** `/admin/orders?view=explore` (old URL redirects). BottomNav sheet, dashboard cards and Settings hub render from `src/lib/admin-nav.ts` (2.2, 2.9). Microgreens, Inbox and Tasks now appear on the dashboard too.
5. **Reports + Growing hubs** (2.6, 2.7) — largest, lowest urgency.

Decision still needed from Micheal: 2.6 (which report pages can go).
