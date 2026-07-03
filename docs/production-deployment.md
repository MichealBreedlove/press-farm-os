# Press Farm OS — Production Deployment & Operations

Senior-DevOps view of how Press Farm OS runs in production, how changes
reach it, how we know it's healthy, and what to do when it isn't. The
companion pre-flight list is [`production-checklist.md`](./production-checklist.md).

The system serves ~a dozen humans (one admin, rotating chefs at two
restaurants, receivers) with hard business deadlines: orders land the
night before Thursday / Saturday / Monday deliveries. Architecture
decisions below optimize for **zero-ops reliability during those windows**,
not for web-scale throughput.

---

## 1. Infrastructure architecture

```
                        ┌────────────────────────────────────────────┐
                        │                 Vercel                     │
   Chefs (mobile)  ───► │  Edge network / CDN                        │
   Admin (iPhone)  ───► │   ├─ static assets, brand images (cached)  │
   Receivers       ───► │   └─ Next.js 14 serverless functions       │
                        │        ├─ App Router pages (SSR, dynamic)  │
   UptimeRobot ───────► │        ├─ /api/* (authed app routes)       │
   (GET /api/health)    │        ├─ /api/v1/* (read-only, API key)   │
                        │        └─ /api/cron/* + reports            │
                        │              ▲ Vercel Cron (9 schedules,   │
                        │                Bearer CRON_SECRET)         │
                        └───────┬──────────────┬─────────────┬───────┘
                                │              │             │
                     ┌──────────▼───────┐  ┌───▼────────┐  ┌─▼──────────────┐
                     │    Supabase      │  │   Resend   │  │  Anthropic API │
                     │  (project ref    │  │  outbound  │  │  (extraction,  │
                     │  rxdfjaseilmjvc… │  │  email +   │  │  catalog audit,│
                     │  ─ Postgres 15   │  │  inbound   │  │  crop recs)    │
                     │  ─ Auth (magic   │  │  webhook ──┼──► /api/inbound/  │
                     │    link + pw)    │  │  (HMAC)    │  │  reply         │
                     │  ─ RLS policies  │  └────────────┘  └────────────────┘
                     │  ─ Storage       │
                     │    (photos)      │       ┌─────────────────────┐
                     └──────────────────┘       │  Sentry (errors)    │
                                                │  client + server +  │
                                                │  edge, DSN-gated    │
                                                └─────────────────────┘
```

**Trust boundaries**

| Boundary | Control |
|----------|---------|
| Browser → app | Supabase Auth session (magic link / password); RLS scopes chefs to their restaurant |
| App → DB (admin ops) | `SUPABASE_SERVICE_ROLE_KEY`, server-only, bypasses RLS; every route self-gates on `profiles.role` |
| Vercel Cron → cron routes | `Authorization: Bearer CRON_SECRET`, fail-closed in prod |
| Resend → inbound webhook | HMAC signature (`RESEND_INBOUND_SIGNING_SECRET`), 401 on mismatch |
| Public API consumers → `/api/v1/*` | Shared `PRESSFARM_API_KEY`, GET-only |
| All responses | Security headers (HSTS, nosniff, frame-deny, referrer, permissions policy) via `next.config.js` |

**Why this shape.** Vercel + Supabase are both managed, multi-AZ, and
scale-to-zero-ops. For a single-farm app the alternative (self-managed
containers + Postgres) adds pager duty without adding reliability. The
Docker/Kubernetes path (§4) exists as a tested escape hatch, not as the
plan.

---

## 2. Deployment workflow

**Environments**

| Env | What | URL | Data |
|-----|------|-----|------|
| Local | `npm run dev` | localhost:3000 | Real Supabase project (be careful) or a Supabase branch |
| Preview | Vercel preview deploy, automatic per branch push | `*.vercel.app` | Same prod Supabase (env vars are shared) — treat previews as prod-data |
| Production | Vercel, auto-deploy on push to `main` | pressfarm.io | Prod Supabase `rxdfjaseilmjvcwamqyk` |

**The path to production**

```
feature branch ──► push ──► CI (typecheck, lint, 183 tests, build)
                              │                    │
                              │                    └─ Vercel preview deploy (manual smoke)
                              ▼
                    merge/push to main ──► CI re-runs (alarm)
                                            │
                                            └─► Vercel production build ──► promote
                                                     │
                                                     └─ smoke: GET /api/health → 200
```

