# Press Farm OS — Code Review (2026-10-27)

Scope: the whole repo at `07679fa` (72k lines, 438 TS/TSX files, 119 API routes).
Method: five parallel read-only passes (chef order flow, API security, admin
data fetching, frontend/PWA/a11y, tests/cron/email/deps), every finding checked
against the code, the top ones re-verified by hand. Row counts were read from
prod with read-only SQL. Nothing was changed in this pass.

Baseline: `tsc --noEmit` clean, `next lint` 0 errors / 6 `<img>` warnings,
`vitest run` 44 files / 378 tests passing. The prior reviews
(`docs/ARCHITECTURE_REVIEW.md`, `docs/website-audit-2026-09-15.md`) are not
repeated here; §8 lists which of their items are still open.

## Status (end of day 2026-10-27)

Everything in this report shipped on branch `claude/press-farm-os-review-qv7b6b`
in five commits, except: the Next 15 / `@supabase/ssr` major upgrade
(deferred by decision), the `no-floating-promises` lint rule (17 sites to
clean first), and the three decisions below. Decisions taken by assumption:
same-date resubmission still **merges** (the form now says so and offers
Edit); chefs **cannot** re-open a closed date; the upgrade waits.
Verified at the end: `next build` green, `tsc` clean, `next lint` 0 errors,
`vitest` 47 files / 426 tests. `npm audit` 38 → 23 (the remaining critical is
`next@14.2`). CI now runs on push to `main`.

## 0. TL;DR

Eight things are worth doing before anything else. Four of them produce wrong
money numbers today, three are authorization gaps, one is a visual bug on
every admin page.

| # | Where | What | Effort |
|---|-------|------|--------|
| 1 | `src/lib/order/lines.ts:92` | A per-cycle unit override that leaves only the item's *second* unit (e.g. LG only on a "sm,lg" item) prices and records the line as SM. Chef sees LG. Flows into `delivery_items`. | S |
| 2 | `reports/crops`, `reports/items?window=year`, `orders?view=explore` | `delivery_items` selected with no pagination; prod has 4,812 rows (1,749 this year). Supabase silently returns 1,000, so these three reports are computed on 20–57 % of the data. | S |
| 3 | `src/lib/materialize-deliveries.ts:92,247` + `api/orders/[orderId]/route.ts:55` | Insert failures are `console.error`'d and swallowed; the order is already stamped `fulfilled` and the chef is emailed. This is the exact signature migration 076 backfilled. | S |
| 4 | `api/deliveries/route.ts:118-162` | Re-logging a day deletes all `delivery_items` (error unchecked), then inserts. A failed insert leaves the day at $0. | M |
| 5 | `api/order/open-date/route.ts:76-86` | Any chef can flip a date the admin closed back to `ordering_open=true`. | S |
| 6 | `src/lib/api-auth.ts:38-44` | `requireUser` never reads `is_active`; a deactivated chef/receiver keeps ordering, filing events, closing deliveries. | S |
| 7 | `api/orders/route.ts:363-384`, `api/events/order/route.ts:195-210` | `unit_type` / `size_label` from the body are not validated against the item, so a wrong or mistyped unit picks the price tier (falls through to `default_price`). | S |
| 8 | `tailwind.config.ts:33-44` | `pf-master-gold` is not a token. ~134 class usages (`EditorialHero` eyebrow + hairline, `/about`, BottomNav, WeatherWidget) emit no CSS: eyebrows render black, gold rules are invisible on all 63 hero pages. | XS |

## 1. Money and data integrity (fix first)

### 1.1 Wrong unit + price under a single non-first unit override — HIGH
`collectOrderedLines` (`src/lib/order/lines.ts:92`) takes `firstUnit` from the
raw master `item.unit_type`, but cells are enumerated from
`resolveUnits(item, available_units)`. With `available_units="lg"` on a
"sm,lg" item (AvailabilityEditor writes exactly this when SM is toggled off for
a cycle), the resolved list is `["lg"]`, the key carries no unit, and the line
falls back to `unit: "sm"`. The row UI shows "LG container"; the payload,
`unit_price_at_order`, harvest list, receiver and the materialized
`delivery_items` row all get SM. Same code path in `EventOrderClient.tsx:216`.
The restore effect in `OrderForm.tsx:172-176` already does this correctly, with
a comment explaining why.
**Fix:** `firstUnit = resolveUnits(ai.item, ai.available_units)[0] ?? master`;
add a case to `tests/lib/order-lines.test.ts`.

