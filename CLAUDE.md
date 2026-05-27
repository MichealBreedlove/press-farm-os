# Press Farm OS — Claude Code Context

## What This Is

Farm-to-kitchen ordering and availability management system for Press Farm (Yountville, CA).
Replaces manual Excel order sheets with a mobile-first web app.

**Two user types:**
- **Admin (Micheal)** — iPhone-first. Manages availability, reviews orders, logs deliveries, tracks expenses + labor + crop plan, runs financial reports.
- **Chefs (Press + Under-Study)** — Magic link auth. Place orders the night before delivery (Thu/Sat/Mon schedule). Rotating staff.

Restaurants modeled: **Press**, **Under-Study**, plus an **Events** pseudo-restaurant whose items appear on Press + Under-Study order forms but save under the chef's own restaurant.

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 14 App Router + TypeScript (strict) |
| Database | Supabase (PostgreSQL 15), project ref `rxdfjaseilmjvcwamqyk` |
| Auth | Supabase Auth (magic link for chefs, email+password for admin) |
| Hosting | Vercel — auto-deploys from `main` |
| Email | Resend + React Email |
| Charts | Recharts |
| Excel/CSV | SheetJS (xlsx) for legacy formats; CSV is the round-trip format |
| Styling | Tailwind + custom `farm-*` and `pf-*` token namespaces |

Repo: github.com/MichealBreedlove/press-farm-os
Local: `D:\LLM\LLM Projects\press-farm-os`

## Repo Structure

```
src/
  app/
    login/                       # Magic link login
    order/                       # Chef portal — list / review / confirmed
    history/                     # Chef order history
    about/                       # Public — partner restaurants, brand voice
    admin/
      dashboard/                 # Admin home (weather widget, stats)
      items/                     # Catalog list + [itemId] detail
        data/                    # Items Import/Export (CSV + KEY-tab XLSX)
      availability/              # /[date] editor: per-unit / size / color toggles
      orders/                    # Dashboard + [date] detail + harvest list
      deliveries/                # Log + [date] detail + finalize
        data/                    # Deliveries Import/Export (CSV + DELIVERY TRACKER XLSX)
      expenses/                  # Farm expense log
        data/                    # Expenses Import/Export
      labor/                     # Time tracking + weekly timesheet email
      crop-plan/                 # Plantings + crop plan
      forecast/                  # Production forecasting
      packs/                     # Pack manager (container inventory) — partial
      notes/                     # Farm notes
      reports/                   # Income, expenses, items, YoY, executive
      settings/                  # Users / data-check / emails / suggestions
      ui-kit/                    # Brand reference page
    api/
      orders/                    # Submit / update / shortage
      availability/              # Publish / duplicate / toggle / notify / ordering lock
      deliveries/                # Log / finalize / export
      expenses/                  # CRUD + export
      items/                     # CRUD + export
      import/                    # items-csv, expenses-csv, deliveries-csv
      labor/                     # CRUD + send-timesheet
      plantings/, crop-plan/, notes/, photos/, packs/, suggestions/
      reports/                   # monthly, income, top-items, weekly-digest
      v1/                        # Public read-only — items / orders / deliveries / expenses / availability / stats
      users/                     # CRUD + welcome email
      delivery-dates/, settings/, upload/, test-email/
    auth/callback/               # Supabase auth redirect handler
  components/
    shared/                      # EditorialHero, FloralCorners, BottomNav, StatusBadge, DeliveryDatePicker
    order/                       # Multi-unit + multi-size + multi-color order form
    admin/                       # OrderCard, AvailabilityEditor, HarvestList, etc.
  emails/                        # React Email templates
  lib/
    supabase/                    # client.ts (browser), server.ts, admin.ts (service role), middleware.ts
    resend/                      # client.ts
    flower-images.ts             # name → /assets/pressfarm/flowers/*.png resolver
    constants.ts                 # Categories, units, sizes, statuses (single source of truth)
    utils.ts                     # Date / currency formatting
  types/
    database.ts                  # Supabase-compatible DB types (manually maintained — `(supabase as any)` casts are fine)
    index.ts                     # App-level types + enriched join shapes
public/assets/pressfarm/
  logo/                          # Mandala (color/mono/gold/black), seal, lockups, app icon
  flowers/                       # ~38 hand-illustrated botanicals — used by flower-images.ts
supabase/migrations/             # 001 → 046 (last applied: 046_seed_inventory.sql)
```

## Database Migrations

15 base tables + 2 views, plus 5 microgreen tables (045) and 3 seed inventory tables (046). Last applied: **046**. Read latest first when scoping work.

