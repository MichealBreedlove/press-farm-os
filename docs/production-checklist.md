# Production Deployment Checklist

Companion to [`production-deployment.md`](./production-deployment.md).
Three sections: one-time hardening (do once, tick off), per-deploy
pre-flight (every push to `main`), and incident quick-reference.

---

## A. One-time production hardening

### Platform

- [ ] Confirm Supabase project `rxdfjaseilmjvcwamqyk` is on a **paid plan**
      (free tier pauses on inactivity and has weaker backups)
- [ ] Enable **PITR** (point-in-time recovery) on Supabase — highest-value
      reliability purchase; the financial records live in this database
- [ ] Verify daily automated backups are on and note the retention window
- [ ] Enable **leaked-password protection** in Supabase Auth dashboard
      (flagged by advisors; manual toggle)
- [ ] Confirm custom domain + TLS on Vercel (pressfarm.io) and that
      `NEXT_PUBLIC_APP_URL` matches it exactly (magic-link redirects break
      on mismatch)
- [ ] Confirm Supabase Auth **Site URL / redirect allow-list** contains the
      production domain (and only trusted domains)

### Monitoring

- [ ] Create free **Sentry** project; set `NEXT_PUBLIC_SENTRY_DSN` in
      Vercel (SDK already wired, ships inert without it); optionally
      `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` for source maps
- [ ] Create **uptime monitor** (UptimeRobot / Better Stack free tier) on
      `GET https://pressfarm.io/api/health`, 1–5 min interval, alert to
      Micheal's email + SMS; alert on 503 as well as timeouts
- [ ] Sentry alert rule: email on **new issue groups** only (not every event)
- [ ] Calendar reminder (weekly): glance at Vercel cron run history +
      Resend dashboard for bounces

### Secrets & env

- [ ] Full env inventory present in Vercel **Production** scope:
      `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
      `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
      `RESEND_INBOUND_SIGNING_SECRET`, `ANTHROPIC_API_KEY`, `CRON_SECRET`,
      `PRESSFARM_API_KEY`, `NEXT_PUBLIC_APP_URL`
      (+ optional `RESEND_FROM_*`, Sentry vars)
- [ ] `EMAIL_OVERRIDE_TO` is **UNSET** in production
- [ ] Confirm no service-role key or `.env.local` has ever been committed
      (`git log -p -S SUPABASE_SERVICE_ROLE_KEY` comes back clean); rotate
      any key that has leaked
- [ ] Note key-rotation order in your password manager: rotate in provider
      → update Vercel env → redeploy (env changes need a redeploy)

### CI/CD

- [ ] `.github/workflows/ci.yml` green on `main`
- [ ] (Optional, recommended) GitHub branch protection on `main`: require
      the `verify` check — even without PRs it blocks a red push from
      landing… note this forces PR flow; skip if direct-push stays the style
- [ ] Vercel: confirm **auto-deploy from `main`** only (no other prod branches)

---

## B. Per-deploy pre-flight (every push to `main`)

Because `main` auto-deploys, the local gate is the real gate:

- [ ] `npx tsc --noEmit` clean
- [ ] `npx next lint` clean
- [ ] `npx vitest run` — all tests pass
- [ ] `npm run build` succeeds
- [ ] **Migration ordering** (if the change touches schema):
  - Additive: migration applied in prod **before** this push
  - Destructive: old references removed and deployed **before** the migration
  - Migration number checked against `supabase/migrations/` (next: 067)
- [ ] New env vars (if any) added in Vercel **before** pushing
- [ ] Financial-calculation or pricing logic touched? → check in with
      Micheal first (per `CLAUDE.md`)

**Post-push (2 minutes):**

- [ ] Vercel deployment reaches READY
- [ ] `curl -s https://pressfarm.io/api/health` → `"status":"ok"` with new commit SHA
- [ ] Touched page loads on a phone-width viewport
- [ ] Sentry: no new issue group in the first ~15 min (for risky changes)
- [ ] If schema changed: run Supabase **advisors**; only expected noise
      (see `CLAUDE.md` migration 044 notes) appears

---

## C. Incident quick-reference

| Symptom | First move |
|---------|-----------|
| Site down / health 503 | Vercel status page → Supabase status page → Vercel logs. If a deploy just landed: **Promote previous deployment** (instant), then revert the commit on `main` |
| "column does not exist" page errors | Migration/code drift. Apply the missing migration (fast fix) or promote previous deployment (safe fix) |
| Chefs can't log in | Check Supabase Auth logs; verify `NEXT_PUBLIC_APP_URL` + Auth redirect allow-list; magic-link emails may also be a Resend issue |
| Emails not arriving | Resend dashboard (bounces? suspension?) → `/admin/settings/emails` → verify `RESEND_API_KEY` unchanged in Vercel |
| Cron didn't run (no digest/timesheet) | Vercel cron run history → invoke manually with `curl -H "Authorization: Bearer $CRON_SECRET" https://pressfarm.io/api/cron/…` → check `CRON_SECRET` in env |
| Data disaster (bad bulk edit/import) | Stop writes (close ordering if relevant). Small blast radius: fix-forward with a data migration. Large: Supabase PITR/backup restore — accepts losing writes since restore point; coordinate with Micheal first |
| Vercel extended outage during order window | Chefs text orders to Micheal (paper fallback); if truly extended, self-host path: `docs/production-deployment.md` §4 + `deploy/k8s/README.md`, then repoint DNS |

**Escalation reality:** one operator (Micheal). The runbook is written so
any competent engineer (or Claude session) can execute it with repo +
Vercel + Supabase access.