### 1.2 Three reports truncate at 1,000 rows — HIGH
- `src/app/admin/reports/crops/page.tsx:60-72` — all-time (4,812) and
  `?year=2026` (1,749) both exceed the cap. No `ORDER BY`, so which 1,000 rows
  come back is arbitrary.
- `src/app/admin/reports/items/page.tsx:52-59` — `window=year` is 2,095 rows.
  Items missing from the truncated set are wrongly flagged "dead stock".
- `src/app/admin/orders/ExplorerView.tsx:81-111` — `delivery_items` and
  `order_items` un-ranged for this_year / last_year / wide custom ranges.

`src/lib/fetch-all.ts` exists for exactly this and is used by 6 files; these
three predate it. **Fix:** wrap in `fetchAllRows` with `.order("id")`, or use
the `report_item_revenue` view for all-time as `executive/page.tsx` does.

### 1.3 Crop Revenue "Deliveries" column is always 0 — MED
`reports/crops/page.tsx:62-66` never selects `delivery_id`, so the
`if (di.delivery_id)` at `:102` never fires. One-line fix.

### 1.4 Materialized deliveries can silently not exist — HIGH
`materializeDeliveryItems` only logs on insert failure (`:92-94`, `:247-249`)
and returns 0. The caller (`api/orders/[orderId]/route.ts`) has already set
`status='fulfilled'` at `:55`, wraps the call in a `try/catch` that cannot
fire, returns 200 and emails the chef. `send-to-receiver/route.ts:64` has the
same blind spot. **Fix:** return `{created, failed}` or throw; flip the status
only after materialization succeeds; surface a warning in the response the
admin UI shows.

### 1.5 Delivery log is a non-transactional delete-then-insert — HIGH
`api/deliveries/route.ts:118-123` deletes every line for the (date,
restaurant), ignores the delete error, then inserts at `:156-162`. A constraint
failure on one new line returns 500 with the old lines already gone, and the
`update_delivery_total` trigger recomputes the total to 0. **Fix:** an RPC in
the style of `submit_order_with_items` (migration 066), or insert first and
delete the old ids after.

### 1.6 Chef-supplied unit / size select the price tier — HIGH
Neither order route checks `unit_type` against `items.unit_type` /
`available_units`, nor `size_label` against `available_sizes`. Pricing falls
`size_prices[size] → unit_prices[unit] → default_price`, so a typo'd size or a
unit the item doesn't sell silently lands at the default price, and
`materialize-deliveries.ts:181-233` copies that into `delivery_items`.
**Fix:** 400 on any line whose unit/size/color/variety is not in the resolved
lists (the resolvers in `src/lib/order-availability.ts` already exist).

### 1.7 Harvesters can write arbitrary prices — MED
`api/orders/[orderId]/extras/route.ts:68-74` uses body `unit_price` verbatim
(no finite/≥0 check) and `:41` has no upper bound on quantity. The gate is
admin **or harvester**, and the write goes to `delivery_items`. **Fix:** ignore
body price unless role is admin; cap quantity.

### 1.8 Merge-mode lost update — LOW
`api/orders/route.ts:408-416` computes `existing + mine` outside the
transaction and the RPC sets an absolute quantity. Two follow-ups within the
same second lose one. The RPC already holds `FOR UPDATE`; send a delta instead.

### 1.9 Growth risks (correct today, wrong later)
- `src/lib/production-value/server.ts:91-97` reads every harvesting tray
  un-ranged (246 today, +~60/month → crosses 1,000 in 12–15 months and the
  executive P&L drops the oldest income). Same in
  `admin/microgreens/page.tsx:23` and `lib/tasks/regenerate-microgreens.ts:140`
  (there a truncation would re-sow already-sown trays).
- `admin/forecast/page.tsx:64-78` has no date filter and relies on the
  1,000-row cap + `ORDER BY` covering 8 weeks (≈5–6 months today).
- `admin/deliveries/page.tsx:62-85` derives month stats from a `.limit(60)`
  window (max observed 32/month; 4 restaurants × 13 dates + events = 52+).
