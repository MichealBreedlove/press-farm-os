# Press Farm OS — Claude Code Context

## What This Is

Farm-to-kitchen ordering and availability management system for Press Farm (Yountville, CA).
Replaces manual Excel order sheets with a mobile-first web app.

**Two user types:**
- **Admin (Micheal)** — iPhone-first. Updates availability, reviews orders, marks shortages, logs deliveries, runs financial reports.
- **Chefs (Press + Understudy)** — Magic link auth. Place orders the night before delivery (Thu/Sat/Mon schedule). Rotating staff.

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 14 App Router + TypeScript |
| Database | Supabase (PostgreSQL 15) |
| Auth | Supabase Auth (magic link for chefs, email+password for admin) |
| Hosting | Vercel |
| Email | Resend + React Email |
| Charts | Recharts |
| Excel parsing | SheetJS (xlsx) |
| Styling | Tailwind CSS |

## Repo Structure

```
src/
  app/                    # Next.js App Router pages
    login/                # Magic link login
    order/                # Chef portal (/, /review, /confirmed)
    history/              # Chef order history
    admin/                # Admin portal
      orders/             # Orders dashboard + detail + harvest list
      availability/       # Availability editor per delivery date
      items/              # Item catalog CRUD
      deliveries/         # Delivery log + EOM finalization
      reports/            # Financial dashboard + income + expenses
      settings/           # Users + farm settings + Excel import
    api/                  # Route handlers
      orders/             # Order submit/update/shortage
      availability/       # Publish + duplicate last cycle
      deliveries/         # Log delivery + finalize month
      expenses/           # Farm expense CRUD
      import/             # Excel import (key-tab + delivery-history)
      reports/            # Monthly, income, top-items
    auth/callback/        # Supabase auth redirect handler
  components/
    shared/               # StatusBadge, BottomNav, DeliveryDatePicker
    order/                # ItemRow, CategorySection (chef portal)
    admin/                # OrderCard, AvailabilityEditor, HarvestList, etc.
  emails/                 # React Email templates (5 templates)
  lib/
    supabase/             # client.ts, server.ts, admin.ts, middleware.ts
    resend/               # client.ts
    constants.ts          # Categories, units, statuses, app config
    utils.ts              # Date formatting, currency, etc.
  types/
    database.ts           # Supabase-compatible DB types (manually maintained)
    index.ts              # App-level types + enriched types (joins)
supabase/
  migrations/
    001_initial_schema.sql    # Tables: farms, restaurants, profiles, items, orders, etc.
    002_rls_policies.sql      # All RLS policies + is_admin() + user_restaurant_ids()
    003_functions_triggers.sql # update_updated_at, handle_new_user, update_delivery_total
    004_seed_data.sql         # Press Farm, 2 restaurants, initial items, delivery dates
    005_delivery_tracking.sql # price_history, price_catalog, deliveries, delivery_items
    006_farm_expenses.sql     # farm_expenses
    007_notifications_views.sql # notifications, financial_periods view, most_ordered_items view
```

## Database Schema Overview

15 tables + 2 views. Key relationships:

```
farms → restaurants → restaurant_users ← profiles (auth.users)
items → availability_items ← orders → order_items
items → price_catalog
deliveries → delivery_items ← items
farm_expenses
notifications
```

- **availability_items** — per-restaurant, per-date availability (replaces Excel color rows)
- **orders** — one per restaurant per delivery date; unique constraint enforces this
- **deliveries** — actual delivery log (financial source of truth, NOT orders)
- **financial_periods** — VIEW: monthly rollup of delivery values + expenses

## Auth Model

- Admin: Supabase email+password. Full access. Bypasses RLS via `is_admin()` helper.
- Chefs: Supabase magic link. RLS restricts to own restaurant's data only.
- `profiles` table extends `auth.users` with `role` and `is_active`.
- `restaurant_users` join table maps users to restaurants.

## Key Business Rules

