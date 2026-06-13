# Press Farm OS — Architecture Review

> Senior-engineer review of the codebase as of branch
> `claude/codebase-architecture-review-758cgl` (2026-06-13).
> Scope: reverse-engineer the architecture and data flow, then catalogue
> architecture/duplication/performance/scalability/maintainability issues with
> concrete `file:line` evidence and a prioritized refactoring strategy.
>
> **Constraint honoured:** the accompanying code changes upgrade quality only —
> **no functionality changes**. Behaviour-sensitive items (auth, chef email,
> financial math) are written up as *recommendations*, not applied, per the
> repo's "check in first" rules.

---

## 0. TL;DR

Press Farm OS is a **well-structured Next.js 14 App Router + Supabase**
mobile-first ordering app (~60k LOC, 370 TS/TSX files, 109 API routes, 191
passing tests). The core domain is genuinely well-engineered: atomic order
submission via a Postgres RPC, pure unit-tested domain cores
(`lib/orders.ts`, `lib/pricing.ts`, `lib/order-availability.ts`), per-restaurant
availability scoping with intelligent carryover, and a typed Supabase client
layer.

The weaknesses are the predictable ones for a fast-moving single-maintainer
product: **cross-cutting concerns that were copy-pasted instead of extracted**
(auth gate, currency formatting, report aggregation), **type-safety gaps**
around a handful of untyped tables/views, and **report endpoints that fetch
whole tables and aggregate in JS**. None threaten data integrity; they're
maintainability and scalability drag.

| Axis | Grade | One-line |
|---|---|---|
| Domain modelling & data integrity | **A−** | Atomic RPC, frozen prices, unique constraints, audit trail |
| Separation of concerns (domain core) | **A−** | Pure, tested `lib/*` cores for the order path |
| Cross-cutting consistency (auth/format/errors) | **C+** | 3 duplicated patterns; partial migrations stalled |
| Type safety | **B−** | 400 `as any`; concentrated in reports + untyped tables |
| Reports performance/scalability | **C+** | Whole-table fetch + JS `GROUP BY`; one view fixed (065) |
| Input validation | **C** | Manual ad-hoc checks; no schema layer; some gaps |
| Docs accuracy (`CLAUDE.md`) | **B** | Excellent but several follow-ups now stale |

---

## 1. Architecture, reverse-engineered

### 1.1 Layers

```
 Browser (mobile-first PWA)
   │  React Server Components + a few "use client" islands
   ▼
 Next.js App Router  (src/app)
   ├─ pages/layouts  ── server components fetch via createClient() (RLS) ──┐
   ├─ middleware.ts  ── updateSession() refreshes Supabase auth cookies    │
   └─ api/**/route.ts ── HTTP handlers ────────────────────────────────────┤
                                                                           ▼
 Domain cores (src/lib)                                          Supabase (PG 15)
   orders.ts / pricing.ts / order-availability.ts (pure, tested)   ├─ RLS + is_admin()
   availability.ts (rollover) / order-audit.ts                     ├─ RPCs (submit_order_with_items)
   tasks/*, forecasting/*, microgreens/*, extraction/*             ├─ Views (report_item_revenue …)
   supabase/{server,admin,client,middleware}.ts                    └─ triggers
   resend/* (email) · anthropic/* (AI)
```

**Client trichotomy** (`src/lib/supabase/`, all typed `<Database>`):
- `client.ts` — browser, anon key, RLS.
- `server.ts` — RSC/route handler, anon key from cookies, **respects RLS**.
- `admin.ts` — service role, **bypasses RLS**, server-only.

**Auth model** (matches `CLAUDE.md`): admin = email+password (bypasses RLS via
`is_admin()`); chefs = magic link / shared username+password (RLS-scoped via
`user_restaurant_ids()`); receiver role for check-in. Route-level gate is
`requireAdmin(supabase)` in `src/lib/api-auth.ts:25`.

### 1.2 Core data model

