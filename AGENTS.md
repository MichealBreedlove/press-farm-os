# AGENTS.md

See `CLAUDE.md` for full project context, stack details, and repo structure.

## Cursor Cloud specific instructions

### Services overview

| Service | How to run | Port |
|---------|-----------|------|
| Next.js dev server | `npm run dev` | 3000 |
| Supabase (local) | `npx supabase start` | API 54321, DB 54322, Studio 54323, Inbucket 54324 |

### Prerequisites

- **Docker** must be running before `npx supabase start`. In the Cloud Agent VM, Docker requires `fuse-overlayfs` storage driver and `iptables-legacy`. The daemon must be started with `sudo dockerd` and `/var/run/docker.sock` must be readable.
- **Node.js 20+** is required (`@types/node` ^20). The VM ships with v22.

### Local Supabase startup

1. Run `npx supabase start` — this pulls Docker images (first run takes ~1 min), runs all migrations in `supabase/migrations/`, and exposes the local Supabase stack.
2. The local credentials (anon key, service role key, JWT secret) are printed at the end of `supabase start`. Use them in `.env.local`.
3. Local dev `.env.local` values:
   - `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=` (from `supabase start` output)
   - `SUPABASE_SERVICE_ROLE_KEY=` (from `supabase start` output)
   - `RESEND_API_KEY=re_placeholder_for_local_dev`
   - `NEXT_PUBLIC_APP_URL=http://localhost:3000`

### Gotchas

- **Migration 007 (`financial_periods` VIEW)** had a correlated subquery bug (`ungrouped column from outer query`). Fixed by rewriting as a LEFT JOIN. If you see this error, check the current migration file.
- **Migration 008 (`extend_seed`)** had a type cast issue — `NULL` values in a VALUES clause defaulted to text, conflicting with `decimal(10,2)`. Fixed with explicit `::decimal(10,2)` cast.
- **`supabase/config.toml`** requires a `project_id` field (e.g., `project_id = "press-farm-os"`) for Supabase CLI v1.200+.
- **`next.config.js`** has `typescript.ignoreBuildErrors: true` due to Supabase SDK type incompatibility. TypeScript errors won't block builds.
- Most API routes return 501 and many pages are stubs — this is expected per the project's Phase 1 build plan.
- Email confirmation is disabled in local Supabase config (`enable_confirmations = false`), so signups work immediately. For testing, use Inbucket at port 54324 for magic link emails.

### Creating a test admin user

```bash
# Sign up via Supabase Auth API
curl -X POST http://127.0.0.1:54321/auth/v1/signup \
  -H "apikey: <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@pressfarm.test", "password": "testpass123"}'

# Promote to admin (using service role key)
curl -X PATCH 'http://127.0.0.1:54321/rest/v1/profiles?id=eq.<USER_ID>' \
  -H "apikey: <SERVICE_ROLE_KEY>" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin", "full_name": "Test Admin"}'
```

### Standard commands

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — ESLint check
- `npx supabase start` / `npx supabase stop` — manage local Supabase
