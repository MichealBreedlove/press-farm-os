# Press Farm OS — Architecture Review

> Senior-engineer review of the codebase — **second pass**, branch
> `claude/codebase-architecture-review-jfy7w8` (2026-07-04). First pass was
> 2026-06-13 (`claude/codebase-architecture-review-758cgl`); its nine applied
> refactors (auth-gate consolidation, order-key extraction, report-aggregation
> DRY, currency formatting, rate limiting, …) are all still in place and are
> the main reason the core scores well below.
>
> Scope: reverse-engineer the architecture and data flow, then catalogue
> architecture / duplication / performance / scalability / maintainability
> issues with concrete `file:line` evidence and a prioritized strategy.
>
> **Constraint honoured:** the accompanying code changes upgrade quality only —
> **no functionality changes**. Behaviour-sensitive items (pricing math,
> financial reports, chef email) are written up as *recommendations with
> ready-to-apply patches*, not applied, per the repo's "check in first" rules.

---

## 0. TL;DR

Press Farm OS is a **well-structured Next.js 14 App Router + Supabase**
mobile-first ordering app (~65k LOC, 403 TS/TSX files, ~116 API routes,
**233 passing tests**, 75 migrations through 071). The load-bearing order path
is genuinely production-grade: atomic submission via a Postgres RPC with
idempotency tokens and in-transaction TOCTOU guards (migrations 066–068),
pure unit-tested domain cores (`lib/orders.ts`, `lib/pricing.ts`,
`lib/order-keys.ts`, `lib/order-availability.ts`), frozen prices, and an
audit trail.

The problems found this pass cluster in three places: **(1) financial
correctness at the edges** — one report endpoint whose date filter is a silent
no-op, and two secondary write paths that re-implement pricing without the
`size_prices` tier; **(2) type-safety debt inversion** — `database.ts` was
regenerated and now covers 37 tables, but ~248 `(as any)` casts remain that
*discard* that coverage, justified by a stale "types lag the schema" comment;
**(3) god components** on the admin side (813–841 lines) with re-render
hot spots on the heaviest interactive surface (277 items × 4 restaurants).

| Axis | Grade | One-line |
|---|---|---|
| Domain modelling & data integrity (order path) | **A** | Atomic RPC + idempotency + TOCTOU re-checks; best code in the repo |
| Separation of concerns (domain core) | **A−** | Pure, tested `lib/*` cores; ReceiverClient's reconciliation is the exception |
| Cross-cutting consistency (auth/errors) | **B−** | Shared gate exists; 10 shadow copies removed this pass; response shapes still ad-hoc |
| Type safety | **C+** | Types exist; casts remain and actively discard them |
| Financial correctness (edges) | **C+** | top-items filter no-op; size_prices skipped in 2 of 4 pricing sites |
| Reports performance/scalability | **B−** | Bounded tables OK by design; top-items is the unbounded straggler |
| Frontend maintainability | **C+** | 4 files >750 lines; CSV import trio is a 3-way clone |
| Docs accuracy (`CLAUDE.md`) | **B+** | Was stale (migrations, counts) — corrected this pass |

---

## 1. Architecture, reverse-engineered

### 1.1 Layers

```
 Browser (mobile-first PWA)
   │  React Server Components + "use client" islands
   ▼
 Next.js App Router  (src/app)
   ├─ pages/layouts  ── server components fetch via createClient() (RLS) ──┐
   ├─ middleware.ts  ── updateSession(): getUser() per matched request     │
   └─ api/**/route.ts ── HTTP handlers ────────────────────────────────────┤
                                                                           ▼
 Domain cores (src/lib)                                          Supabase (PG 15)
   orders.ts / pricing.ts / order-keys.ts /                        ├─ RLS + is_admin()
   order-availability.ts (pure, tested)                            ├─ RPC submit_order_with_items (066-068)
   availability.ts (rollover) / order-audit.ts                     ├─ Views (report_item_revenue, seeds_with_on_hand)
   tasks/*, forecasting/*, microgreens/*, production-value/*       └─ triggers (update_delivery_total, …)
   supabase/{server,admin,client,middleware}.ts
   resend/* (email) · extraction/* (AI)
```

