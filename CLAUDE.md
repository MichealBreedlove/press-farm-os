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
| AI | Anthropic SDK (`@anthropic-ai/sdk`) — inbound-email task extraction, catalog audit, bulk item-content drafting, crop recommendations |
| Excel/CSV | SheetJS (xlsx) for legacy formats; CSV is the round-trip format |
| Styling | Tailwind + custom `farm-*` and `pf-*` token namespaces |
| Tests | Vitest — 233 tests across 29 files in top-level `tests/` |
| Monitoring | Sentry (`@sentry/nextjs`) — inert until `NEXT_PUBLIC_SENTRY_DSN` is set in Vercel |

Repo: github.com/MichealBreedlove/press-farm-os
Local: `D:\LLM\LLM Projects\press-farm-os`

## Repo Structure

```
src/
  app/
    login/                       # Username/password + magic link login
    signup/                      # Public chef self-signup (open registration)
    order/                       # Chef portal — list / review / confirmed
    events/                      # Chef event-request flow (advance orders for events)
    history/                     # Chef order history
    receiver/                    # Destination-side unpack / check-in (+ archive)
    about/                       # Public — partner restaurants, brand voice
    admin/
      dashboard/                 # Admin home (weather widget, stats)
      items/                     # Catalog list + [itemId] detail (+ data/, photos/, audit/)
      availability/              # /[date] editor: per-unit / size / color toggles (+ offer-sheet)
      orders/                    # Dashboard + [date] detail + harvest list
      deliveries/                # Log + [date] detail + finalize (+ data/)
      expenses/                  # Farm expense log (+ data/)
      labor/                     # Time tracking + weekly timesheet email
      crop-plan/                 # Plantings + crop plan
      forecast/                  # Production forecasting
      seeds/                     # Seed inventory + sowings + germination tests
      microgreens/               # Microgreens production module (see What's Shipping)
      tasks/                     # Unified automated operations list (recurring sow / advance / harvest)
      inbox/                     # Inbound chef emails → AI-extracted task drafts (+ archived/)
      event-requests/            # Admin review of chef event requests
      foraging-calendar/         # Seasonal foraging reference calendar
      calendar/                  # Monthly grid with order/delivery/notify badges
      notes/                     # Farm notes
      reports/                   # income, expenses, items, yoy, executive, crops, labor-efficiency
      settings/                  # Users / data-check / emails / suggestions
      setup-shared-accounts/     # One-time provisioning of shared chef accounts
      ui-kit/                    # Brand reference page
    api/
      orders/                    # Submit / update / shortage
      availability/              # Publish / duplicate / toggle / notify / ordering lock / forecast-email
      deliveries/                # Log / finalize / export
      expenses/, items/          # CRUD + export
      import/                    # items-csv, expenses-csv, deliveries-csv
      labor/                     # CRUD + send-timesheet
      ai/                        # Anthropic-backed: draft-item-content, catalog-audit, bulk-fill-items, crop-recommendations
      tasks/                     # Task CRUD + complete/snooze/reopen/cancel + draft confirm/dismiss
      inbound/                   # Resend inbound webhook (signature-verified) — chef email replies
      cron/                      # tasks-regenerate, receiver-notify (Bearer CRON_SECRET, fail-closed)
      receiver/, seeds/, event-requests/, microgreens/
      plantings/, crop-plan/, notes/, photos/, suggestions/
      reports/                   # monthly, income, top-items, weekly-digest
      v1/                        # Public READ-ONLY (GET only) — items / orders / deliveries / expenses / availability / stats
      users/                     # CRUD + welcome email
      delivery-dates/, settings/, upload/, test-email/, test-emails-bulk/, email-status/
    auth/callback/               # Supabase auth redirect handler
  components/
    shared/                      # EditorialHero, FloralCorners, BottomNav, etc.
    order/                       # Multi-unit + multi-size + multi-color order form
    admin/                       # OrderCard, AvailabilityEditor, HarvestList, microgreens/, seeds/, etc.
  emails/                        # React Email templates
  lib/
    supabase/                    # client.ts (browser), server.ts, admin.ts (service role), middleware.ts
    resend/                      # client.ts + inbound.ts (HMAC signature verification)
    extraction/                  # AI parsing of inbound emails → item-requests / task-schedule
    tasks/                       # Recurring-task + microgreens regeneration, task queries
    forecasting/                 # Availability bucket + year-view forecasting
    microgreens/                 # Sow-plan algorithm, stages, seed data
    flower-images.ts             # name → /assets/pressfarm/flowers/*.png resolver
    api-auth.ts                  # validateApiKey (v1 shared-key gate)
    constants.ts                 # Categories, units, sizes, statuses (single source of truth)
    utils.ts                     # Date / currency formatting
  types/
    database.ts                  # DB types — regenerated; covers 37 tables + 4 views. Remaining `(as any)` casts are legacy, not required
    index.ts                     # App-level types + enriched join shapes
tests/                           # Vitest suites (microgreens, forecasting, tasks, api) — 233 tests
scripts/
  optimize-images.mjs            # Idempotent brand-image downsizer (npm run optimize:images)
  optimize-svg-logos.mjs         # Shrinks the base64 rasters EMBEDDED in logo SVGs (idempotent)
public/assets/pressfarm/
  logo/                          # Mandala (color/mono/gold/black), seal, lockups, app icon
  flowers/                       # ~38 hand-illustrated botanicals — used by flower-images.ts
supabase/migrations/             # 001 → 071 (75 files; see table — 044/047/062 used twice, 069 three times)
```