```
items (catalog master: unit_type CSV, unit_prices JSONB, menu flags)
  └─1:N→ availability_items (per restaurant_id × delivery_date: status, limited_qty,
                             available_sizes/colors/units overrides)
            └─ chefs order against an availability row
orders (UNIQUE(restaurant_id, delivery_date) — one per restaurant per date)
  └─1:N→ order_items (availability_item_id FK, unit_type, size_label, color_key,
                      menu_section, unit_price_at_order = FROZEN price)

deliveries + delivery_items  ← FINANCIAL SOURCE OF TRUTH (not order_items)
```

### 1.3 Data flow A — chef order submission (the load-bearing path)

```
/order/[date] (RSC) ── createClient() ── availability_items ⋈ items for (restaurant, date)
   ▼
OrderForm.tsx (559 LOC, client) — 5 parallel state records keyed by a composite key:
     ${availId}__unit:${UNIT}__${SIZE}   (multi-unit + size)
     ${availId}__unit:${UNIT}            (multi-unit)
     ${availId}__${SIZE}                 (legacy size-only)
     ${availId}                          (legacy plain)
   event split prefixes the key:  evt::${key}
   ▼  draft persisted to sessionStorage (validated against current availability on rehydrate)
/order/review → POST /api/orders/route.ts (459 LOC)
   ├─ membership check (chef ∈ restaurant_users)                  [route.ts:128-137]
   ├─ ordering_open check                                          [route.ts:140-151]
   ├─ status guard (reject if past chef-editable)                  [route.ts:157-169]
   ├─ availability-id round-trip validation (anti-tamper/stale)    [route.ts:196-247]
   ├─ price freeze via resolveOrderUnitPrice() (lib/pricing.ts)    [route.ts:253-276]
   ├─ merge plan via planOrderItemMerge() (lib/orders.ts)          [route.ts:321-334]
   └─ rpc("submit_order_with_items", …) — ATOMIC upsert+lines      [route.ts:336] (migration 066)
   → order_audit insert (non-blocking) → 2 emails (non-blocking) → /order/confirmed
```

**This is the strongest part of the codebase.** The atomic RPC eliminates
split-state bugs, prices are frozen at submit, the merge/replace logic is a pure
tested function, and the stale-availability validation (the 2026-06-10 incident
fix) names the offending items so the chef can self-correct.

### 1.4 Data flow B — admin availability publishing

```
/admin/availability/[date] (RSC) — fetch items + restaurants + existing rows
   + per-restaurant carryover from most recent prior date when a restaurant has 0 rows
   ▼
AvailabilityEditor.tsx (813 LOC, client) — statuses[restaurantId][itemId] + shared overrides
   ▼  Save → Promise.all( POST /api/availability per restaurant )
/api/availability/route.ts — requireAdmin → upsert availability_items
   → additively sync menu flags on items (is_event_item / is_press_bar_item / show_in_regular_menu)
   → set delivery_dates.ordering_open = true
   ▼ optional: POST /api/availability/notify → emails all active chefs
```

---

## 2. Critical problem areas (with evidence)

### 2.1 Duplicated cross-cutting logic

**(a) Auth gate — partial migration stalled.** `requireAdmin()` exists and is
used by **71** route files, but **42** still inline the
`getUser() → fetch profiles.role → compare` block. Representative inliners:
- `src/app/api/orders/route.ts:14-32` (GET) and `65-137` (POST)
- `src/app/api/availability/route.ts:14-35`, `availability/toggle`, `availability/ordering`, `availability/duplicate`
- `src/app/api/ai/bulk-fill-items/route.ts:60-73`, `ai/catalog-audit`, `ai/crop-recommendations`, `ai/draft-item-content`
- `src/app/api/admin/inbox/[id]/route.ts:26-38`, `admin/setup-shared-accounts/route.ts:55-69`

Two *variants* the single helper doesn't yet cover, which is why the migration
stalled:
- **multi-role** (receiver OR admin): `receiver/check-line/route.ts:26-38`,
  `receiver/close-delivery/route.ts:25-37`, `receiver/notify`.
- **authenticated-but-any-role** (just needs a logged-in user):
  `items/[itemId]`, `orders/[orderId]/shortage`, `event-requests/route.ts:85`,
  `photos`, `suggestions`, `upload`, `email-status/[id]`.

