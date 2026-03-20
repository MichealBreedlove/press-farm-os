# Press Farm OS — Tech Stack Decision Document

**Version:** 2.0
**Date:** 2026-03-19
**Author:** Micheal Breedlove
**Updated:** Added data migration plan, charting library, and expanded repo structure

---

## Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | Next.js (App Router) | 14.x |
| UI Framework | Tailwind CSS + shadcn/ui | Latest |
| Backend | Next.js API Routes + Server Actions | Same |
| Database | Supabase (PostgreSQL) | Latest |
| Auth | Supabase Auth (magic link + email/password) | Built-in |
| Row Level Security | Supabase RLS policies | Built-in |
| Hosting | Vercel | Pro plan |
| Email | Resend | API |
| SMS (Phase 2) | Twilio | API |
| Charts | Recharts | Latest |
| Excel Parsing | SheetJS (xlsx) | Latest |
| Development | Claude Code | Latest |
| Version Control | GitHub | MichealBreedlove org |

---

## Decision: Next.js (App Router)

**Why:**
1. Single codebase for frontend + backend (API routes, server actions).
2. Server-side rendering for fast initial load on chef's phone.
3. App Router enables server components — less client JS, faster on mobile.
4. Built-in PWA support via `next-pwa` for "Add to Home Screen".
5. First-class Vercel deployment (zero-config).
6. Micheal's existing familiarity from other projects.

**Alternatives considered:**

| Alternative | Why Not |
|-------------|---------|
| SvelteKit | Less ecosystem, fewer UI component libraries. Micheal not familiar. |
| Remix | Good alternative but smaller community. Vercel deployment less mature. |
| Plain React + Express | More setup, more moving parts, no SSR out of the box. |
| Flutter/React Native | Native mobile not needed. PWA is sufficient for this use case. |

**Key Next.js config decisions:**
- App Router (not Pages Router)
- Server Components by default, `'use client'` only where needed (quantity inputs, interactive forms)
- Dynamic routes: `/order`, `/admin/orders/[date]`, `/admin/availability/[date]`
- Middleware for auth redirect (check Supabase session → redirect to `/login` if missing)

---

## Decision: Supabase

**Why:**
1. PostgreSQL with zero ops — managed database, backups, scaling.
2. Built-in Auth with magic link support (core requirement for rotating chef staff).
3. Row Level Security (RLS) — enforces per-restaurant data isolation at the database level.
4. Real-time subscriptions (future: live order updates on admin dashboard).
5. JS client library (`@supabase/supabase-js`) integrates directly with Next.js.
6. Free tier sufficient for development. Pro tier ($25/mo) for production.
7. Dashboard for quick data inspection during development.

**Alternatives considered:**

| Alternative | Why Not |
|-------------|---------|
| PlanetScale (MySQL) | No built-in auth, no RLS equivalent, requires separate auth service. |
| Firebase | NoSQL (Firestore) — relational data model is a better fit for orders/items/availability. |
| Neon (Postgres) | Good Postgres option but no built-in auth or RLS tooling. Would need separate auth. |
| Self-hosted Postgres | Micheal has homelab skills but unnecessary ops burden for this project. |
| Prisma + any DB | ORM adds complexity. Supabase client + raw SQL is simpler for this scale. |

**Supabase project structure:**
- One project: `press-farm-os`
- Two environments: `development` (free tier) + `production` (Pro tier)
- Environment separation via Supabase branching or separate projects

**Supabase features used:**

| Feature | Usage |
|---------|-------|
| Database (Postgres) | All application data |
| Auth | Magic link for chefs, email/password for admin |
| RLS | Per-restaurant data isolation |
| Storage | Not in Phase 1 (future: item photos) |
| Edge Functions | Not in Phase 1 (future: webhook handlers) |
| Realtime | Not in Phase 1 (future: live order board) |

---

## Decision: Vercel

**Why:**
1. Zero-config deployment for Next.js (same company).
2. Automatic preview deployments per PR.
3. Edge network — fast globally (though users are all in Yountville).
4. Serverless functions for API routes — no server management.
5. Environment variables managed in dashboard.
6. Free tier for development. Pro ($20/mo) for custom domain.

**Alternatives considered:**

| Alternative | Why Not |
|-------------|---------|
| Netlify | Next.js support less native than Vercel. |
| Railway | Good for full-stack but Vercel is more optimized for Next.js. |
| Self-hosted (Coolify on homelab) | Unnecessary ops. Vercel is cheaper and more reliable for this. |
| AWS Amplify | More complex setup. Overkill. |