**Client trichotomy** (`src/lib/supabase/`, all typed `<Database>`):
- `client.ts` — browser, anon key, RLS.
- `server.ts` — RSC/route handler, anon key from cookies, **respects RLS**.
- `admin.ts` — service role, **bypasses RLS**, server-only.

**Auth**: admin = email+password (`is_admin()` RLS bypass); chefs = magic link /
shared accounts (RLS via `user_restaurant_ids()`); receiver role for check-in.
Route gates: `requireAdmin` / `requireRole` / `requireUser` in
`src/lib/api-auth.ts` (as of this pass, the *only* implementations — see §5.1).

### 1.2 Core data model

```
items (catalog master: unit_type CSV, unit_prices JSONB, size_prices JSONB ←069, menu flags)
  └─1:N→ availability_items (per restaurant_id × delivery_date: status,
                             available_sizes/colors/units overrides)
            └─ chefs order against an availability row
orders — PARTIAL UNIQUE(restaurant_id, delivery_date) WHERE event_date IS NULL ←070
  └─1:N→ order_items (unit_type, size_label, color_key, menu_section,
                      unit_price_at_order = FROZEN price,
                      replacement_* substitution fields ←071)

deliveries + delivery_items  ← FINANCIAL SOURCE OF TRUTH (not order_items)
planter_boxes / microgreen trays ← separate "production value" stream ←069 (never touches delivery_items)
```

### 1.3 Data flow — chef order submission (the load-bearing path)

```
/order/[date] (RSC) ── createClient() ── availability_items ⋈ items
   ▼
OrderForm.tsx (client) — state keyed by lib/order-keys.ts conventions
   ▼  draft in sessionStorage, validated on rehydrate
POST /api/orders  (route.ts, 494 LOC)
   ├─ requireUser → restaurant_users membership check          [route.ts:129]
   ├─ idempotency short-circuit (last_submission_token)        [route.ts:146-158]
   ├─ ordering_open pre-check + chef-editable status gate      [route.ts:161-185]
   ├─ availability-id round-trip anti-tamper/stale validation  [route.ts:212-266]
   ├─ price freeze via resolveOrderUnitPrice (lib/pricing.ts)  [route.ts:299]
   ├─ merge plan via planOrderItemMerge (lib/orders.ts)        [route.ts:354]
   └─ rpc("submit_order_with_items") — ATOMIC, re-checks       [route.ts:361]
      ordering_open + status INSIDE the transaction (066-068)
   → order_audit (non-blocking) → 2 emails (non-blocking)
```

Downstream: admin review (`orders/[orderId]` PATCH), shortage + substitution
workflow (071), pick list, **send-to-receiver** (`orders/send-to-receiver` —
materializes `order_items` → `deliveries`/`delivery_items`, the financial
bridge), receiver check-in (`/receiver`, ±7-day window guard because it runs
service-role), EOM finalize, reports.

**This path is the strongest code in the repo — keep it as the template.**

---

## 2. Critical problem areas (with evidence)

Ranked by severity. ✅ = fixed in this pass (§5). 🔧 = ready patch below,
needs Micheal's sign-off (financial behaviour). 📋 = roadmap (§4).

### 2.1 🔧 P0 — `reports/top-items` date filter is a silent no-op

`src/app/api/reports/top-items/route.ts:32-33`:

```ts
if (start) query = query.gte("deliveries.delivery_date", start);
if (end)   query = query.lte("deliveries.delivery_date", end);
```

In PostgREST, a filter on an **embedded** relation (`deliveries.delivery_date`)
without `!inner` does **not** filter the parent rows — it only nulls out the
embed. The aggregation loop (`:49-66`) checks `di.items` but never
`di.deliveries`, so every `delivery_items` row is counted regardless of date.
Net effect: **`start`/`end` are ignored; the endpoint always returns all-time
totals over the entire table** (3.7k+ rows, the fastest-growing table). This is
both a correctness bug and the one unbounded-scan report that audit
follow-up #4 missed. No UI caller today (external/API consumers only), which is
why it went unnoticed.

**Fix (one line changes the join, one line hardens the loop):**

```ts
.select(`
  item_id, quantity, line_total,
  items ( id, name, category, unit_type ),
  deliveries!inner ( delivery_date )
`)
// …and in the loop:
for (const di of data ?? []) {
  if (!di.items || !di.deliveries) continue;
```