→ See §4.1 for the proposed `requireUser()` / `requireRole()` extension.

**(b) Currency/number formatting — 15+ copies.** A `function fmt`/`formatCurrency`
redefining `new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"…})`
appears in at least: `reports/ReportsDashboard.tsx:16,20`,
`reports/yoy/page.tsx:9`, `reports/items/page.tsx:9`,
`reports/income/page.tsx:32`, `reports/crops/page.tsx:11`,
`reports/labor-efficiency/page.tsx:11,19`, `reports/executive/ExecutiveDashboard.tsx:6`,
`dashboard/page.tsx:21`, `labor/LaborClient.tsx:156`, `deliveries/page.tsx:14`,
`deliveries/finalize/page.tsx:12`, `deliveries/[date]/DeliveryLogForm.tsx:60`,
`expenses/data/ExpensesDataClient.tsx:41`, `settings/data-check/page.tsx:8`,
`api/reports/weekly-digest/route.ts:10`. Two genuine conventions exist
(2-decimal vs whole-dollar `maximumFractionDigits:0`) plus a few bespoke
negative-sign variants. `src/lib/utils.ts` already exports `formatCurrency()`
but almost nobody imports it.
→ **Applied in this PR** (see §5): added `formatCurrencyWhole()` and migrated
the byte-identical sites.

**(c) Report month/restaurant aggregation — 3 near-identical loops.** The same
"fetch deliveries+expenses → build `Record<month,{revenue,expenses,by_restaurant}>`"
loop is reimplemented in `app/admin/reports/page.tsx:50-70`,
`api/reports/income/route.ts:52-72`, and `api/reports/monthly/route.ts:51-71`.

### 2.2 Type-safety gaps

- **400** `as any` casts total; **42** are `(supabase as any)`. They are
  *concentrated*, not spread: the worst cluster is the **reports subsystem**,
  caused by **`report_item_revenue` (a SQL view, migration 065) being absent
  from `src/types/database.ts`** — forcing `(admin as any).from("report_item_revenue")`
  in `reports/page.tsx:34` and `reports/executive/page.tsx:98`.
  → **Applied in this PR:** typed the view, removed both casts.
- The `(admin as any).from("deliveries"…)` casts in the same files are a
  *separate* smell: they exist to dodge the nested-join (`restaurants(name)`)
  typing friction, evidenced by the downstream `(d.restaurants as any)?.name`.
  Left as-is (needs a typed join helper; see §4.3).
- **Item menu flags untyped.** `OrderForm.tsx:203-216` and `item-row.tsx:129`
  do `(item as any).is_event_item / .show_in_regular_menu / .is_press_bar_item`,
  and `(ai as any).available_units`, `(i as any).available_sizes`. These
  columns exist on the rows but aren't on the joined `AvailabilityItemWithItem`
  type. → see §4.2.
- `database.ts` covers the core tables + 4 views + enums (it's 2.8k lines), but
  several post-bootstrap tables are hand-typed in `index.ts` (e.g.
  `EventRequest`) or accessed via casts. `CLAUDE.md`'s claim of "~580 casts /
  ~18 of ~34 tables" is **stale** — the real numbers are 400 `as any` / 42
  `supabase as any`.

### 2.3 Performance / scalability

- **Whole-table fetch + JS aggregation** in every report that isn't the
  already-fixed item rollup: `api/reports/income/route.ts:33-44`,
  `api/reports/monthly/route.ts:27-40`, `app/admin/reports/page.tsx:23-39`,
  `reports/labor-efficiency/page.tsx:108-124`. These pull the **entire**
  `deliveries` + `farm_expenses` (and labor) tables and `GROUP BY` in
  JavaScript. Today these tables are small (`deliveries` ~403, `farm_expenses`
  ~132), so this is *intentional and fine* per `CLAUDE.md` follow-up #4 — but
  it's the same pattern that already bit the `delivery_items` rollup (3.7k rows,
  fixed by view 065). The scalability cliff is real if `deliveries` grows into
  the tens of thousands.