- `settings/data-check` and `orders/page.tsx:91-95` read whole tables.

## 2. Authorization and input handling

### 2.1 Chefs can re-open a closed date — HIGH
`api/order/open-date/route.ts:76-86`: if a `delivery_dates` row exists with
`ordering_open=false`, the route flips it to `true` for any chef on the
service-role client. Business rule 3 ("ordering locked when admin closes a
date") is defeated by one POST. **Fix:** non-admins may only *create* custom
rows; never set `ordering_open=true` on an existing row unless admin.

### 2.2 `is_active` not enforced on non-admin APIs — HIGH
`requireUser` (`api-auth.ts:38-44`) never reads the profile; `requireRole` only
checks `is_active` when `requireActive` is passed. Callers without it:
`orders` POST, `events/order`, `event-requests` (inline), `order/open-date`
(inline), `suggestions`, `receiver/check-line`, `receiver/close-delivery`; page
guards in `order/page.tsx` and `receiver/page.tsx` also skip it. Only
`/admin/layout.tsx` and `/harvest` honour it. **Fix:** make `requireUser` 403
on `is_active=false`, or make `requireActive` the default.

### 2.3 Weekly digest cron fails open when `CRON_SECRET` is unset — HIGH (latent)
`api/reports/weekly-digest/route.ts:26` compares to the template string
`Bearer ${process.env.CRON_SECRET}`; unset → `"Bearer undefined"` passes. The
path is on the middleware public list. The other six cron-style handlers fail
closed (`partner-report/route.ts:94-102` is the pattern to copy). Also: no log
row, no sent-week stamp (a Vercel re-fire sends twice), no `maxDuration`.

### 2.4 Auth callback open redirect — LOW/MED
`src/app/auth/callback/route.ts:11,18` builds `${origin}${next}`. `next=@evil.com`
yields `https://pressfarm.io@evil.com` (userinfo + foreign host);
`next=.evil.com` yields `pressfarm.io.evil.com`. Needs a valid one-time code,
so exploitability is limited, but the fix is two lines: require `next` to start
with `/` and not `//` or `/\`.

### 2.5 Login drops the deep link — MED (UX)
`middleware.ts` redirects to `/login` without the original path and
`login/page.tsx:46` always sends to `/`. A chef tapping an email link to
`/history/<id>` or `/order?date=…` lands on `/order` for the default date.
**Fix:** middleware appends `?next=<path+search>`; login validates (relative
path only) and navigates there.

### 2.6 Mass assignment on six admin routes — MED
`microgreens/demand` (POST `.insert(body)`), `demand/[id]` (`.update(body)`),
`microgreens/crops` + `[id]`, `plantings` + `[id]` write the raw body on the
service-role client. Admin-only, so integrity not privilege, but a stray `id`
/ `farm_id` / `created_at` key lands in the row. `planter-boxes/[id]:30-33`
has the allow-list pattern to copy.

### 2.7 Raw Postgres error text returned to clients — MED
≈130 `{ error: error.message }` sites, including chef/receiver/harvester
routes and the pre-auth `auth/signup/route.ts:74/91/103`. `test-email` returns
`err.stack`. Constraint and column names are reconnaissance. Log server-side,
return a generic message (as `orders/route.ts:454` already does).

### 2.8 Unbounded / unvalidated chef inputs — MED
`orders/route.ts`: `freeform_notes`, `color_key`, `variety_key`, `size_label`,
`unit_type` uncapped (only line `notes` is sliced to 500).
`event-requests/route.ts:105-127`: `unit` any string, `needed_by_date` not
format-checked but compared lexically. `events/order/route.ts:95-109` same for
`event_date`/`delivery_date`.

### 2.9 Smaller
- Two parallel admin gates: `src/lib/tasks/auth.ts` (11 routes) vs
  `api-auth.ts` (24 routes), plus 6 inline `getUser()`→role blocks. A fix to
  one (e.g. 2.2) silently misses the others.
- `CRON_SECRET` compared with `!==` in all 7 cron routes while
  `validateApiKey` already does constant-time. A shared `requireCronSecret()`
  fixes 2.3, this, and the 401-vs-500 inconsistency at once.
- 14 routes `await request.json()` unguarded → 500 HTML page on a malformed body.
- `settings/route.ts:23-32` trusts `farm_id` from the body, has no key
  allow-list (admin can write the cron-control keys), and throws on a missing
  `settings` object.
- `v1/orders`, `v1/deliveries`: `limit` is `parseInt` with no clamp.
- `upload/route.ts:37-45`, `upload/sign:75-82`: file extension taken from the
  client filename; map from MIME instead.

## 3. Chef order flow (UX correctness)

### 3.1 Draft restore ignores `editingOrderId` → merge doubles the order — HIGH
`OrderForm.tsx:131-229`: Edit an order → Review (draft saved with
`editingOrderId`) → tap the "Order" tab instead of Submit → the restore effect
rehydrates every line into a form with no `editingOrderId` → Submit sends
`editing_order_id: null` → route finds the existing order → **merge** →
every line summed with itself. Easy to hit with rotating staff on a shared
account. **Fix:** skip/clear a saved draft whose `editingOrderId` is set when
not in edit mode, or carry it into state.

### 3.2 Edit-mode hydration uses the master unit list — MED/HIGH
`order/page.tsx:93,114-126` omits `available_units` from the edit join and
computes `hasMultiUnits` from raw `item.unit_type`. With an override, the
existing line hydrates under `id__unit:lg` while the form enumerates `id`: the
quantity is invisible and, because edits submit with `p_replace=true`, it is
deleted on save with no warning. Lines flipped to unavailable after ordering
vanish the same way (`:224`). **Fix:** select `available_units`, use
`resolveUnits`, and show dropped lines in the amber "Editing" banner.

### 3.3 No hint that an order already exists for the date — MED
`/order` never looks up the chef-editable order for (restaurant, date). A
second cook sees an empty form, rebuilds the order, submits, and every
overlapping line doubles. CLAUDE.md says "last save wins"; the route merges.
Either is fine, but the form should say "You already have N items on this
date — Edit / Add to it" and label the button accordingly.

### 3.4 Review → Back drops the chosen date — MED
`order/review/page.tsx:127,230` push `/order`, not `/order?date=`. A Saturday
draft restored only if the chef happens to tap the Saturday chip; otherwise
they see an empty Thursday form (and see 3.3).

### 3.5 Idempotency token minted per Review pass — MED
`OrderForm.tsx:395-398` makes a new UUID on every `handleReview`, so the
realistic lost-response retry (Network error → Back → Review → Submit) carries a
new token and merges. `EventOrderClient.tsx:249-252` mints it inside
`handleSubmit`, so the Events dedupe can never match. Persist the token with
the draft; rotate only on success.

### 3.6 Events per-line notes are discarded — MED
`EventOrderClient.tsx:215-223` omits `itemNote`; `api/events/order` accepts no
`notes`. This is the bug migration 080 fixed for chefs. Also
`history/[orderId]/page.tsx:47-61` never selects `order_items.notes`, so no one
can confirm a note after submitting.

### 3.7 Smaller
- Category badge count ignores multi-unit keys (`category-section.tsx:119-123`).
- No `React.memo` on `ItemRow`; every keystroke in a note re-renders ~100–300
  rows. `order/page.tsx` has ≈9 sequential awaits where the last four are
  independent.
- a11y: note input has placeholder only (`item-row.tsx:504`), collapse button
  lacks `aria-expanded`, four `<label>`s without `htmlFor` in the Events form
  and `PickCustomDateLink`.
- Touch: filter chips 36px, reorder dismiss 36px, custom-date trigger no
  min-height, history Edit/Order-again 40px; `type="number"` without
  `inputMode="numeric"` (full keyboard on iOS); `max={Infinity}` renders an
  invalid attribute.

## 4. Performance on the iPhone

- **Order form thumbnails** (`item-row.tsx:203-226`): flower matches load the
  768px brand PNGs (300–775 KB each) through a raw `<img>` at 64px; the
  placeholder wreath is a 1.9 MB 1024px PNG rendered at 40px, 25 % opacity,
  **not lazy**. Uploaded photos are only client-resized above 5 MB.
- **FloralCorners** (`FloralCorners.tsx:30-34,84-96`): four random 768px PNGs
  (~1.2–1.5 MB) per hard load, no `loading="lazy"` / `fetchPriority="low"`,
  random picks defeat the cache. Competes with LCP on every page incl. `/order`.
- **Fonts**: Inter is unused outside `/admin/ui-kit`; JetBrains Mono has 3
  call sites; Cormorant preloads 8 files for ~3 uses. Roboto and Baskervville
  are the real body/display fonts and should stay. The `fonts.cdnfonts.com`
  stylesheet in `layout.tsx` is render-blocking and redundant (local woff2 is
  19 KB and already in `globals.css`).
- **CSS background decorations**: `marigold-2.png` (710 KB) as a 14px bullet in
  16 files; `squash-blossom-2.png` (243 KB) at 56px on 54 pages. Need 64–128px
  variants. `PwaInstallPrompt.tsx:126` loads the 1.5 MB mandala at 40px when
  `pressfarm-mandala-240.png` exists.
- **Server waterfalls**: availability editor (`availability/[date]/page.tsx:41-96,
  115-137`) ≈12 serial hops incl. an N+1 carry-over loop; delivery log
  (`deliveries/[date]/page.tsx:35-66`) 3 serial; weekly-update page ≈9 serial;
  admin layout adds 3 serial badge queries to every admin navigation. The
  sibling `orders/[date]/page.tsx:40-98` shows the `Promise.all` pattern.
- `withSentryConfig` injects the client SDK into every bundle while the DSN is
  unset; gate it on `NEXT_PUBLIC_SENTRY_DSN` until Sentry is activated.
- `public/` is 60 MB, 11.4 MB of it byte-identical duplicates
  (`assets/logo/` mirrors `assets/pressfarm/logo/`); `assets/brand/*` and
  `assets/pressfarm/full-sheet/*` are unreferenced. Deploy weight only.

## 5. Frontend, PWA, accessibility

- **`pf-master-gold` missing** (TL;DR #8). Add `gold: "#B58B48"` under
  `pf.master`; for text prefer `pf-gold-700` (#B58B48 on cream is ~2.5:1).
- **Service worker** (`public/sw.js`):
  - Precaches `/`, `/order`, `/order/review`, `/history` which all redirect; a
    redirected response stored under those keys makes the offline fallback
    throw, and precaching while logged-out stores `/login` HTML under `/order`.
    `/order/confirmed` no longer exists.
  - Caches every authenticated page and `?_rsc=` payload, unbounded, with no
    purge on sign-out → on a shared kitchen tablet, an offline navigation after
    sign-out replays the previous account's `/order`.
  - `skipWaiting` + registrar reload on `installed` → every open tab reloads
    within seconds of a deploy that bumps `CACHE_NAME`; the order form only
    writes its draft on Review, so a chef mid-order loses everything.
- **Contrast**: `text-farm-muted/90` through `/40` are 4.07 → 1.72:1 on cream
  (≈127 uses, all under AA for body text); `.login-label` 3.6:1, `.login-footer`
  2.1:1, `global-error.tsx` `#888` 3.3:1.
- **Error boundaries**: only `admin`, `calendar`, `order` have `error.tsx`.
  `/receiver`, `/harvest`, `/history`, `/events`, `/login`, `/signup`, `/about`
  escalate to `global-error.tsx`, which is unbranded, has no `lang`, and prints
  `error.message` raw.
- **Touch targets**: `EditorialHero` back link 32px (63 pages), PWA prompt
  dismiss 32px, harvest Cancel/Change 32px and unit chips ~30px, BottomNav tabs
  ~41px in landscape.
- **Harvest portal**: Spanish UI under `lang="en"`, search input placeholder
  only, labels not associated. No skip link; `<nav>`s lack `aria-label`.
- No `prefers-reduced-motion` handling anywhere (21 `animate-spin`, infinite
  `pf-flower-spin`). `FlowerSpinner` picks a random flower in `useState`, so
  SSR'd `loading.tsx` hydrates with a mismatch warning.
- Manifest: no `id`/`scope`, one icon with `"purpose": "any maskable"` (crops
  the mandala), `orientation: "portrait"` locks iPad. `robots.ts` omits
  `/harvest` and `/signup`; `sitemap.ts` uses `new Date()` for `lastModified`.

## 6. Reliability, tests, tooling, dependencies

- **No CI, no hooks** — `.github/` does not exist, `.git/hooks` has only
  samples, no husky. `next build` enforces tsc + lint but `vitest` never runs
  in the deploy path; a pricing-precedence regression ships green. Add
  `.github/workflows/ci.yml` (`npm ci; tsc --noEmit; next lint; vitest run`)
  on push to `main`.
- **Money paths untested** — nothing references `materialize-deliveries`,
  `/api/deliveries`, or digest/partner aggregation. `materialize-deliveries.ts:
  201-214` re-implements the price precedence from `pricing.ts:33-43`
  (lowercases the unit; pricing.ts doesn't). Extract a pure
  `planDeliveryRows()` and pin: resolved = picked||shorted||fulfilled; shorted →
  `quantity_fulfilled`; price precedence; legacy size-less row suppresses sized
  rows; same-key merge only when prices match; finalized delivery skipped.
- **Email** (`src/lib/email.ts:80-118`): `fallbackText` is never passed as
  `text`, so all 8 flows go out HTML-only; Resend errors are logged and
  discarded. Consequences: `forecast-email/route.ts:126-134` counts rejected
  sends as sent; `partner-report/route.ts:367-382` returns `sent: true`
  unconditionally; `labor/send-timesheet/route.ts:84-92` ignores the result.
- **Weekly-update log** (`weekly-update.ts:56-79`): the insert's `{error}` is
  never read (supabase-js doesn't throw), so a failed log row either produces a
  false "chefs did NOT get the update" alert or hides a real failure — the
  2026-08-17 blind spot again. The sent-week stamp is written *after* the
  sends, so a late-slot overlap can re-send.
- **Cron durations**: `weekly-update`, `weekly-digest`, `forecast-email`,
  `partner-report` export no `maxDuration` and `vercel.json` has no
  `functions` block → plan default (10–15 s). The annual partner report pages a
  year of `delivery_items` plus production value; `forecast-email` does one
  `getUserById` + one send per chef sequentially.
- **Quarterly partner reports** fire at 23:00 UTC on the quarter's last day
  (4 PM Pacific, Dec 31 2026 is a Thursday delivery day); evening deliveries
  are excluded and never re-sent. Move to the 2nd and use
  `mostRecentCompletedQuarter`.
- **Playwright** is configured (`playwright.config.ts`, `tests/smoke.spec.ts`,
  `docs/E2E_TEST_WALKTHROUGH.md`) but `@playwright/test` is not installed,
  there is no `test:smoke` script, and tsconfig excludes the spec. Wire it or
  delete it.
- **Dependencies** (`npm audit`: 3 critical / 21 high):
  - `next@14.2.35` is inside several published ranges (image-optimizer RCE via
    SVG/AVIF, RSC cache poisoning, middleware-redirect cache poisoning). `next/image`
    is used, so `/_next/image` is live. 15.5.x is the realistic step; the
    `@supabase/ssr` 0.5 → 0.12 cookie-API change should go with it.
  - `@sentry/nextjs@10.57` critical advisory (tunnel route; not configured
    here) — patch bump to 10.75.2+.
  - `xlsx@0.18.5` prototype pollution + ReDoS; admin-only and no size cap on
    the three importers. Pin to the sheetjs tarball or cap upload bytes.
  - `supabase` CLI devDep pulls a critical `tar`; CLAUDE.md says it isn't
    linked — remove. `react-email` is in `dependencies` and drags a second
    `next@15.1.2`; move to dev or drop. `vitest-mock-extended` is unused.
    `dotenv` is only used by `scripts/`.
- ESLint is `next/core-web-vitals` only; a type-aware
  `no-floating-promises` would have caught the three swallowed-result bugs.
- `as any` casts: 455 (ARCHITECTURE_REVIEW counted ~248 in July). The trend
  is the wrong way; `database.ts` covers every table except `planter_box_*`
  and `pack_inventory`.

## 7. What's done well (keep doing this)

- The order-submit path is genuinely hardened: pure tested cores
  (`pricing.ts`, `orders.ts`, `order/lines.ts`, `order-keys.ts`), an atomic
  RPC with `ORDERING_CLOSED` / `ORDER_LOCKED` re-checks inside the
  transaction, `FOR UPDATE` idempotency, client price never trusted, stale
  availability ids remapped by `item_id` instead of bouncing the cart.
- Least-privilege scoping where lower roles touch service-role routes:
  receivers confined to ±7 days and blocked from finalized deliveries,
  harvesters date-scoped and limited to `is_bonus` deletes, Events orders
  derive the restaurant from the session.
- Secrets: constant-time API-key compare, Svix HMAC with a 5-minute window on
  the inbound webhook, `getUser()` not `getSession()` in middleware, GET-only
  v1, `admin` kept out of the assignable-role list.
- The 1,000-row lesson was institutionalised (`fetch-all.ts` documents the
  incident; `calendar/fetch.ts` uses head-counts; executive moved to a view).
  §1.2 is the three files that predate it.
- `orders/[date]/page.tsx` and `dashboard/page.tsx` run their reads in one
  `Promise.all` with a comment explaining why.
- The weekly-update log + watchdog is outcome-based, and the delay/skip logic
  is pure and tested. `safeResendSend` is a single choke point with Reply-To
  defaulting to the inbound webhook, `EMAIL_OVERRIDE_TO`, CID inlining, and
  every template uses the 240px mandala.
- Mobile fundamentals: pinch-zoom enabled, 16px inputs, safe-area insets, a
  global 44px base rule, labelled login/signup forms, `/about` with canonical +
  OG + `next/image` `sizes` everywhere.

## 8. Still open from the prior reviews

From `docs/ARCHITECTURE_REVIEW.md` (July): §2.4 de-cast campaign (now 455,
was 248); §2.5 `event-requests/accept.ts` still six un-transactioned writes;
§2.6 service-role in 110 of 119 routes; §2.7 `AvailabilityEditor` (now 880
lines, no `React.memo` row), `OrderForm` (0 `useMemo`), `ReceiverClient`
(`router.refresh()` per checkbox at `:391,:530`), CSV import trio (1,677
lines); §2.8 date helpers now ×6, `.single()` on `delivery_dates` in
`orders/route.ts:170`, no zod.

From `docs/website-audit-2026-09-15.md`: 2.1 deliveries `CalendarView`,
2.8 receiver-archive vs history list, 3.1 "Log a delivery" placement, 3.3
harvest list on order detail, 4.5 missing `EditorialHero` on 8 pages, 4.11
chef page chrome, 4.14 `/about` reachability.

## 9. Suggested order of work

1. **Money + auth quick fixes (one session, all S):** TL;DR #1, #2, #3
   (status after materialize), #5, #6, #7, #8, and the crops `delivery_id`
   select. Each is a few lines and has a precedent in the same codebase.
   #2/#3 want a test alongside (`fetchAllRows` already has one).
2. **Delivery log RPC + `planDeliveryRows()` extraction with tests** — the
   one money function never given the pure-core treatment. Needs a migration
   (next number 096).
3. **Chef flow:** 3.1 (edit-draft merge), 3.2 (edit hydration), 3.4
   (Back keeps date), 3.5 (persist token), 3.6 (Events notes). Then the
   "existing order" banner (3.3) as a small UX decision.
4. **CI + email result handling + weekly-update log error read** — stops the
   next silent failure. Add `maxDuration` to the four cron routes.
5. **Page weight:** thumbnails/wreath/FloralCorners through `next/image` or
   small variants, drop Inter + JetBrains + the cdnfonts link, gate Sentry.
   Expect the `/order` first load to lose several MB.
6. **Service worker:** stop precaching redirecting routes, purge on sign-out,
   defer the update reload. Write the order draft on every change.
7. **Dependency pass:** Sentry patch bump, remove `supabase` CLI +
   `vitest-mock-extended`, move `react-email` + `dotenv` to dev, then plan the
   Next 15 / `@supabase/ssr` upgrade as its own session.
8. The long tail: error boundaries, contrast, touch targets, harvest a11y,
   manifest, reduced motion, de-cast campaign, mass-assignment allow-lists,
   generic error messages.

Decisions needed from Micheal: merge-vs-replace semantics for a second
submission on the same date (3.3), whether chefs should ever be able to
re-open a closed date (2.1 assumes no), and whether to take the Next 15
upgrade now or after the quick fixes.