Better still: point it at the `report_item_revenue` view (migration 065) like
`/admin/reports` already does. Not applied — it changes report output, i.e.
functionality.

### 2.2 🔧 P0 — two pricing re-implementations skip the `size_prices` tier

The canonical precedence is `size_prices[size] → unit_prices[unit] →
default_price → 0` (`src/lib/pricing.ts:33`, unit-tested; migration 069 added
the size tier precisely because Palm-size Nasturtium was under-billed). Two
write paths still use pre-069 logic:

- **`src/lib/event-requests/accept.ts:70-72`**
  ```ts
  const unitPrice = Number(unitPrices[request.unit] ?? item.default_price ?? 0) || null;
  ```
  No `size_prices`, and `|| null` converts a legitimate **$0.00 price to
  NULL** — contradicting `pricing.ts`'s documented "0 is a real price" rule
  (NULL line totals silently vanish from `COALESCE(SUM(...))` revenue rollups).
  **Fix:** `const unitPrice = resolveOrderUnitPrice({ unitPrices, defaultPrice: item.default_price, sizePrices: item.size_prices ?? null, firstUnit: null }, request.unit, request.size ?? null);` (and add `size_prices` to the select on `:64`).

- **`src/app/admin/deliveries/[date]/page.tsx:84-88` + `DeliveryLogForm.tsx:128,179`**
  The delivery-log pre-fill prefers the frozen `unit_price_at_order` (correct),
  but its *fallback* — used for lines without a stamped price and for manually
  added rows — is `unit_prices[unit] ?? default_price ?? 0` with no size tier.
  Since `deliveries`/`delivery_items` is the **P&L source of truth** (business
  rule 4), size-priced items logged through the fallback are under-valued in
  revenue. Same fix: route through `resolveOrderUnitPrice`.

Both are ready to apply but change dollar amounts → explicitly held for
sign-off per "pricing logic: check in first".

### 2.3 ✅ P1 — two divergent shadow `requireAdmin` copies across 10 routes