| # | File | What it added |
|---|------|---------------|
| 001 | initial_schema | farms, restaurants, profiles, items, availability_items, orders, order_items, delivery_dates |
| 002 | rls_policies | RLS + `is_admin()` + `user_restaurant_ids()` helpers |
| 003 | functions_triggers | `update_updated_at`, `handle_new_user`, `update_delivery_total` |
| 004 | seed_data | Press Farm + Press + Under-Study + initial items + delivery dates |
| 005 | delivery_tracking | price_history, price_catalog, deliveries, delivery_items |
| 006 | farm_expenses | farm_expenses table |
| 007 | notifications_views | notifications, `financial_periods`, `most_ordered_items` views |
| 008 | extend_seed | Additional seed data |
| 009 | phase2_features | Phase 2 scaffolding |
| 010 | crop_plan | Crop plan |
| 011 | plantings | Plantings table |
| 012 | farm_settings | Farm settings |
| 013 | expense_vendor | Expense vendor field |
| 014 | growing_data_tasks_uploads | Growing data + tasks + uploads |
| 015 | suggestions | Chef suggestions table |
| 016 | item_sizes | Item sizes (comma-separated free text) |
| 017 | farm_notes | Farm notes |
| 018 | storage_bucket | Supabase storage bucket |
| 019 | availability_sizes_colors | `available_sizes`, `available_colors` per availability_item |
| 020 | pack_manager | `pack_inventory` table — container on-hand tracking |
| 021 | multi_unit_items | `unit_type` becomes comma-separated; `available_units` override; `gb` (Green Bin) added |
| 022 | per_unit_pricing | `items.unit_prices` JSONB map; `default_price` is fallback |
| 023 | event_items | `is_event_item` flag — Events folded into Press/Under-Study order forms |
| 024 | receiver_role | Adds `receiver` role for destination-side unpack/check-in |
| 025 | receiver_notify_log | Logs each "Finish & Send to Receiver" send |
| 026 | storage_admin_only | Replaces broad storage policies with admin-only writes |
| 027 | order_item_multi_unit | `order_items.unit` so a single line can be SM+LG of same item |
| 028 | press_bar_items | `is_press_bar_item` flag on items |
| 029 | press_bar_restaurant | Adds Press Bar as a restaurant |
| 030 | show_in_regular_menu | Items can appear on Regular / Events / Press Bar menus simultaneously |
| 031 | parent_items | `parent_item_id` — group Squash → Blossoms/Tendrils/Leaves |
| 032 | items_unique_per_category | UNIQUE(farm_id, name, category) replaces UNIQUE(farm_id, name) |
| 033 | order_item_picked | `order_items.picked_at` for per-restaurant pick list |
| 034 | receiver_received | `order_items.received_at` + receiver close-out fields |
| 035 | shared_restaurant_accounts | Wires shared chef accounts after admin creates them in Auth |
| 036 | labor_clock_times | Time-of-day fields on `labor_entries` (in/lunch/out) |
| 037 | item_consolidation_and_parents | Manual cleanup from Micheal's 2026-05-11 audit |
| 038 | backfill_q1_q2_2026_deliveries | Imports 313 historical delivery rows (Mar 7 – May 4, 2026) |
| 039 | fix_nasturtium_leaves_price | Nasturtium Leaves: $0.40 EA (was $15 LG carry-over bug) |
| 040 | events_restaurant | Re-creates Events pseudo-restaurant for shared `events` account |
| 041 | event_requests | `event_requests` table — chef advance-order flow for upcoming events |
| 042 | event_request_groups | `event_group_id` column — multi-item event submissions |
| 043 | revoke_trigger_function_grants | Strips EXECUTE from PUBLIC/anon/auth on trigger functions |
| 044 | drop_unused_indexes | Drops 22 never-scanned indexes (see file for advisor-noise notes) |
| 044 | repricing_2026_05_18 | 37 UPDATE statements on `items.unit_prices` from Micheal's 2026-05-18 list (filename collision with 044_drop_unused_indexes — both shipped) |
| 045 | microgreens_module | `microgreen_crops`, `_demand`, `_batches`, `_trays`, `_harvests` + `microgreen_tray_status` enum |
| 046 | seed_inventory | `seeds`, `seed_sowings`, `seed_germination_tests` + `seeds_with_on_hand` view + `plantings.seed_id` FK |

## Auth Model

- **Admin**: Supabase email+password. Bypasses RLS via `is_admin()` helper.
- **Chefs**: Supabase magic link. RLS scopes them to their restaurant via `user_restaurant_ids()`.
- `profiles` extends `auth.users` with `role` and `is_active`.
- `restaurant_users` join table maps users to restaurants.
- Service-role key (`createAdminClient`) is **server-only**. Never expose to browser.