- **N+1 on Supabase Auth in `availability/notify`** (`route.ts:56-84`): one
  `admin.auth.admin.getUserById()` per chef inside a loop. Should be a single
  `listUsers()` + in-memory join. This is a real latency bug today (small N, but
  each call is a network round-trip). → §4.4 (recommendation; not applied
  because it touches the chef-email path).
- **Per-restaurant carryover fetch** in `admin/availability/[date]/page.tsx`
  issues one prior-date query per restaurant with no current rows; batchable
  into one `lt(delivery_date,target)` + group-by-restaurant.

### 2.4 Validation & error-response inconsistency

- **No schema validation layer** (no zod). Every route hand-rolls
  `if (!x) return 400`. Coverage is decent but uneven — missing string-length
  caps before insert in `crop-plan/route.ts:26` and `event-requests/route.ts`.
  Public `contact` and `auth/signup` have **no rate limiting**.
- **`index.ts:115-125` defines `ApiResponse<T> = { data, error }`** — a clean
  contract that **routes don't actually use.** Success bodies vary:
  `{ ok: true }`, `{ success: true }`, `{ data }`, `{ items }`,
  `{ deliveries }`. Clients must special-case each.

### 2.5 Maintainability misc

- **Form-state fan-out.** `OrderForm.tsx` keeps 5 parallel `Record<key,…>`
  states (`quantities`, `itemColors`, `itemNotes`, `eventChecked`, `splitOpen`)
  with the composite key re-derived on demand. The key-builder is duplicated as
  `enumerateKeys()` (OrderForm) and `qtyKey()` (item-row.tsx:151). If the two
  diverge, quantities silently orphan. → extract to `lib/order-keys.ts`.
- **Largest files** worth a future split: `database.ts` (2842, generated-ish),
  `ItemForm.tsx` (841), `AvailabilityEditor.tsx` (813), `ItemsClient.tsx` (813).
- **Stale `CLAUDE.md` follow-ups** (cleanup or update): #3 cast counts are
  wrong; #6 "5 orphaned components" — `PageHeader`, `TopBar`, `status-badge`,
  `delivery-date-picker` are **already deleted**, only `EmptyState` &
  `StatusPill` remain and are both **in active use** (4 importers each). Doc
  drift is itself a maintainability cost since the file is the agent contract.

---

## 3. What's done well (keep / emulate)

- **Atomic order submission** via `submit_order_with_items()` (066) — the right
  call; eliminates a whole class of partial-write bugs.
- **Pure, unit-tested domain cores**: `planOrderItemMerge` (orders.ts),
  `resolveOrderUnitPrice` (pricing.ts), `filterAvailable/resolveUnits/Sizes/Colors`
  (order-availability.ts). 191 tests, fast. This is the pattern to extend.
- **Frozen prices** (`unit_price_at_order`) decouple revenue history from
  catalog edits.
- **Typed client factories** with a clear RLS/service-role split and a
  server-only boundary on the service key.
- **Security hygiene**: HMAC-verified Resend inbound, `CRON_SECRET` fail-closed,
  constant-time API-key compare (`api-auth.ts:64`), additive-only menu-flag sync.

---

## 4. Refactoring strategy (prioritized roadmap)

> Ordered by value ÷ risk. Items marked **[check-in]** touch auth / chef-email /
> financial math and per repo rules must be approved before applying.

### 4.1 Finish the auth-gate consolidation **[check-in — auth]**
Extend `api-auth.ts` so the 42 inliners collapse to one line each:

```ts
// src/lib/api-auth.ts
export async function requireUser(supabase: SupabaseServerClient) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { ok: true as const, user };
}

export async function requireRole(
  supabase: SupabaseServerClient,
  roles: ReadonlyArray<"admin" | "receiver" | "chef">,
) {
  const auth = await requireUser(supabase);
  if (!auth.ok) return auth;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).single();
  if (!profile || !roles.includes(profile.role as never))
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { ok: true as const, user: auth.user, role: profile.role as string };
}
```
Then `requireAdmin` becomes `requireRole(supabase, ["admin"])`. Migrate the
receiver routes to `requireRole(supabase, ["receiver","admin"])` and the
user-contextual routes to `requireUser`. Mechanical, one route at a time, each
verified by the existing tests + manual smoke. **Net: −~40 duplicated blocks,
one audit point for the 401/403 contract.**