Direct pushes to `main` are the house style (no PRs). That makes the local
gate non-negotiable: **`tsc --noEmit`, `next lint`, `vitest run`, and
`npm run build` must pass before every push** — CI on `main` is an alarm,
not a gate, because Vercel builds the same commit in parallel.

**Database migrations** are the dangerous half of any deploy (see
`CLAUDE.md`): code auto-deploys but migrations are applied manually
(Supabase MCP or SQL editor). The ordering rule:

1. **Additive change** (new table/column): apply the migration *first*,
   then push code that reads it. Never the reverse — a deployed SELECT
   against a missing column takes down the page.
2. **Destructive change** (drop/rename): push code that stops referencing
   the old name first, confirm the deploy, then apply the migration.
3. Never both directions in one push.

**Rollback**

- **App:** Vercel → Deployments → previous deployment → *Promote to
  Production*. Instant (it's a routing flip, no rebuild). Then revert the
  bad commit on `main` so the next push doesn't re-ship it.
- **Database:** there is no auto-rollback. Migrations are forward-only;
  write a compensating migration. For data disasters, restore from
  Supabase backups (§5) — this loses writes since the backup, so treat it
  as last resort.
- **Config/env:** Vercel env var changes need a redeploy to take effect;
  the previous deployment keeps the old values, which is what makes
  promote-previous a true rollback.

---

## 3. CI/CD pipeline

`.github/workflows/ci.yml`, two jobs:

1. **verify** (every PR + every `main` push): `npm ci` → `tsc --noEmit` →
   `next lint` → `vitest run` (183 tests) → `next build`. Runs with
   placeholder env — all data-fetching pages render dynamically (they go
   through `cookies()`), so the build never contacts Supabase. If a change
   accidentally makes a page static-with-data, CI catches it before Vercel
   does.
2. **docker** (PRs only, and only when `Dockerfile` / lockfile /
   `next.config.js` change): builds the container image so the self-host
   escape hatch can't silently rot.

Deployment itself stays on Vercel's Git integration (build on push,
immutable deployments, automatic TLS/CDN). We deliberately do *not*
deploy from Actions: it would re-implement what Vercel already does with
more moving parts and a token to leak.

**Post-deploy verification:** Vercel marks the deployment READY, then the
uptime monitor's next `GET /api/health` confirms app + DB from outside.
For risky changes, watch Sentry's release view for new error groups in
the first 15 minutes.

---

## 4. Docker / Kubernetes (self-host escape hatch)

Not used in production — maintained so the app is portable and testable
in a prod-like way.

- **`Dockerfile`** — multi-stage (deps → build → runtime), Next.js
  `standalone` output (gated behind `BUILD_STANDALONE=1` so Vercel builds
  are untouched), non-root user, `HEALTHCHECK` on `/api/health`. Final
  image is node:20-alpine + the standalone server (~200MB).
- **`docker-compose.yml`** — one-command prod-parity run against the real
  Supabase project: `docker compose up --build` with `.env.local`.
- **`deploy/k8s/`** — Deployment (2 replicas, `maxUnavailable: 0` rolling
  updates, liveness/readiness probes), Service, Ingress (cert-manager
  TLS), HPA (2–6 replicas on CPU), and one CronJob per `vercel.json`
  schedule hitting the same endpoints with `CRON_SECRET`. See
  `deploy/k8s/README.md` for the deploy/rollback runbook.

**When to actually use it:** Vercel pricing becomes unreasonable, a
compliance need requires fixed egress IPs, or Vercel has an extended
outage during an order window (bring it up on any VPS + point DNS).
Supabase stays where it is in all scenarios — the database does not move.

---

## 5. Monitoring, logging, reliability

**Layers (outside-in):**

| Layer | Tool | What it catches | Setup state |
|-------|------|-----------------|-------------|
| Uptime | UptimeRobot / Better Stack, `GET /api/health` every 1–5 min | App down, DB unreachable (503 = degraded), TLS/DNS issues | **To do** — free tier, 5 min |
| Errors | Sentry (`@sentry/nextjs`, client + server + edge) | Unhandled exceptions, API 500s, browser errors, release regressions | Wired, **inert until `NEXT_PUBLIC_SENTRY_DSN` set in Vercel** |
| Request logs | Vercel function logs (dashboard / `vercel logs`) | Per-request status, duration, cold starts, cron invocations | On by default; retention is short — Sentry is the durable record |
| DB health | Supabase dashboard: advisors, slow queries, connection count | Missing indexes, RLS misconfig, connection exhaustion | Advisors clean as of 2026-06-10; re-check after each migration |
| Email | Resend dashboard + `/admin/settings/emails` | Bounces, failed sends, inbound webhook failures | Shipping |
| Cron | Vercel cron run history; each route logs + fails loudly on bad auth | Silent scheduler failures (digest/timesheet/tasks not sent) | Weekly glance; Sentry captures throws inside cron routes |