All four `src/app/api/microgreens/**` `[id]`/bulk routes and all six
`src/app/api/seeds/**` routes re-declared a **local** `async function
requireAdmin()` instead of importing the shared gate. Worse, the two clusters
had *drifted from each other*: the microgreens variant returned `null` and
collapsed unauthenticated → **403** (the shared helper and the seeds variant
correctly return 401), and every copy re-fetched `profiles` with its own
client. This is duplication doing exactly what duplication does. **Fixed in
this pass** (§5.1): all 10 files now use `requireAdmin` from
`src/lib/api-auth.ts`; net −93 lines; unauthenticated callers now uniformly get
401 (the only externally observable change, and it's the documented contract).

### 2.4 📋 P1 — ~248 `as any` casts that discard *existing* type coverage

`src/types/database.ts` was regenerated (37 tables + 4 views + the RPC), yet
~248 `(admin as any)` / `(supabase as any)` casts remain — and nearly every
casted table (`microgreen_*`, `orders`, `order_items`, `deliveries`, `items`,
`availability_items`, `event_requests`, `farms`, `delivery_dates`, …) **is
fully typed**. The casts survive because of a cargo-culted comment
(`src/lib/forecasting/fetch.ts` header, now corrected — §5.3) claiming
"generated types lag the live schema", which is no longer true. Only
`planter_box_*` (069) and the unused `pack_inventory` genuinely lack types.

Risk is concrete: `regenerate-microgreens.ts` fetches five tables through
`any` and feeds untyped rows into the typed `sowPlan` algorithm — a column
rename in a migration would produce silent `undefined`s in sow-plan math, not
a compile error. Strategy in §4.2.

### 2.5 📋 P1 — `event-requests/accept.ts` is a non-atomic 6-write flow

`acceptEventRequest` (`src/lib/event-requests/accept.ts:42-159`) runs six
sequential service-role round-trips (delivery_date ensure → item read →
availability find-or-create → order find-or-create → order_items insert →
event_requests update) with **no transaction**. A failure after the middle
writes strands an orphan `availability_items` row or an order with no lines;
"accept group" multiplies this per item. The order-submit path had the same
disease and was cured with the `submit_order_with_items` RPC (066) — this path
deserves the same treatment (an `accept_event_request` RPC), or at minimum a
compensating cleanup on error. Also the site of one §2.2 pricing bug.

### 2.6 📋 P2 — service-role is the default; RLS is unused as a second layer

`createAdminClient()` appears in ~108 of ~116 route files. The standard shape
is: authenticate with the RLS-scoped user client, then **discard it** and write
with service-role. For admin-only routes this is defensible (admin bypasses RLS
anyway via `is_admin()`), but several non-admin flows drive service-role writes
gated only by JS checks: `order/open-date` (chef role → `delivery_dates`
write), `event-requests` (scope check in JS at `:59-68`, then service-role
reads), receiver routes (mitigated by an explicit ±7-day window guard). One
auth-logic slip = unrestricted DB access; RLS would otherwise be the net.
Recommendation (§4.4): prefer the user client wherever RLS policies already
express the rule; reserve `admin` for genuinely cross-tenant work
(notifications, imports, materialization).

### 2.7 📋 P2 — frontend hot spots and god components

The page-boundary architecture is disciplined (66 server-component pages fetch
and pass props; only 6 files touch the browser client, 5 legitimately). The
debt is inside the big client islands:

- **`AvailabilityEditor.tsx` (813)** — the heaviest interactive surface
  (277 items × 4 restaurants). One chip tap spreads the whole
  `RestaurantStatuses` map (`:236`) and re-renders every row; rows are inline
  IIFEs allocating fresh `Set`s per render (`:648-747`). Fix: extract a
  `React.memo`'d `<AvailabilityItemRow>` receiving only its item's slice.
- **`OrderForm.tsx`** — `orderedSources`/`orderedCount` re-enumerate the full
  catalog on every keystroke (`:238-319`, no `useMemo`).
- **`ReceiverClient.tsx` (612)** — a 170-line order/delivery reconciliation
  algorithm lives inside a `useMemo` (`:94-265`); it's untestable there and is
  business logic (belongs in `src/lib/receiver/reconcile.ts` with unit tests
  — it decides what the receiving kitchen believes it's owed). Each checkbox
  also fires `router.refresh()` (`:521-542`) — a full server round-trip per
  tick despite optimistic local state already existing.
- **`ItemForm.tsx` (841)** — one `useState` object with 30 fields; three
  self-contained sub-forms (menu-visibility cards, container pricing, growing
  conditions) inline as IIFEs.
- **`ItemsClient.tsx` (813)** — 190-line `renderItemCard` closure re-created
  per render (`:383-572`); uses `alert()` for errors (`:181`) where every other
  surface renders inline state.
- **CSV import/export trio** — `DataClient.tsx` (640) /
  `DeliveriesDataClient.tsx` (582) / `ExpensesDataClient.tsx` are a three-way
  near-clone: identical tab state machine, drop zone, preview/import fetch
  handlers, stat strip, result cards (~400 duplicated lines). Highest-ROI
  extraction: `<ImportExportShell>` + `useCsvImport(endpoint)` (§4.5).
- **Server-side waterfall** — `admin/availability/[date]/page.tsx:103-129`
  awaits two queries per restaurant sequentially for carry-over (up to 8
  serial round-trips); trivially `Promise.all`-able.

### 2.8 📋 P3 — remaining duplication & consistency debt

- **Date helpers ×4**: `addDays`/`daysBetween`/ISO-format independently
  implemented in `forecasting/dates.ts`, `tasks/dates.ts`,
  `production-value/accrual.ts:48`, and inline in `sowPlan.ts:33-43` — with
  *deliberately different* UTC vs local semantics that are nowhere documented.
  Consolidation must be semantic-preserving per module, so it's a careful
  refactor, not a mechanical one.
- **Allowed-unit lists ×4**: separate literals in `deliveries/route.ts:88`,
  `orders/send-to-receiver/route.ts:7`, `import/deliveries-csv` `UNIT_MAP`,
  while `src/lib/constants.ts` is the documented single source of truth.
- **CSV importer server halves**: `import/{items,expenses,deliveries}-csv`
  each hand-roll fuzzy header matching (`pick`) + Excel-serial date parsing —
  two different implementations of the same logic.
- **`email.ts` (463)**: 8 send functions with an identical
  subject/fallback-text/sendOrLog skeleton; the React templates each re-derive
  row striping. ~40% compressible.
- **Response envelopes**: `{data,error:null}` vs `{ok:true}` vs
  resource-named keys — unchanged from last pass; still deferred because the
  exact keys are client contract (see 2026-06-13 review §4.6).
- **No zod at the boundary**: still hand-rolled validation everywhere; same
  deferral rationale as last pass (§4.7 there). The order route's three
  copies of item-shape validation would be the first target.
- **`.single()` where absence is expected**: e.g. `orders/route.ts:161`
  (`delivery_dates`) 500s on a missing date row instead of the intended 409;
  `.maybeSingle()` is the right call.
- **Route config drift**: `maxDuration` set on AI/cron routes but not on the
  XLSX importers; only `inbound/reply` pins `runtime`.

### 2.9 ✅ Docs drift (the agent contract)

`CLAUDE.md` said "71 files, next migration 069" while **three** 069 files plus
070/071 already shipped — following the doc would have minted a *fourth* 069.
Test counts (183→231), type coverage claims ("~18 of ~34 tables"), and
follow-up #3's premise were also stale. **Corrected this pass** (§5.4),
including table rows for 069×3/070/071 and "next is 072".

---

## 3. What's done well (keep / emulate)

- **`submit_order_with_items` RPC (066→068)** — atomic upsert + line
  replace/merge, SECURITY INVOKER (chef RLS applies), `FOR UPDATE`
  serialization, idempotency token, in-transaction `ordering_open` and status
  re-checks. The reference implementation for any future multi-write flow
  (event-accept, §2.5).
- **Pure, tested domain cores** — `planOrderItemMerge`, `resolveOrderUnitPrice`
  (0-is-a-real-price rule documented *and* enforced), `buildOrderKey`/
  `enumerateOrderKeys`, `resolveUnits/Sizes/Colors`, `sowPlan`, `rollupByMonth`.
  233 tests run in 3s.
- **Anti-tamper availability round-trip** in the order route, with the
  stale-cart UX recovery naming exactly the unavailable items.
- **Security hygiene** — HMAC-verified inbound webhook, fail-closed
  `CRON_SECRET`, constant-time API-key compare, service key never in the
  browser, storage writes admin-only, GET-only public v1.
- **Indexing judgment** — 044's drops were measured (seq-scan-preferred tiny
  tables) with rollback statements retained; hot paths
  (`order_items(order_id)`, `availability_items(restaurant_id,delivery_date)`,
  `deliveries(delivery_date)`) all covered.
- **Email fail-soft** — `sendOrLog` never throws into the request path.

---

## 4. Refactoring strategy (prioritized roadmap)

> Ordered by value ÷ risk. **[check-in]** = touches pricing/financial output or
> auth semantics; get Micheal's nod first. Everything else is safe to do
> incrementally with `tsc`/tests/build as the gate.

### 4.1 **[check-in]** Financial-correctness trio (patches in §2.1–2.2, ~1 hour)
1. `top-items`: `deliveries!inner` + null-guard (or switch to
   `report_item_revenue`).
2. `event-requests/accept.ts`: route through `resolveOrderUnitPrice`, stop
   coercing $0 → NULL.
3. Delivery-log fallback pricing: same helper, adds the size tier.
Add route-level tests alongside (the merge/pricing cores are tested; the wiring
is not — this is the riskiest untested surface, per the test-gap ranking:
orders route → deliveries logging → event-accept → reports composition → RLS).

### 4.2 De-cast campaign (mechanical, do in slices)
The types exist; the casts are habit. Per slice: pick a module
(`tasks/regenerate-*`, `forecasting/fetch`, report pages), delete the casts,
let `tsc` surface mismatches, fix honestly (usually just embedded-relation
array-vs-object flattening, for which `normalizeForecastData` is the
precedent). Rule going forward: **new code never adds `(x as any).from(...)`**
— the two legitimately untyped tables (`planter_box_*`) should instead get
types via the Supabase MCP `generate_typescript_types`. Also retire the
hand-mirrored `EventRequest` in `types/index.ts` in favour of
`Database["public"]["Tables"]["event_requests"]["Row"]`.

### 4.3 Atomic `accept_event_request` RPC **[check-in — schema]**
Port `accept.ts`'s six writes into one SECURITY DEFINER-audited function
(mirroring 066's shape: ensure date → ensure availability → upsert order →
insert line → close request, all-or-nothing). Migration number **072**.

### 4.4 RLS as the second layer (incremental)
For chef/receiver-facing routes, do the *write* with the request's user client
so RLS enforces scope even if the JS check regresses; keep `admin` only where
the operation is legitimately cross-tenant. Start with `order/open-date` and
`event-requests` reads. No client-visible change when the policies already
allow the operation — verify per-route against migration 002's policies.

### 4.5 `<ImportExportShell>` + `useCsvImport()` (pure extraction)
Collapse the three data clients' shared ~400 lines: shell takes
`{ endpoint, stats, columnsHelp, renderPreview, renderResult, extras }`.
Server-side twin: one `parseSpreadsheet(file, headerAliases)` util shared by
the three import routes (fuzzy `pick` + Excel-serial dates in one place).

### 4.6 Component performance pass (pure, verify by interaction)
`React.memo`'d `<AvailabilityItemRow>`; `useMemo` OrderForm's
`orderedSources/orderedCount`; drop `LineRow`'s per-tick `router.refresh()` in
favour of the existing optimistic state (+ one refresh on section close);
`Promise.all` the availability carry-over loop. Extract
`reconcileDelivery(orders, deliveries, restaurants)` from ReceiverClient into
`src/lib/receiver/` **with the current behaviour locked by tests first**, then
swap the useMemo body to call it.

### 4.7 Consolidations, lowest risk last
Unit lists → `constants.ts`; `isEventOnlyItem` (done, §5.2); date-helper
unification (document UTC-vs-local intent per call site *before* merging —
this one bites silently); `email.ts` skeleton + `renderStripedRows`;
`ItemForm`/`ItemsClient` decomposition as they next need feature work (don't
refactor speculatively); zod + response-envelope standardization remain
deliberate contract changes to schedule as their own pass (unchanged rationale
from the 2026-06-13 review).

---

## 5. Code changes applied in this pass (quality-only)

All verified against a green baseline and re-verified after:
`tsc --noEmit` clean, `next lint` clean, **233/233 tests pass** (the two microgreens auth tests that asserted the old collapsed 403-for-unauthenticated were corrected to 401 and joined by real not-admin 403 cases), production
build succeeds.

1. **Shadow auth gates removed (§2.3).** All 10 `microgreens/**` + `seeds/**`
   routes now import `requireAdmin` from `src/lib/api-auth.ts` instead of
   re-declaring their own drifted copies. Net **−93 lines**, one audit point
   for the admin gate. Only observable change: unauthenticated callers to the
   four microgreens routes now receive **401** (was 403) — matching the shared
   helper, the seeds routes, and the documented contract.

2. **`isEventOnlyItem` extracted (§2.8).** The event-only predicate
   (`is_event_item && show_in_regular_menu === false`) was independently
   implemented in `OrderForm.tsx`, `item-row.tsx`, and `ReceiverClient.tsx` —
   three copies of a rule that decides whether a line is a receiver set-aside.
   Now a single documented export in `src/lib/order-availability.ts`; all
   three sites consume it. Boolean-identical at every site (item-row's extra
   `onEventToggle`/`isEventCopy` conditions preserved).

3. **Stale cast-convention comment corrected + exemplar de-cast (§2.4).**
   `src/lib/forecasting/fetch.ts`'s header claimed casts are required because
   "generated types lag the live schema" — false since the regeneration, and
   the line being cargo-culted into new code. Rewritten to say the opposite
   (don't copy; remove opportunistically), and `fetchSeasonalItems` de-cast as
   the in-file example of the clean shape. Same correction to the misleading
   middleware comment (`src/lib/supabase/middleware.ts:34` said "don't call
   getUser() here" directly above the line that calls it — now explains *why*
   `getUser()` over `getSession()` is deliberate).

4. **`CLAUDE.md` re-synced to reality (§2.9).** Migration count/numbering
   (75 files → 071, **next is 072**, 069 collides ×3) with table rows for the
   five new migrations; test counts 183→231; `database.ts` coverage claim and
   follow-up #3 rewritten around the real remaining work (~248 stale casts,
   auth-helper half done).

**Deliberately not applied** (functionality changes, per the engagement
constraint + repo "check in first" rules): the three financial fixes in §4.1
(patches included above), the event-accept RPC (§4.3, needs migration 072),
and the RLS-second-layer migration (§4.4).