### 4.2 Type item menu-flags; kill the `(item as any)` cluster
Add to `src/types/index.ts`:
```ts
export type ItemWithMenuFlags = Item & {
  is_event_item: boolean;
  show_in_regular_menu: boolean;
  is_press_bar_item: boolean;
  available_sizes: string | null;
  available_colors: string | null;
  available_units: string | null;
};
```
and thread it through `AvailabilityItemWithItem` so `OrderForm`/`item-row` drop
their casts. (These columns already exist on the rows — this is type-only.)

### 4.3 A typed join helper for report queries
The `(admin as any).from("deliveries").select("…restaurants(name)")` casts are
all the same shape. A tiny typed wrapper (or regenerating `database.ts` from the
live schema via the Supabase MCP `generate_typescript_types`) removes them and
the downstream `(d.restaurants as any)?.name`. Regeneration also retires the
hand-written `EventRequest` in `index.ts`.

### 4.4 Fix the `availability/notify` N+1 **[check-in — chef email]**
Replace the per-chef `getUserById` loop with a single paginated
`admin.auth.admin.listUsers()` into an `id→email` map, then one pass. Must
preserve "every active chef emailed" (handle pagination), which is why it's a
check-in rather than an autonomous change.

### 4.5 DRY the report aggregation
Extract the month/restaurant rollup (§2.1c) into one
`lib/reports/aggregateByMonth.ts` pure function shared by the three callers, with
unit tests. When `deliveries` outgrows JS aggregation, swap the function body for
a SQL view (the 065 precedent) without touching call sites.

### 4.6 Standardize API responses
Adopt the already-defined `ApiResponse<T>` (`index.ts:115`) via thin
`ok(data)` / `fail(msg, status)` helpers; migrate routes opportunistically.

### 4.7 Introduce zod at the route boundary
Start with the highest-risk mutating routes (`orders`, `availability`,
`deliveries`); colocate schemas in `lib/validators/`. Replaces ad-hoc checks and
gives inferred types for free. Add rate limiting to `contact` + `auth/signup`.

### 4.8 Extract the order-key builder
Move `enumerateKeys`/`qtyKey` into `lib/order-keys.ts` (single source, unit
tested) so the OrderForm/item-row key formats can never drift.

---

## 5. Code changes applied in this review (quality-only, no behaviour change)

All verified against a green baseline (`tsc --noEmit` clean, `next lint` no new
errors, **191/191 tests pass**, production build succeeds).

1. **Currency-format consolidation.** Added `formatCurrencyWhole()` to
   `src/lib/utils.ts` (the documented whole-dollar convention) and replaced the
   **byte-identical** local re-definitions with imports in: `dashboard/page.tsx`,
   `reports/yoy/page.tsx`, `reports/items/page.tsx`, `reports/ReportsDashboard.tsx`,
   `labor/LaborClient.tsx`, `deliveries/page.tsx`, `deliveries/finalize/page.tsx`,
   `expenses/data/ExpensesDataClient.tsx`, `settings/data-check/page.tsx`,
   `api/reports/weekly-digest/route.ts`. Output is identical (same `Intl`
   options); only the duplication is removed. Bespoke negative-sign variants
   (`executive`, `income`, `crops`, `labor-efficiency`) were intentionally left
   untouched because their output differs.

2. **Typed the `report_item_revenue` view** in `src/types/database.ts` and
   removed the `(admin as any)` casts on that query in `reports/page.tsx` and
   `reports/executive/page.tsx`. The view's columns are nullable in the type
   (honest), so `executive/page.tsx` gained an explicit `if (!r.item_id) continue`
   guard + `?? ""` coalescing — behaviour-identical (the GROUP BY key and
   `items.name/category` are never null in practice) but now type-safe.

Everything in §4 is left as a recommendation, not applied.