**Health endpoint.** `/api/health` (unauthenticated, no-store) returns
`200 ok` when a 3s-timeboxed HEAD count on `farms` succeeds, `503
degraded` when it doesn't, plus deploy SHA and latency. It is the single
probe target for uptime monitors, Docker `HEALTHCHECK`, and k8s probes.

**Alert routing (keep it boring):** uptime monitor → email/SMS to
Micheal; Sentry → email on new issue groups, with per-issue mute. Two
channels is the right number for a one-operator system — more will get
ignored.

**Backups / disaster recovery**

- Supabase runs daily automated backups (verify plan tier; PITR is a paid
  add-on worth taking — the financial records live here).
- Add a monthly manual export before big changes:
  `pg_dump` via the connection string, or the per-resource CSV exports at
  `/admin/{items,expenses,deliveries}/data` for a human-readable copy.
- Storage bucket (photos) is not in pg backups — it's low-value,
  re-uploadable content; accept the risk.
- **RTO/RPO expectations:** app layer minutes (promote previous deploy /
  redeploy); database up to 24h data loss without PITR, minutes with it.
  Given deliveries are the financial source of truth and are logged same
  day, PITR is the single highest-value reliability purchase.

**Known downtime risks, ranked**

1. **Migration/code drift** (has bitten twice): a deployed SELECT against
   a column whose migration wasn't applied. Mitigation is the ordering
   rule in §2 — it's procedure, not tooling; follow it.
2. **Supabase pause/limits**: free-tier projects pause after inactivity
   and cap connections. Confirm the project is on a paid plan; the uptime
   monitor doubles as keep-alive.
3. **Env var drift**: a rotated Supabase/Resend key not updated in
   Vercel. Symptoms: auth loops or silent email failure. `/api/health`
   catches the DB half; the email-status page catches the Resend half.
4. **Vercel/Supabase platform outage**: rare; nothing to do but wait or
   (extended case) exercise §4. Order-taking degrades gracefully — chefs
   can text Micheal, orders get entered after recovery.
5. **Cron silently failing** (bad `CRON_SECRET` after rotation): routes
   500 loudly in prod when the secret is missing; Sentry + weekly glance
   at cron history cover it.

---

## 6. Scaling

**Reality check:** peak load is a handful of chefs submitting orders the
night before a delivery — tens of requests/minute. The stack's ceilings
are orders of magnitude away. Scaling work is therefore about *not
regressing*, and about the few real growth axes:

- **Compute** scales automatically (Vercel serverless per-request; HPA in
  the k8s path). Nothing to manage.
- **Database connections** are the classic serverless×Postgres failure
  mode. Supabase's pooler (transaction mode) absorbs it; at current load
  it's a non-issue. If connection errors ever appear in Sentry, confirm
  clients hit the pooler port (6543), not Postgres directly.
- **Data growth**: `delivery_items` is the fastest-growing table (~3.7k
  rows) and its report scan already moved to SQL (`report_item_revenue`
  view, migration 065). The residual JS rollups over `deliveries` (~400)
  and `farm_expenses` (~130) are fine until tens of thousands of rows —
  revisit then, not before. List queries are capped (labor 1000, notes
  500, event-requests 300; chef history paginated).
- **More restaurants** is the real scale axis and it's a data change, not
  an infra change — the schema is already multi-restaurant
  (`restaurant_users`, RLS by restaurant). Infra-wise, 10 restaurants ≈
  today × 5, still negligible.
- **Cold starts** are the only user-visible latency risk (first admin
  request of the morning). Acceptable today; if it grates, the uptime
  monitor's 1-minute interval keeps functions warm as a side effect.

**Don't build:** Redis/caching layers, read replicas, queues, or
microservices. At this traffic they add failure modes and remove none.

---

## 7. Production deployment checklist

Lives in [`production-checklist.md`](./production-checklist.md) —
one-time hardening items, the per-deploy pre-flight, and the incident
quick-reference, in checkbox form.
