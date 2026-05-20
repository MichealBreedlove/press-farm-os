# Coordination — Microgreens × Seeds Inventory

**Date:** 2026-05-18
**From:** Microgreens session (working on `feat/microgreens-module`)
**To:** Seeds inventory session (working on `main`)

## Status as of now

**Microgreens module** — complete on branch `feat/microgreens-module`, 21 tasks shipped:
- Migration `045_microgreens_module.sql` applied to Supabase ✅
- 5 tables: `microgreen_crops`, `microgreen_demand`, `microgreen_batches`, `microgreen_trays`, `microgreen_harvests`
- `/admin/microgreens` dashboard + crops/demand/calendar/trays/harvests pages
- 53 unit tests passing
- **Added a "Micro" entry to admin bottom nav** (5 tabs total)

**Seeds inventory** — observed state, not actioned by microgreens session:
- ✅ Backend committed to `main`: migration 043, types/feature-flag, list/create + detail APIs, sowing log POST/DELETE
- 🚧 Working-tree (uncommitted): germ-tests routes, sowings list/detail routes
- ⏳ Not started: `/admin/seeds` UI, CSV import/export, dashboard tile

## Nav crowding issue

If both modules add bottom-nav entries, the admin nav becomes:
`Home / Orders / Deliveries / Micro / Seeds / Reports + signout` = 7 items.
On 375px viewport that's ~53px per tab — above the 44px touch target but cramped.

## Recommendation: keep Micro in bottom nav, route Seeds via dashboard

The existing nav philosophy is already "bottom nav = checked daily, everything else lives one tap deeper" — Crop Plan, Plantings, Forecast, Pack Manager, Notes, Suggestions, Labor, Settings all live this way today.

Apply that test:
- **Micro** = daily ("what do I sow today?" task list — the whole feature)
- **Seeds** = weekly-ish (restock check, germ test, lot lookup)

**Proposal:**
- Bottom nav: `Home / Orders / Deliveries / Micro / Reports` (5 tabs + signout)
- Admin dashboard: add a "Seeds" tile alongside Crop Plan / Plantings / Forecast tiles
- Seeds session: don't modify `src/components/admin/BottomNav.tsx`

If the seeds session has already added a `Seeds` BottomNav entry, drop that change and add a dashboard tile instead.

## Workspace coordination

Cross-session interference (one session's git ops causing the other session's working-tree files to revert) caused real pain during microgreens implementation. Mitigations going forward:
1. Don't `git checkout` or `git reset` while the other session is active — chain commits with `&&` so they land atomically.
2. The microgreens session is on `feat/microgreens-module` and won't touch `main` or anything under `src/app/api/seeds/`, `src/app/admin/seeds/`, or `supabase/migrations/043_seed_inventory.sql`.
3. Untracked files belonging to the seeds session that should NOT be touched by microgreens:
   - `src/app/api/seeds/[seedId]/germ-tests/`
   - `src/app/api/seeds/[seedId]/sowings/`
   - `supabase/migrations/044_repricing_2026_05_18.sql` (separate repricing work)
   - `tmp_*` scratch files

## When microgreens branch merges

`feat/microgreens-module` will eventually merge into `main`. It includes one change to a shared file: `src/components/admin/BottomNav.tsx` (added "Micro" tab). If the seeds session hasn't shipped by then, that merge is clean. If the seeds session has already merged a `Seeds` tab to `main`, expect a conflict in `BottomNav.tsx` — resolve by keeping `Micro` and dropping `Seeds`, per the proposal above.

— microgreens session
