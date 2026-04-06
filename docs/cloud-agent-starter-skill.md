# Cloud Agent Starter Skill: Run + Test Press Farm OS

Use this as the first-stop runbook for Cloud agents working in this repo.

## 1) Fast bootstrap (do this first)

1. Install deps:
   - `npm install`
2. Create local env file:
   - `cp .env.example .env.local`
3. Fill required env vars in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` (usually `http://localhost:3000`)
   - `RESEND_API_KEY` (optional for local smoke tests; can be dummy)
4. Start app:
   - `npm run dev`
5. Open:
   - `http://localhost:3000/login`

Quick checks:
- `npm run lint`
- `npm run build`

Notes:
- There are no automated unit/integration test files yet, so validation is mostly lint/build plus manual UI/API smoke tests.
- Many admin/report/import/delivery features are scaffolded and intentionally incomplete (expect placeholders and some `501 Not implemented` API responses).

## 2) Login and auth setup (critical for almost every test)

### Required context
- Middleware protects almost all routes and redirects unauthenticated users to `/login`.
- Auth callback endpoint is `/auth/callback`.
- Roles come from `profiles.role` (`admin` or `chef`).

### Create test users (recommended)
1. In Supabase Auth, create:
   - One admin user (email/password)
   - One chef user (magic-link email)
2. In SQL editor, ensure role + restaurant assignment:

```sql
-- Promote admin user
update profiles
set role = 'admin'
where id = 'ADMIN_USER_UUID';

-- Link chef to Press restaurant
insert into restaurant_users (user_id, restaurant_id)
select 'CHEF_USER_UUID'::uuid, r.id
from restaurants r
where r.slug = 'press'
on conflict (user_id, restaurant_id) do nothing;
```

### Auth smoke workflow
1. Visit `/login`.
2. Verify both tabs render:
   - `Chef Login` (magic link)
   - `Admin Login` (password)
3. Sign in as admin, confirm redirect to `/admin/orders`.
4. Sign in as chef, confirm redirect to `/order`.

## 3) Feature flags and local mocking shortcuts

There is no formal feature-flag system yet. Use these practical toggles:

- Email side-effects off (safe local mode):
  - Set `RESEND_API_KEY=dummy`.
  - Order submission should still succeed (email send is best-effort).
- Force ordering open/closed quickly:
  - `update delivery_dates set ordering_open = true where date = 'YYYY-MM-DD';`
  - `update delivery_dates set ordering_open = false where date = 'YYYY-MM-DD';`
- Fast upcoming date seed when dates are stale:

```sql
insert into delivery_dates (date, day_of_week, ordering_open)
values (current_date + 1, 'custom', true)
on conflict (date) do update set ordering_open = excluded.ordering_open;
```

## 4) Area playbooks (run + test by codebase area)

### A) Auth + app shell
Primary files:
- `src/middleware.ts`
- `src/lib/supabase/middleware.ts`
- `src/app/login/page.tsx`
- `src/app/auth/callback/route.ts`
- `src/app/page.tsx`

Test workflow:
1. Unauthed request to `/` should redirect to `/login`.
2. Successful login should create session and redirect based on role:
   - Admin -> `/admin/orders`
   - Chef -> `/order`
3. Invalid callback should land back on `/login?error=auth_error`.

### B) Chef ordering flow
Primary files:
- `src/app/order/page.tsx`
- `src/app/order/client.tsx`
- `src/app/history/page.tsx`
- `src/app/api/orders/route.ts`

Pre-seed minimum test data:
```sql
-- Ensure one open date
insert into delivery_dates (date, day_of_week, ordering_open)
values (current_date + 1, 'custom', true)
on conflict (date) do update set ordering_open = true;

-- Add availability rows for Press using first 10 active items
insert into availability_items (item_id, restaurant_id, delivery_date, status)
select i.id, r.id, current_date + 1, 'available'
from items i
cross join restaurants r
where r.slug = 'press' and i.is_archived = false
order by i.sort_order, i.name
limit 10
on conflict (item_id, restaurant_id, delivery_date) do update set status = excluded.status;
```

Chef test workflow:
1. Login as chef linked to Press.
2. Open `/order`; verify item list renders (not empty state).
3. Add quantities + optional note, submit.
4. Confirm redirect to `/order/confirmed`.
5. Open `/history`; verify a new order row appears.

### C) Admin availability + orders
Primary files:
- `src/app/admin/availability/page.tsx`
- `src/app/admin/availability/[date]/client.tsx`
- `src/app/admin/orders/page.tsx`
- `src/app/api/availability/route.ts`
- `src/app/api/availability/duplicate/route.ts`
- `src/app/api/availability/ordering/route.ts`

Admin test workflow:
1. Login as admin.
2. Open `/admin/availability`, then pick a date.
3. Change statuses (available/limited/unavailable), set limited qty/note, click `Save Availability`.
4. Click `Duplicate Last` and verify data copies from prior date when available.
5. Toggle ordering open/closed and verify badge/state updates.
6. Open `/admin/orders` and confirm page renders with upcoming date cards.

Known behavior:
- `/admin/availability/new` is linked in UI but route is not implemented yet.

### D) Deliveries, reports, import, settings (mostly scaffolded)
Primary files:
- `src/app/admin/deliveries/**`
- `src/app/admin/reports/**`
- `src/app/admin/settings/**`
- `src/app/api/deliveries/**`
- `src/app/api/reports/**`
- `src/app/api/import/**`
- `src/app/api/expenses/route.ts`

Test workflow:
1. Verify pages load and show scaffold/placeholder content (no crash).
2. API smoke (unauth) should return 401:
   - `curl -i http://localhost:3000/api/reports/monthly`
   - `curl -i http://localhost:3000/api/deliveries`
3. With valid auth, many of these endpoints currently return 501 by design until implemented.

### E) Supabase schema + migrations
Primary files:
- `supabase/migrations/001_initial_schema.sql` through `008_extend_seed.sql`

Test workflow:
1. Run migrations in order in Supabase SQL editor or via CLI.
2. Confirm core tables exist (`profiles`, `restaurant_users`, `delivery_dates`, `availability_items`, `orders`).
3. Confirm RLS helper functions exist (`is_admin`, `user_restaurant_ids`).
4. Confirm seed data exists (`farms`, `restaurants`, upcoming `delivery_dates`, sample `items`).

## 5) Common failure patterns and quickest fixes

- Stuck on `/login` after sign-in:
  - Check `profiles.role` and `restaurant_users` mapping.
- Chef sees "not linked to a restaurant":
  - Missing `restaurant_users` row for that chef.
- Chef sees "Ordering is closed":
  - No future `delivery_dates.ordering_open = true`.
- Chef sees "No items available yet":
  - No `availability_items` for chef restaurant + active date.
- Order submit works but no emails:
  - Expected when `RESEND_API_KEY` is unset/dummy.

## 6) How to keep this skill updated

When new runbook knowledge is discovered, update this file in the same PR as the code change.

Add a short entry under the relevant area with:
1. Symptom
2. Root cause
3. Fastest reproducible fix (command/SQL/UI path)
4. Verification step

Keep updates concrete and executable. Prefer copy-paste commands over narrative text.