## Key Business Rules

1. Delivery schedule: **Thursday, Saturday, Monday**.
2. One order per restaurant per delivery date — `UNIQUE(restaurant_id, delivery_date)`, last save wins.
3. Ordering locked when admin closes a date → `delivery_dates.ordering_open = false`.
4. **Financial source of truth = `deliveries` + `delivery_items`**, NOT `order_items`.
5. Q1 2026 benchmark: $21,633 production / $1,536 expenses / $12K farmer pay.
6. Items support multi-unit (comma-separated `unit_type`) with optional per-unit pricing in `unit_prices` JSONB and `default_price` fallback.
7. Order-form quantity keys (don't break — review/submit code expects this):
   - `availId__unit:UNIT__SIZE` — multi-unit + size
   - `availId__unit:UNIT` — multi-unit only
   - `availId__SIZE` — size only
   - `availId` — plain

## Brand & Design System

The brand is built out — **do not redesign without an explicit ask**.

- **Logo**: mandala (color/mono/gold/black), circular seal, horizontal/stacked/wordmark, app icon. Live under `public/assets/pressfarm/logo/`.
- **Flowers**: ~38 hand-illustrated botanicals at `public/assets/pressfarm/flowers/`. Auto-resolve via `src/lib/flower-images.ts`. Don't rename/delete files without checking `flowerImageForName()` callers and `FLOWER_NAME_MAP`. Legacy alias `"fairyvetch"` exists for the old Hairy Vetch misspelling.
- **Typography**: Bank Gothic LT (wordmark + tagline), Cormorant Garamond (display), Inter (body), JetBrains Mono (code).
- **Tokens**: prefer `pf-*` (`--pf-master-blue`, `--pf-master-orange`, `--pf-master-violet`) for new work. `farm-green / farm-cream / farm-dark / farm-muted` are core legacy and still used everywhere — don't remove.
- **Status palette**: blue-700/100 = info/update, amber-700/800 = soft warn, red-700/800 = error, farm-green = success. Match `badge-blue/gold/red/green` tone families. **No ad-hoc colors.**
- **Mobile-first**: 375px primary breakpoint. Touch targets ≥ 44×44px. Admin uses bottom-nav, chefs use two screens. PWA at `/manifest.json`.

## Established UI Patterns

- **EditorialHero** (`src/components/shared/EditorialHero.tsx`) — magazine-cover hero block on most admin pages. Pass `eyebrow / title / subtitle / flower / backHref`. Use this for any new resource page.
- **FloralCorners** — global subtle decorative flower corners.
- **Per-resource Import/Export pages** at `/admin/{resource}/data` (items, expenses, deliveries). Pattern: server-component + EditorialHero + stat strip + tab switcher (Export | Import) + drop zone + preview/result cards. CSV is the round-trip format; `id` or `name` is the upsert key. `items-csv` auto-detects KEY-tab XLSX, `deliveries-csv` auto-detects DELIVERY TRACKER XLSX. Legacy `/admin/settings/import` is **deleted** — never recreate.
- **Order form** (`src/components/order/`) — multi-unit + multi-size + multi-color, key conventions above.

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server only, bypasses RLS
RESEND_API_KEY=                   # server only
NEXT_PUBLIC_APP_URL=              # https://pressfarm.io or localhost:3000
RESEND_FROM_*                     # optional per-purpose sender overrides (orders/availability/digest/timesheet/noreply)
```

## Conventions

**Commits**
- Conventional prefixes: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.
- Multi-line bodies via heredoc.
- Trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- Push to `origin/main` triggers Vercel deploy. No PRs — push when work is solid.

**Migrations**
- Numbered sequentially in `supabase/migrations/NNN_description.sql`. Next is **045**.
- The user does NOT have `supabase` CLI linked. After writing a migration, present the SQL to Micheal — he runs it in the web SQL editor at `https://supabase.com/dashboard/project/rxdfjaseilmjvcwamqyk/sql/new`.
- Schema-dependent SELECTs will fail page loads with "column does not exist" until the migration runs. Either ship migration + code together OR ship code first without referencing the new column and re-enable after Micheal confirms the migration ran. **We've been bitten by this twice — be careful.**
- **Expected advisor noise:** Supabase's `unindexed_foreign_keys` linter will flag ~15 FK columns on `event_requests`, `farm_expenses`, `farm_notes`, `labor_entries`, `plantings`, `price_history`, `receiver_notify_log`, `restaurant_users`, `restaurants`, `suggestions`, `crop_plan_entries`. These indexes were intentionally dropped in migration 044 — the tables are single-tenant or tiny (≤549 rows) so the planner prefers seq scans. **Don't re-add them without checking row counts first.** Rollback statements are commented at the bottom of `044_drop_unused_indexes.sql` if a regression appears.

**Build**
- Always `npm run build` before committing — auto-deploy means a broken push goes straight to prod.
- TypeScript strict; `(supabase as any)` casts are acceptable where generated types lag.

## Source Data (legacy import targets)

**Daily Delivery Tracking Sheet (DO NOT MODIFY).xlsx** — `C:\Users\mikej\Downloads\OneDrive_1_3-19-2026 (1)\All Recipes + Kitchen Documents\1.9 - Farm & Preservation\`

- **KEY** tab — 289 items (Item Name, Unit, Price Per Unit) → `items-csv` importer auto-detects.
- **DELIVERY TRACKER** tab — historical deliveries → `deliveries-csv` importer auto-detects.
- **Farm Expenses** tab — expense history → `expenses-csv` importer (CSV preferred).

## What's Currently Shipping

- Auth: admin email+pw + chef magic link.
- Chef order portal (list / review / confirmed) with multi-unit + size + color.
- Chef order history.
- Admin dashboard with weather widget.
- Item catalog list + detail with multi-unit and per-unit pricing.
- Availability editor with per-unit / size / color overrides.
- Orders dashboard, per-date detail, harvest list, shortage workflow.
- Delivery log, per-date detail, EOM finalize.
- Per-resource Import/Export for items, expenses, deliveries (CSV round-trip + auto-detect XLSX).
- Reports: income, expenses, items, YoY, executive, crop revenue ranking, labor cost per delivery.
- Labor tracking + weekly timesheet email (React Email).
- Crop plan + plantings, forecast page.
- Calendar (monthly grid with order/delivery/notify badges).
- Notes, suggestions, photos manager.
- Offer sheet (printable/shareable PDF-style view per delivery date).
- Public About page with partner restaurants + logos.
- Resend email pipelines (8 React Email templates + 2 raw HTML).
- Public read-only `/api/v1/*` endpoints.
- Editorial brand system + UI Kit reference page.
- `/admin/microgreens` — production module: variety library, demand targets, sow plan dashboard, tray ops (soaking→blackout→light→harvesting→terminated), harvest event log, calendar. 53 unit tests covering the algorithm.

## Open Follow-ups (Prioritized)

1. **P&L PDF export** — `/admin/reports/executive` renders a full P&L view but there's no "Download PDF" button. Adding one needs a PDF library decision (puppeteer / @react-pdf/renderer / browser print) — ask Micheal before adding a dep.
2. **"Financial fixes" backlog** — placeholder for any pricing / margin / line-total bugs Micheal surfaces during use. No concrete items currently.

Pack manager is descoped (Micheal 2026-05-15) — do not build `src/app/admin/packs/`. The `pack_inventory` table from migration 020 stays unused.

Calendar (`/admin/calendar`), offer sheet (`/admin/availability/[date]/offer-sheet`), labor tracker (`/admin/labor`), photos (`/admin/items/photos`), forecast (`/admin/forecast`), crop revenue (`/admin/reports/crops`), and labor efficiency (`/admin/reports/labor-efficiency`) all ship. Email-trigger audit completed 2026-05-15 — all 8 React Email templates + weekly-digest + send-timesheet have senders wired at the right flow point.

## How to Operate

**Safe autonomously** (just push):
- Bug fixes, UI polish in brand palette, additive columns + matching migration, perf, refactors, docs, tests.

**Check in first**:
- New top-level pages or nav restructuring, new external deps, anything touching auth/RLS, pricing or financial-calculation logic, chef-facing email content, schema drops/renames.

**Never**:
- `git push --force` on `main`, skip pre-commit hooks, commit `.env.local` or service-role keys, delete migrations, recreate `/admin/settings/import`, make UI more "dashboardy" (the brand is editorial, mobile-first, restrained).

## When Stuck

1. Read this file, the latest migration, and `src/lib/constants.ts`.
2. Search nearby code — most problems have a precedent.
3. Schema change needed? Write the migration, ask Micheal to run it.
4. Brand voice unclear? Check `src/app/admin/ui-kit/page.tsx` and `src/app/about/page.tsx`.
5. Fully blocked? Leave a `// TODO(openclaw):` and surface it in your status update.

## Status Reporting

After each work session, post to peer-bus under 200 words:
- What changed (commit SHA + 1 line per change)
- What's deployed
- What needs Micheal's attention (migrations to run, decisions)
- What's next