**Vercel config:**
- Custom domain: `pressfarm.app` (or `pressfarm.vercel.app` initially)
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`
- Build: `next build`
- Node.js: 20.x

---

## Decision: Resend (Email)

**Why:**
1. Developer-friendly API — simple REST calls or Node SDK.
2. React Email integration — build email templates as React components.
3. Free tier: 3,000 emails/month (more than enough — ~100 orders/month max).
4. Deliverability: DKIM/SPF/DMARC setup via custom domain.
5. Logs: see what was sent, delivered, bounced.

**Alternatives considered:**

| Alternative | Why Not |
|-------------|---------|
| SendGrid | Heavier, more complex, overkill for ~100 emails/month. |
| AWS SES | Cheapest but requires more setup and monitoring. |
| Postmark | Good but Resend's React Email templates are a better DX. |
| Supabase built-in email | Limited customization, rate limits, no templates. Only suitable for auth emails. |

**Email setup:**
- From: `orders@pressfarm.app` (custom domain verified in Resend)
- Reply-to: Micheal's email
- Templates built with React Email (TSX components)
- Sent from Next.js API routes (server-side only — never expose API key to client)

**Email templates needed (Phase 1):**

| Template | Trigger | Recipient |
|----------|---------|-----------|
| `order-confirmation.tsx` | Chef submits order | Chef |
| `order-received.tsx` | Chef submits order | Admin |
| `shortage-notice.tsx` | Admin marks shortages | Chef |
| `order-fulfilled.tsx` | Admin marks fulfilled | Chef |
| `availability-published.tsx` | Admin publishes availability | All chefs for restaurant |
| `magic-link.tsx` | Chef requests login | Chef (via Supabase Auth custom template) |

---

## Decision: Twilio SMS (Phase 2)

**Why deferred:**
1. Email covers Phase 1 notification needs.
2. SMS adds cost per message (~$0.0079/msg).
3. Twilio requires phone number verification, A2P 10DLC registration.
4. Phase 2 adds SMS only for shortage notifications (morning sous chef text).

**Phase 2 plan:**
- Twilio Programmable SMS API
- Send shortage notices as SMS in addition to email
- Phone number stored in `profiles` table (column to be added in Phase 2)
- Estimated volume: <50 SMS/month

---

## Decision: Recharts (Financial Charts)

**Why:**
1. Built for React — composable chart components that work natively with Next.js.
2. Already in the Next.js/React ecosystem — no additional framework needed.
3. Responsive by default — works on mobile dashboard.
4. Supports all needed chart types: bar (monthly value), line (trends), pie (category breakdown).
5. Lightweight compared to D3.js — less complexity for the charts we need.

**Alternatives considered:**

| Alternative | Why Not |
|-------------|---------|
| Chart.js + react-chartjs-2 | Works but Recharts has better React integration and less boilerplate. |
| D3.js | Too low-level. Overkill for standard bar/line charts. |
| Nivo | Good but heavier dependency. Recharts is simpler. |
| Tremor | Nice dashboards but adds another UI framework on top of shadcn. |

**Charts needed (Phase 1):**

| Chart | Type | Data Source |
|-------|------|------------|
| Monthly delivery value | Bar chart | deliveries.total_value grouped by month |
| Value by restaurant | Stacked bar | deliveries grouped by restaurant_id |
| EOM running total | Line chart | Cumulative delivery value through month |
| Top items by value | Horizontal bar | delivery_items aggregated |
| Expense breakdown | Pie/donut | farm_expenses by category |
| Quarterly income | Grouped bar | financial_periods view |

---

## Decision: SheetJS (Excel Import)

**Why:**
1. Industry-standard for reading .xlsx files in JavaScript.
2. Parses the Daily Delivery Tracking Sheet KEY tab (289 items) and DELIVERY TRACKER tab.
3. Works server-side in Next.js API routes — file never exposed to client.
4. Handles multiple sheets, cell types, and formulas.
5. Free for reading (community edition). No license cost.

**Import targets:**

| Source Tab | Target Tables | Row Count |
|------------|--------------|-----------|
| KEY | items + price_catalog | 289 items |
| DELIVERY TRACKER | deliveries + delivery_items | ~500+ rows (2025-present) |
| Farm Expenses | farm_expenses | ~50 rows |

**Import flow:**
1. Admin uploads .xlsx via Settings → Data Import
2. Next.js API route reads file with SheetJS
3. Parses tabs, maps columns to database fields
4. Preview shown to admin for validation
5. On confirm, rows inserted via Supabase service role client
6. Summary report generated (items imported, errors, duplicates)

---

## Data Migration Plan

**Source file:** `Daily Delivery Tracking Sheet (DO NOT MODIFY).xlsx`
**Location:** `C:\Users\mikej\Downloads\OneDrive_1_3-19-2026 (1)\All Recipes + Kitchen Documents\1.9 - Farm & Preservation\`

### Migration Steps

| # | Step | Detail |
|---|------|--------|
| 1 | Parse KEY tab | Extract 289 rows: Item Name, Unit, Price Per Unit |
| 2 | Normalize units | Map Excel units to enum: EA→ea, SM→sm, LG→lg, LBS→lbs, BU→bu, QT→qt, BX→bx, CS→cs, PT→pt |
| 3 | Create items | Insert into `items` table. Auto-categorize by keyword matching where possible. Flag unknowns. |
| 4 | Create price_catalog entries | One row per item+unit combo with price_per_unit. source='market'. effective_date='2025-01-01'. |
| 5 | Parse DELIVERY TRACKER | Extract rows: Date, Item, Quantity, Unit, Price, Total |
| 6 | Match items | Match delivery tracker item names to imported items. Flag unmatched. |
| 7 | Create deliveries | Group by date → one delivery per date. restaurant_id = Press (default, can be adjusted). |
| 8 | Create delivery_items | One row per line item with quantity, unit, unit_price, line_total. |
| 9 | Calculate totals | Trigger auto-calculates delivery.total_value. |
| 10 | Parse Farm Expenses | If tab exists, import date/category/description/amount rows. |
| 11 | Validate | Compare imported EOM totals against Excel monthly summary tabs. |

### Migration SQL (seed data addition)

```sql
-- Add to 004_seed_data.sql or create 005_import_key_tab.sql
-- This will be auto-generated from the Excel parse, but structure is:
INSERT INTO items (farm_id, name, category, unit_type) VALUES
  ((SELECT id FROM farms LIMIT 1), 'Nasturtium Leaf', 'flowers', 'ea'),
  ((SELECT id FROM farms LIMIT 1), 'Oxalis/Lucky Sorrel', 'micros_leaves', 'sm'),
  -- ... 287 more rows from KEY tab
