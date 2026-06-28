# Press Farm OS

Farm-to-kitchen ordering and availability management for **Press Farm** (Yountville, CA). It replaces manual Excel order sheets with a mobile-first web app that runs the whole loop: what's available → what the chefs order → what gets delivered → what it all cost.

## Who uses it

- **Admin (Micheal)** — iPhone-first. Manages availability, reviews orders, logs deliveries, and tracks expenses, labor, crop plan, microgreens, seeds, and financial reports.
- **Chefs (Press + Under-Study)** — magic-link or shared-account login. Place orders the night before delivery on the Thu/Sat/Mon schedule.
- **Receiver** — destination-side unpack and check-in of arriving deliveries.

Restaurants modeled are **Press**, **Under-Study**, **Press Bar**, plus an **Events** pseudo-restaurant whose items surface on the Press / Under-Study order forms but save under the ordering chef's own restaurant.

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 14 (App Router) + TypeScript (strict) |
| Database | Supabase (PostgreSQL 15) with row-level security |
| Auth | Supabase Auth — magic link / shared accounts for chefs, email + password for admin |
| Hosting | Vercel — auto-deploys from `main` |
| Email | Resend + React Email |
| AI | Anthropic SDK — inbound-email task extraction, catalog audit, bulk item drafting, crop recommendations |
| Charts | Recharts |
| Excel/CSV | SheetJS (`xlsx`) for legacy formats; CSV is the round-trip format |
| Styling | Tailwind CSS with custom `farm-*` / `pf-*` design tokens |
| Tests | Vitest |
| Monitoring | Sentry (inert until `NEXT_PUBLIC_SENTRY_DSN` is set) |

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (enforces TypeScript + ESLint) |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest suite |
| `npm run test:watch` | Vitest in watch mode |
| `npm run optimize:images` | Idempotent brand-image downsizer |

> Always run `npm run build` before pushing — `main` auto-deploys to production, and the build fails on any TypeScript or ESLint error.

### Environment variables

Copy `.env.example` to `.env.local`. The essentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=     # server only — bypasses RLS, never expose to the browser
RESEND_API_KEY=                # server only
NEXT_PUBLIC_APP_URL=           # https://pressfarm.app or http://localhost:3000
```

Optional: `NEXT_PUBLIC_SENTRY_DSN` (error monitoring), `UPSTASH_REDIS_REST_*` (rate limiting), `EMAIL_OVERRIDE_TO` (reroute all outbound mail in testing), and per-purpose `RESEND_FROM_*` sender overrides. See `.env.example` for the full list and where to find each value.

## What it does

- **Chef order portal** — list / review / confirmed flow with multi-unit, multi-size, and multi-color line items; one order per restaurant per delivery date.
- **Availability editor** — per-date, per-unit / size / color toggles, plus a printable offer sheet.
- **Item catalog** — multi-unit items with per-unit pricing (`unit_prices` JSONB + `default_price` fallback), photos, and seasonal months.
- **Orders** — dashboard, per-date detail, harvest pick list, shortage / substitution workflow, and per-individual accountability.
- **Deliveries** — delivery log, per-date detail, and end-of-month finalize. **Deliveries are the financial source of truth, not orders.**
- **Reports** — income, expenses, items, year-over-year, executive P&L (print-to-PDF), crop revenue ranking, labor cost per delivery.
- **Microgreens** — production module: variety library, demand targets, sow-plan dashboard, tray ops, harvest log, and calendar.
- **Seeds** — inventory, sowings, germination tests.
- **Tasks** — unified automated operations list with a nightly cron generating recurring sow / advance / harvest tasks.
- **Inbox** — chef email replies arrive via a signature-verified Resend inbound webhook and are parsed by the Anthropic SDK into task drafts you confirm or dismiss.
- **More** — crop plan, plantings, forecast, labor tracking + weekly timesheet email, calendar, notes, suggestions, event requests, foraging calendar, and a public read-only `/api/v1/*` API.

## Project layout

```
src/
  app/              # Next.js App Router — chef portal, admin pages, API routes
  components/       # shared / order / admin React components
  emails/           # React Email templates
  lib/              # supabase clients, resend, AI extraction, tasks, forecasting, microgreens
  types/            # database + app-level types
tests/              # Vitest suites
supabase/migrations # numbered SQL migrations (001 → 068)
scripts/            # image optimizers, OG generator
public/assets/      # brand logos + hand-illustrated botanicals
docs/               # PRD, schema, workflows, design specs
```

## Database

Schema lives in `supabase/migrations/` as numbered SQL files. The user does not have the Supabase CLI linked — migrations are applied via the Supabase dashboard SQL editor or the Supabase MCP, then committed to the repo as the schema source of truth. See `CLAUDE.md` for the full migration ledger and operating notes before making schema changes.

## Brand & design

Editorial, mobile-first, restrained — built around a 375px primary breakpoint with a hand-illustrated botanical system. The brand is already built out; see `src/app/admin/ui-kit/page.tsx` for the reference page. Don't redesign without an explicit ask.

---

For deeper architectural and operational context — migration history, business rules, conventions, and how to operate safely — see [`CLAUDE.md`](./CLAUDE.md).