1. Delivery schedule: **Thursday, Saturday, Monday**
2. One order per restaurant per delivery date (unique constraint, last save wins)
3. Ordering locked when admin calls close ordering → `delivery_dates.ordering_open = false`
4. Financial source of truth = `deliveries` + `delivery_items`, NOT `order_items`
5. Q1 2026 benchmark: **$21,633 production value / $1,536 expenses / $12K farmer pay**
6. 289 items to import from KEY tab of Daily Delivery Tracking Sheet

## Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL=       # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Supabase anon key (public)
SUPABASE_SERVICE_ROLE_KEY=      # Service role (server only, bypasses RLS)
RESEND_API_KEY=                 # Resend API key (server only)
NEXT_PUBLIC_APP_URL=            # https://pressfarm.app (or localhost:3000)
```

## Setup Steps

```bash
# 1. Install deps
npm install

# 2. Copy env file
cp .env.example .env.local
# Fill in Supabase + Resend values

# 3. Run migrations (via Supabase dashboard SQL editor or CLI)
# Run 001 through 007 in order

# 4. Start dev server
npm run dev
```

## Supabase CLI (optional)

```bash
# Link to project
npx supabase link --project-ref YOUR_PROJECT_ID

# Push migrations
npx supabase db push

# Generate types (after schema is final)
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts
```

## Phase 1 Build Order

Read the workflow docs before building each feature:

| Priority | Feature | Docs |
|----------|---------|------|
| 1 | Auth (magic link + email/password) | prd §4.9 |
| 2 | Chef ordering portal | chef-workflow.md |
| 3 | Admin availability editor | admin-workflow.md §1 |
| 4 | Admin orders dashboard + harvest list | admin-workflow.md §2-5 |
| 5 | Email notifications (Resend) | prd §4.4 |
| 6 | Delivery logging | admin-workflow.md §9 |
| 7 | Financial dashboard + reports | admin-workflow.md §8,10 |
| 8 | Excel import (289 items) | admin-workflow.md §11, tech-stack migration plan |

## Source Data

**Daily Delivery Tracking Sheet (DO NOT MODIFY).xlsx**
Location: `C:\Users\mikej\Downloads\OneDrive_1_3-19-2026 (1)\All Recipes + Kitchen Documents\1.9 - Farm & Preservation\`

Key tabs:
- **KEY** — 289 items: Item Name, Unit, Price Per Unit → imports to `items` + `price_catalog`
- **DELIVERY TRACKER** — Historical deliveries back to 2025-01-01 → imports to `deliveries` + `delivery_items`
- **Farm Expenses** — expense history → imports to `farm_expenses`

## Mobile-First Constraints

- Primary breakpoint: 375px (iPhone SE)
- All touch targets: minimum 44×44px
- Admin: Bottom tab nav (5 tabs)
- Chef: Two screens (Order + History)
- PWA manifest at `/manifest.json` — "Add to Home Screen" on iPhone

## What's Built (Scaffold)

- [x] package.json + all dependencies installed
- [x] Next.js config (next.config.js, tsconfig.json, tailwind, postcss)
- [x] Supabase migrations 001-007 (all tables, RLS, triggers, views)
- [x] Supabase client config (browser, server, admin, middleware)
- [x] TypeScript types (database.ts + index.ts)
- [x] Constants + utils + Resend client
- [x] All page routes (stub pages with TODOs)
- [x] Key component stubs (ItemRow, CategorySection, OrderCard, etc.)
- [x] React Email templates (5 templates, basic structure)
- [x] .env.example
- [x] PWA manifest.json

## What's NOT Built Yet

- [ ] Login form UI
- [ ] Chef order form (full UI with fetch + submit)
- [ ] Admin availability editor (full UI)
- [ ] Admin orders dashboard (full UI)
- [ ] Shortage marking workflow
- [ ] Delivery log form
- [ ] Financial dashboard (Recharts)
- [ ] Reports (monthly, income statement)
- [ ] Excel import with SheetJS
- [ ] All API route logic (currently return 501)
- [ ] shadcn/ui component library (`npx shadcn-ui@latest init`)
- [ ] PWA icons (icon-192.png, icon-512.png)