;

INSERT INTO price_catalog (item_id, unit, price_per_unit, effective_date, source) VALUES
  ((SELECT id FROM items WHERE name = 'Nasturtium Leaf'), 'ea', 0.35, '2025-01-01', 'market'),
  ((SELECT id FROM items WHERE name = 'Oxalis/Lucky Sorrel'), 'sm', 6.00, '2025-01-01', 'market'),
  -- ... 287 more rows
;
```

---

## Repository Structure

```
press-farm-os/
├── .env.local                    # Local env vars (not committed)
├── .env.example                  # Template for env vars
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
│
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql    # Tables, indexes, constraints
│   │   ├── 002_rls_policies.sql      # All RLS policies
│   │   ├── 003_functions.sql         # Helper functions, triggers
│   │   ├── 004_seed_data.sql         # Farm, restaurants, initial items
│   │   ├── 005_delivery_tracking.sql # deliveries, delivery_items, price_catalog tables
│   │   ├── 006_farm_expenses.sql     # farm_expenses table
│   │   ├── 007_financial_views.sql   # financial_periods view
│   │   └── 008_import_key_tab.sql    # 289-item seed data from KEY tab (auto-generated)
│   └── config.toml
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                # Root layout (Supabase provider)
│   │   ├── page.tsx                  # Redirect to /order or /admin
│   │   │
│   │   ├── login/
│   │   │   └── page.tsx              # Magic link login
│   │   │
│   │   ├── order/                    # Chef-facing pages
│   │   │   ├── page.tsx              # Main ordering interface
│   │   │   ├── review/page.tsx       # Order review
│   │   │   └── confirmed/page.tsx    # Post-submit confirmation
│   │   │
│   │   ├── history/                  # Chef order history
│   │   │   ├── page.tsx              # Order list
│   │   │   └── [orderId]/page.tsx    # Order detail
│   │   │
│   │   ├── admin/                    # Admin-facing pages
│   │   │   ├── layout.tsx            # Admin layout with bottom tabs
│   │   │   ├── orders/
│   │   │   │   ├── page.tsx          # Orders dashboard
│   │   │   │   ├── [date]/page.tsx   # Orders for a specific date
│   │   │   │   └── harvest/page.tsx  # Combined harvest list
│   │   │   ├── availability/
│   │   │   │   ├── page.tsx          # Availability dashboard
│   │   │   │   └── [date]/page.tsx   # Edit availability for date
│   │   │   ├── items/
│   │   │   │   ├── page.tsx          # Item catalog
│   │   │   │   └── [itemId]/page.tsx # Edit item
│   │   │   ├── deliveries/
│   │   │   │   ├── page.tsx          # Delivery log dashboard
│   │   │   │   ├── [date]/page.tsx   # Log/view delivery for date
│   │   │   │   └── finalize/page.tsx # EOM finalization
│   │   │   ├── reports/
│   │   │   │   ├── page.tsx          # Financial dashboard
│   │   │   │   ├── income/page.tsx   # Quarterly income statement
│   │   │   │   └── expenses/page.tsx # Expense tracking
│   │   │   └── settings/
│   │   │       ├── page.tsx          # Settings overview
│   │   │       ├── users/page.tsx    # User management
│   │   │       └── import/page.tsx   # Excel data import
│   │   │
│   │   └── api/
│   │       ├── orders/
│   │       │   ├── route.ts          # POST: submit order
│   │       │   └── [orderId]/
│   │       │       ├── route.ts      # PATCH: update order
│   │       │       └── shortage/route.ts  # POST: mark shortages
│   │       ├── availability/
│   │       │   ├── route.ts          # POST: publish availability
│   │       │   └── duplicate/route.ts # POST: duplicate last cycle
│   │       ├── items/
│   │       │   └── route.ts          # CRUD items
│   │       ├── notifications/
│   │       │   └── send/route.ts     # POST: send notification
│   │       ├── deliveries/
│   │       │   ├── route.ts          # POST: log delivery, GET: list deliveries
│   │       │   ├── [deliveryId]/
│   │       │   │   └── route.ts      # PATCH: update delivery, items
│   │       │   └── finalize/route.ts # POST: finalize month
│   │       ├── expenses/
│   │       │   └── route.ts          # CRUD farm expenses
│   │       ├── import/
│   │       │   ├── key-tab/route.ts  # POST: import KEY tab (289 items + prices)
│   │       │   └── delivery-history/route.ts  # POST: import DELIVERY TRACKER
│   │       └── reports/
│   │           ├── monthly/route.ts  # GET: monthly value report
│   │           ├── income/route.ts   # GET: quarterly income statement
│   │           └── top-items/route.ts # GET: most ordered items analysis
│   │
│   ├── components/
│   │   ├── ui/                       # shadcn/ui components
│   │   ├── order/
│   │   │   ├── item-row.tsx          # Single item ordering row
│   │   │   ├── category-section.tsx  # Collapsible category
│   │   │   └── order-summary.tsx     # Review screen summary
│   │   ├── admin/
│   │   │   ├── availability-editor.tsx
│   │   │   ├── order-card.tsx
│   │   │   ├── harvest-list.tsx
│   │   │   ├── shortage-form.tsx
│   │   │   ├── delivery-log-form.tsx  # Log delivery line items
│   │   │   ├── expense-form.tsx       # Add/edit farm expense
│   │   │   ├── financial-dashboard.tsx # Charts + summary cards
│   │   │   ├── income-statement.tsx   # Quarterly income view
│   │   │   ├── top-items-chart.tsx    # Most ordered items
│   │   │   └── excel-import.tsx       # File upload + preview for data import
│   │   └── shared/
│   │       ├── status-badge.tsx      # Available/Limited/Unavailable
│   │       ├── delivery-date-picker.tsx
│   │       └── bottom-nav.tsx        # Admin mobile navigation
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             # Browser client
│   │   │   ├── server.ts             # Server client
│   │   │   ├── admin.ts              # Service role client
│   │   │   └── middleware.ts          # Auth middleware
│   │   ├── resend/
│   │   │   └── client.ts             # Resend API client
│   │   ├── utils.ts                  # Shared utilities
│   │   └── constants.ts              # Categories, units, statuses
│   │
│   ├── emails/                       # React Email templates
│   │   ├── order-confirmation.tsx
│   │   ├── order-received.tsx
│   │   ├── shortage-notice.tsx
│   │   ├── order-fulfilled.tsx
│   │   └── availability-published.tsx
│   │
│   └── types/
│       ├── database.ts               # Supabase generated types
│       └── index.ts                  # App-level type definitions
│
├── public/
│   ├── manifest.json                 # PWA manifest
│   ├── icon-192.png
│   └── icon-512.png
│
└── README.md
```

---

## Development Workflow with Claude Code

### Setup Steps

| # | Step | Command |
|---|------|---------|
| 1 | Create repo | `gh repo create MichealBreedlove/press-farm-os --private` |
| 2 | Scaffold Next.js | `npx create-next-app@latest press-farm-os --typescript --tailwind --app --src-dir` |
| 3 | Install deps | `npm install @supabase/supabase-js @supabase/ssr resend react-email @react-email/components recharts xlsx` |
| 4 | Install dev deps | `npm install -D supabase @types/node` |
| 5 | Init Supabase | `npx supabase init` |
| 6 | Add shadcn/ui | `npx shadcn-ui@latest init` |
| 7 | Set env vars | Copy `.env.example` → `.env.local`, fill in Supabase + Resend keys |
| 8 | Run migrations | `npx supabase db push` (or via Supabase dashboard) |
| 9 | Seed data | Run `004_seed_data.sql` via Supabase SQL editor |
| 10 | Start dev | `npm run dev` |

### Claude Code Workflow

| Phase | What to Tell Claude Code |
|-------|-------------------------|
| Schema | "Run this SQL migration against my Supabase project" + paste migration file |
| Auth | "Set up Supabase Auth with magic link for chefs and email/password for admin" |
| Chef Portal | "Build the chef ordering page: fetch availability_items for the user's restaurant and delivery date, render by category, quantity inputs, freeform notes, submit to orders table" |
| Admin Portal | "Build the admin availability editor: list items by category, status toggle (available/limited/unavailable), limited_qty input, cycle_notes, publish button" |
| Notifications | "Set up Resend email sending: when an order is submitted, send confirmation to chef and notification to admin using these React Email templates" |
| Reports | "Build monthly value report: query delivery_items joined with items for date range, aggregate by restaurant, calculate totals, render as table with Recharts bar chart" |
| Delivery Logging | "Build delivery logging form: after fulfilling an order, admin logs actual delivery with line items (item, qty, unit, price). Pre-populate from fulfilled order. Auto-calculate line_total and delivery total." |
| Financial Dashboard | "Build financial dashboard with Recharts: monthly value bar chart, EOM running total line chart, expense breakdown pie chart, quarterly income statement table." |
| Data Import | "Build Excel import page: upload .xlsx, parse KEY tab with SheetJS, preview 289 items with name/unit/price, insert into items + price_catalog tables on confirm." |
| Expense Tracking | "Build expense tracking: CRUD form for farm_expenses (date, category, description, amount), list view with category filters, monthly totals." |

### Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + .env.local | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + .env.local | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel only (server) | Admin operations, bypasses RLS |
| `RESEND_API_KEY` | Vercel only (server) | Email sending |
| `NEXT_PUBLIC_APP_URL` | Vercel + .env.local | `https://pressfarm.app` |

---

## Deployment Strategy

| Environment | URL | Branch | Auto-deploy |
|-------------|-----|--------|-------------|
| Development | `press-farm-os-dev.vercel.app` | `dev` | Yes (push to dev) |
| Production | `pressfarm.app` | `main` | Yes (push to main) |

**Deployment checklist:**
1. All env vars set in Vercel dashboard
2. Supabase production project created (separate from dev)
3. Migrations run against production database
4. Custom domain (`pressfarm.app`) pointed to Vercel
5. Resend domain verified for `pressfarm.app`
6. Supabase Auth redirect URLs configured for production domain
7. PWA manifest and icons in place

---

## Cost Estimate (Monthly Production)

| Service | Plan | Cost |
|---------|------|------|
| Vercel | Pro | $20/mo |
| Supabase | Pro | $25/mo |
| Resend | Free tier (3K emails) | $0/mo |
| Domain (`pressfarm.app`) | Annual | ~$1/mo amortized |
| **Total** | | **~$46/mo** |

Phase 2 addition: Twilio SMS ~$5–10/mo depending on volume.