## Database Migrations

Base schema + microgreens (045), seed inventory (046), inbound-email/inbox (060: `inbound_messages`, `inbox_task_drafts`), order accountability (058: `order_audit`), and farm tasks (062: `farm_tasks`). **75 migration files, numbered 001 → 071** — numbers **044, 047, and 062 are each used by two files, and 069 by three** that all shipped (historical collisions; don't "fix" them). 064 confirmed applied — the live security advisors are clean; 066 + 067 + 068 applied via the Supabase MCP; 069–071 shipped with their features (production value, event orders, substitutions). **Next migration number is 072.** Read latest first when scoping work.

> **Prod/repo migration drift:** Supabase's *tracked* migration history doesn't mirror this repo — most repo migrations were run untracked via the SQL editor, and prod additionally contains MCP-applied migrations with no repo file (a `reporting` schema with cron + vault jobs, `farmer_pay_rates`, mustard-consolidation data fixes). Treat the repo files as the schema source of truth for `public`, but check prod before assuming a name is free.

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
| 047 | fix_nasturtium_leaves_miscategorization | Data fix — Nasturtium leaves category (collides with 047_microgreens_units) |
| 047 | microgreens_units | Unit-based yield + demand for microgreens (collides with 047_fix_nasturtium…) |
| 048 | fix_nasturtium_items | Nasturtium catalog cleanup (data-only) |
| 049 | nasturtium_leaf_palm_size | Adds "Palm" size to Nasturtium leaves |
| 050 | delivery_item_size | `delivery_items` size descriptor for drop-off logging |
| 051 | delivery_data_cleanup | Historical delivery data corrections |
| 052 | item_name_casing | Item name casing + consolidation |
| 053 | fill_unpriced_items | Fill unpriced items + consolidate Bean→Beans |
| 054 | plant_part_grouping | Fennel parts, Nasturtium capers, plant-part grouping |
| 055 | bucket_b_plant_parts | Bucket B plant-part splits |
| 056 | fix_nasturtium_flower_price | Nasturtium Flowers price fix |
| 057 | order_item_menu_section | `order_items` menu-section provenance (which menu the line came from) |
| 058 | order_accountability | `order_audit` table + who-placed / who-last-edited tracking on orders |
| 059 | items_seasonal_months | `items.seasonal_months` array |
| 060 | inbound_replies | `inbound_messages` + `inbox_task_drafts` — chef email replies → AI task drafts |
| 061 | fix_lg_qty_outliers | Targeted delivery + catalog corrections |
| 062 | farm_tasks | `farm_tasks` — unified automated operations list (recurring sow/advance/harvest) |
| 062 | microgreen_harvest_stage | `harvest_stage` enum + one-time timing bump (collides with 062_farm_tasks) |
| 063 | seed_puff_ball_marigold | Adds Puff Ball Marigold to catalog, published AVAILABLE |
| 064 | security_advisor_fixes | `seeds_with_on_hand` → security_invoker; revoke `match_inbound_sender` from anon/authenticated; pin `slide_recurring_anchor` search_path (DDL-only, no code change) |
| 065 | microgreen_demand_interval | `microgreen_demand.interval_weeks` (1=weekly default, 2=biweekly, …; anchored to `effective_from` or a fixed epoch) so demand can recur on a multi-week cadence; also drops the stale `target_oz > 0` CHECK that 047 left behind (it silently rejected unit-based inserts) |
| 066 | submit_order_rpc | `submit_order_with_items()` — atomic order submission (order upsert + item replace/merge in one transaction, SECURITY INVOKER so chef RLS applies; raises `ORDER_LOCKED` if status moved past chef-editable). POST `/api/orders` calls it via `.rpc()` |
| 067 | order_idempotency_and_submitted_at | Adds `orders.last_submission_token` + a `p_idempotency_key` arg to `submit_order_with_items()` (drops the 8-arg 066 overload): a retry carrying the same token is a no-op, so a lost-response retry can't re-merge and double an order. Also fixes 066 clobbering `submitted_at` on every edit — `ON CONFLICT` now `COALESCE`s it so the original submission time survives (edits live in `last_edited_*`) |
| 068 | submit_order_ordering_open_guard | `submit_order_with_items()` re-checks `delivery_dates.ordering_open` inside the transaction (raises `ORDERING_CLOSED`), closing the TOCTOU window where an admin closing the date between the route's JS pre-check and the write could still let a submission land. Signature unchanged from 067 (CREATE OR REPLACE) |
| 069 | item_size_prices | `items.size_prices` JSONB — per-SIZE pricing tier, most specific: size_prices[size] → unit_prices[unit] → default_price (collides with the other two 069s) |
| 069 | order_event_date | `orders.event_date` + `orders.event_name` — Events-team orders carry the event's own date distinct from delivery_date |
| 069 | production_value | `planter_boxes`, `planter_box_plantings`, `planter_box_activity` + `microgreen_crops.value_per_tray` — self-harvested production value stream, separate from `delivery_items` |
| 070 | orders_multiple_event_orders_per_date | One-order-per-(restaurant, date) becomes a PARTIAL unique index — Events orders (event_date NOT NULL) may repeat per date; chef orders stay unique |
| 071 | order_item_substitution | `order_items.replacement_item_id` FK + `replacement_label` / qty / unit — shortage substitution recorded on the shorted line |

## Auth Model

- **Admin**: Supabase email+password. Bypasses RLS via `is_admin()` helper.
- **Chefs**: Supabase magic link (or username/password for shared accounts). RLS scopes them to their restaurant via `user_restaurant_ids()`.
- **Receiver**: `receiver` role for destination-side unpack/check-in.
- `profiles` extends `auth.users` with `role` and `is_active`.
- `restaurant_users` join table maps users to restaurants.
- Service-role key (`createAdminClient`) is **server-only**. Never expose to browser.
- **Open signup**: `/signup` + `/api/auth/signup` let anyone self-register against any restaurant (auto-confirmed). This is intentional per Micheal — do **not** lock it down without an explicit ask. Each API route self-gates on `profiles.role` — most via the shared `requireAdmin()` helper in `src/lib/api-auth.ts`; a minority still inline the `getUser()` → fetch role → compare block.

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
- **Image weights**: brand PNGs are downsized to 768px (flowers) / 1024px (logos) — originals were 2048–3000px (141MB → 47MB). Keep new assets web-sized; run `npm run optimize:images` (idempotent, in-place, preserves PNG + filename + alpha) after adding art. Logos stay PNG because some email clients can't render WebP. The logo **SVGs** embed the mandala as a base64 raster — `node scripts/optimize-svg-logos.mjs` (idempotent) caps those embedded rasters at 1024px (was 30MB across 8 files, now ~5MB); run it if new logo SVGs are added.
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
NEXT_PUBLIC_SENTRY_DSN            # optional — Sentry error capture stays OFF until set
SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN  # optional — only for build-time source-map upload
UPSTASH_REDIS_REST_URL           # optional — rate limiting for /api/contact + /api/auth/signup
UPSTASH_REDIS_REST_TOKEN         # optional — both must be set; fail-open + inert until then (src/lib/ratelimit.ts). The Vercel↔Upstash Marketplace integration instead injects KV_REST_API_URL / KV_REST_API_TOKEN, which ratelimit.ts also reads.
```

## Conventions

**Commits**
- Conventional prefixes: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.
- Multi-line bodies via heredoc.
- Trailer: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- Push to `origin/main` triggers Vercel deploy. No PRs — push when work is solid.

**Migrations**
- Numbered sequentially in `supabase/migrations/NNN_description.sql`. Next is **072**. (044/047/062 each collide across two files and 069 across three — don't add to those numbers.)
- The user does NOT have `supabase` CLI linked. Apply migrations via the Supabase MCP (`apply_migration`, project `rxdfjaseilmjvcwamqyk`) when it's available in the session; otherwise present the SQL to Micheal — he runs it in the web SQL editor at `https://supabase.com/dashboard/project/rxdfjaseilmjvcwamqyk/sql/new`.
- Schema-dependent SELECTs will fail page loads with "column does not exist" until the migration runs. Either ship migration + code together OR ship code first without referencing the new column and re-enable after Micheal confirms the migration ran. **We've been bitten by this twice — be careful.**
- **Expected advisor noise:** Supabase's `unindexed_foreign_keys` linter will flag ~15 FK columns on `event_requests`, `farm_expenses`, `farm_notes`, `labor_entries`, `plantings`, `price_history`, `receiver_notify_log`, `restaurant_users`, `restaurants`, `suggestions`, `crop_plan_entries`. These indexes were intentionally dropped in migration 044 — the tables are single-tenant or tiny (≤549 rows) so the planner prefers seq scans. **Don't re-add them without checking row counts first.** Rollback statements are commented at the bottom of `044_drop_unused_indexes.sql` if a regression appears.

**Build**
- Always `npm run build` before committing — auto-deploy means a broken push goes straight to prod.
- The build **enforces** TypeScript and ESLint (`next.config.js` no longer ignores either). A type or lint *error* fails the build by design; warnings (e.g. `<img>` usage) don't. `tsc --noEmit`, `next lint`, and `vitest run` should all be clean before pushing.
- TypeScript strict; `(supabase as any)` casts are acceptable where `database.ts` doesn't yet cover a table (~16 tables uncovered). Note: `next build` validates route files — `app/api/**/route.ts` may only export HTTP handlers + recognized route config, never helper functions.

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
- Public **read-only** (GET-only) `/api/v1/*` endpoints — gated by a single shared `PRESSFARM_API_KEY`. Write verbs were removed; mutations go through authenticated `/api/*` routes.
- Editorial brand system + UI Kit reference page.
- `/admin/microgreens` — production module: variety library, demand targets, sow plan dashboard, tray ops (soaking→blackout→light→harvesting→terminated), harvest event log, calendar.
- `/admin/seeds` — seed inventory, sowings, germination tests (`seeds_with_on_hand` view).
- `/admin/tasks` — unified automated operations list; a nightly cron (`/api/cron/tasks-regenerate`) generates recurring sow/advance/harvest tasks; complete/snooze/reopen/cancel.
- `/admin/inbox` — chef email replies arrive via the Resend inbound webhook (`/api/inbound/reply`, HMAC-verified), get parsed by the Anthropic SDK (`src/lib/extraction/`) into task drafts you confirm or dismiss.
- `/admin/event-requests` + chef `/events` — advance event-order flow.
- `/admin/foraging-calendar` — seasonal foraging reference.
- Individual-account order accountability (`order_audit`, migration 058).
- `/receiver` — destination-side unpack / check-in.
- **233 Vitest tests** across 29 files in `tests/` — concentrated on the microgreens algorithm, forecasting, tasks, production value, and the order-submit pure cores (pricing precedence, line-merge planning, availability resolution, v1 API-key gate). (The route-level financial flows — deliveries logging, reports — still have no automated coverage.)
- Sentry error monitoring wired (`sentry.*.config.ts` + `withSentryConfig`) — **inactive until `NEXT_PUBLIC_SENTRY_DSN` is set in Vercel** (optionally `SENTRY_ORG/PROJECT/AUTH_TOKEN` for source maps).

## Open Follow-ups (Prioritized)

1. ~~P&L PDF export~~ — **Done.** `/admin/reports/executive` has a "Download PDF" button (`PrintButton` → `window.print()`); the `@media print` block in `globals.css` scopes `.exec-report` to a one-page letter-portrait P&L (nav/decoration hidden via `.print-hide`). No PDF dependency — browser print-to-PDF.
2. **"Financial fixes" backlog** — placeholder for any pricing / margin / line-total bugs Micheal surfaces during use. No concrete items currently.

**Audit follow-ups (codebase audit, 2026-06-01):**
3. **Remove stale `(supabase as any)` / `(admin as any)` casts** — `database.ts` was regenerated (37 tables + 4 views) but ~248 casts remain, most on tables that ARE typed, silently discarding coverage. Only `planter_box_*` and `pack_inventory` genuinely lack types. Strip casts incrementally with `tsc` as the guard; don't write new ones. (The old requireAdmin-extraction half of this item is done — shared helper in `src/lib/api-auth.ts`, shadow copies removed 2026-07-04.)
4. ~~Reports full-table JS aggregation~~ — **Largely done.** The big scan (`delivery_items`, 3.7k rows, fastest-growing) is now SQL via the `report_item_revenue` view (migration 065). The residual month/year rollup over `deliveries` (~403) + `farm_expenses` (~132) is intentionally left in JS — tiny bounded tables, and a new view would couple `main`'s auto-deploy to a manual migration for negligible gain. Revisit only if `deliveries` grows into the tens of thousands.
5. ~~Unbounded list queries~~ — **Done (2026-06-10).** Chef history was already paginated (`.range()`); labor caps at 1000; notes (500) and event-requests (300) now have limits. Items catalog stays unbounded on purpose — it's the full-catalog admin view (~300 rows).
6. ~~Dead code~~ — **Done (2026-06-14).** The `historicalDeliveryItems` reserved path is removed from `sowPlan` + both callers (dropped two unused `delivery_items` queries). The earlier "orphaned `components/shared/`" list was stale: `PageHeader` / `TopBar` / `status-badge.tsx` / `delivery-date-picker.tsx` were already deleted, and `EmptyState` is still imported in 4 files.
7. ~~Supabase advisors~~ — **Done.** 064 is applied; the live security-advisor list is empty (verified 2026-06-10). Still manual: enable leaked-password protection in the Auth dashboard.
8. **Activate Sentry** — create a free sentry.io project and set `NEXT_PUBLIC_SENTRY_DSN` in Vercel; the SDK is already wired and ships inert without it.

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
