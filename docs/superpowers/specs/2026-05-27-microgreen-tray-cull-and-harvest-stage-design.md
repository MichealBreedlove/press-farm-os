# Microgreen Tray Cull + Harvest Stage — Design

**Date:** 2026-05-27
**Author:** Claude / Micheal
**Status:** Draft for implementation

## Problem

Two unrelated but co-shipped microgreen module gaps surfaced in production:

1. **No way to cull failed trays.** When trays die (damping off, mold, pest, failed germination) Micheal has no admin action to remove them from the active list. The API supports `lost` status with a `lost_reason`, but no UI exposes it. Result: dead trays clutter the "active" counts on `/admin/microgreens/trays`.
2. **Harvest timings are wrong for the kitchen's preference.** The seeded `microgreen_crops.ideal_harvest_day` values are tuned for cotyledon-stage harvest (typical 8–12 days for brassicas). Press Farm actually harvests at the **baby green** stage — visually larger, more true leaves — which is roughly +5 days for most leaf crops. The Dashboard "harvest today" tasks therefore fire too early.

This design ships both fixes in one change because the underlying module is small and the migrations and UI touches overlap.

## Goals

- Admin can mark one or more trays as **lost** with a reason from a quick chooser, from either the tray detail page or a multi-select on the trays list.
- Admin can **hard-delete** a tray (and the implicit empty batch row stays — batch deletion is out of scope) when the tray was sown by mistake. Disallowed if harvests are logged against it.
- Existing API endpoint `POST /api/microgreens/trays/[id]/terminate` is reused for the single-tray lost flow.
- Each `microgreen_crops` row has a new `harvest_stage` enum (`cotyledon | true_leaf | baby_green`) defaulting to `baby_green`.
- Existing active crops have their `ideal_harvest_day` bumped by a one-shot migration so the dashboard fires "harvest today" at a date closer to baby-green readiness, with a small exception list for shoot/grain crops.
- Crop edit UI exposes the stage selector; tray detail page surfaces the stage label.

## Non-goals

- **No dynamic recompute** of `ideal_harvest_day` from `harvest_stage`. The day field stays the source of truth; the stage is metadata that names the target.
- **No batch-level bulk cull** in this design. Multi-select on the trays list covers it.
- **No mortality reporting / dashboards.** The `lost_reason` data is captured; surfacing it in reports is a future ask.
- **No restore from lost / un-delete.** Lost trays stay lost; hard-deleted trays are gone.
- **No change to harvest event recording** — `microgreen_harvests` keeps its current shape.
- **No change to chef-facing UI.** This is admin-only.

## Architecture

```
┌─────────────────────────────┐         ┌──────────────────────────────────┐
│ /admin/microgreens/trays    │         │ /admin/microgreens/trays/[id]    │
│ (list)                      │         │ (detail)                         │
│                             │         │                                  │
│ + Select toggle             │         │ + [Mark as lost…] modal          │
│ + checkbox per active tray  │         │ + [Delete tray] confirm          │
│ + sticky bottom bar:        │         │   (disabled when harvests > 0)   │
│   "Mark N as lost…"         │         │                                  │
└────────────┬────────────────┘         └────────────┬─────────────────────┘
             │                                       │
             ▼                                       ▼
   POST /api/microgreens/                 POST /api/microgreens/trays/[id]/terminate
   trays/bulk-lost                        DELETE /api/microgreens/trays/[id]
   { tray_ids, lost_reason }
             │                                       │
             └────────────┬──────────────────────────┘
                          ▼
                  microgreen_trays
                  (status = 'lost' or DELETE)

┌─────────────────────────────────────────────────────────────────────────┐
│ Migration 047_microgreen_harvest_stage.sql                              │
│                                                                          │
│ + CREATE TYPE microgreen_harvest_stage AS ENUM (…)                       │
│ + ALTER TABLE microgreen_crops ADD harvest_stage … DEFAULT 'baby_green'  │
│ + UPDATE microgreen_crops SET ideal_harvest_day = ideal_harvest_day + 5  │
│   WHERE is_active AND name NOT IN (<shoot/grain exceptions>)             │
│ + Same +3 / +7 bumps to harvest_min_days / harvest_max_days              │
└─────────────────────────────────────────────────────────────────────────┘
```

## Detailed design

### 1. Database changes (Migration 047)

File: `supabase/migrations/047_microgreen_harvest_stage.sql`

```sql
-- 1a. New enum
CREATE TYPE microgreen_harvest_stage AS ENUM ('cotyledon', 'true_leaf', 'baby_green');

-- 1b. Column on microgreen_crops
ALTER TABLE microgreen_crops
  ADD COLUMN harvest_stage microgreen_harvest_stage NOT NULL DEFAULT 'baby_green';

-- 1c. One-time bump of timings on active leaf crops.
-- Shoot/grain crops have stage-irrelevant timing; skip them.
UPDATE microgreen_crops
SET
  ideal_harvest_day = ideal_harvest_day + 5,
  harvest_min_days  = CASE WHEN harvest_min_days IS NOT NULL THEN harvest_min_days + 3 ELSE NULL END,
  harvest_max_days  = CASE WHEN harvest_max_days IS NOT NULL THEN harvest_max_days + 7 ELSE NULL END
WHERE is_active = true
  AND name NOT IN (
    'Pea Shoot', 'Sunflower', 'Wheatgrass', 'Popcorn', 'Corn', 'Nasturtium'
  );

-- 1d. Sanity guard: ideal_harvest_day must still be <= harvest_max_days when both present.
-- (No code change — this is a runtime check; if any rows are now violated, we'll catch and fix manually.)
```

No RLS, trigger, or index changes — `harvest_stage` is a small metadata column. The existing `blackout_within_harvest` check (`blackout_days <= ideal_harvest_day`) continues to hold because we only added days, never subtracted.

### 2. API changes

#### `DELETE /api/microgreens/trays/[id]` — new method on existing route

In `src/app/api/microgreens/trays/[id]/route.ts`:

```ts
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();

  // Refuse if the tray has any harvest events.
  const { count, error: countErr } = await (admin as any)
    .from("microgreen_harvests")
    .select("id", { count: "exact", head: true })
    .eq("tray_id", params.id);
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Tray has harvest events. Mark as lost or terminated instead." },
      { status: 409 },
    );
  }

  const { error } = await (admin as any)
    .from("microgreen_trays").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

#### `POST /api/microgreens/trays/bulk-lost` — new route

File: `src/app/api/microgreens/trays/bulk-lost/route.ts`

```ts
export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tray_ids, lost_reason } = await req.json();
  if (!Array.isArray(tray_ids) || tray_ids.length === 0) {
    return NextResponse.json({ error: "tray_ids must be a non-empty array" }, { status: 400 });
  }
  if (!lost_reason || typeof lost_reason !== "string") {
    return NextResponse.json({ error: "lost_reason required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("microgreen_trays")
    .update({
      status: "lost",
      lost_reason,
      terminated_at: new Date().toISOString(),
    })
    .in("id", tray_ids)
    .in("status", ["soaking", "blackout", "light", "harvesting"]) // skip already-terminal
    .select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: data?.length ?? 0 });
}
```

The `.in("status", [...active])` guard prevents accidentally overwriting already-terminated rows if a stale list is submitted.

#### Existing endpoints — no signature change

- `POST /api/microgreens/trays/[id]/terminate` already handles single-tray `lost`. Reused unchanged.
- `PATCH /api/microgreens/trays/[id]` continues to allow only `location` / `notes` edits.

### 3. UI: tray detail page

File: `src/app/admin/microgreens/trays/[id]/page.tsx`

- Convert from pure server component to server-component-with-client-island. The client island holds the action footer with the two buttons and the modal state.
- New file: `src/components/admin/microgreens/TrayActionsFooter.tsx` (client component).
  - Props: `{ trayId, trayLabel, status, hasHarvests }`.
  - Renders nothing if status is already `terminated` or `lost` *except* still allows `Delete tray` when `!hasHarvests`.
  - "Mark as lost…" opens `LostReasonModal` from `src/components/admin/microgreens/LostReasonModal.tsx` (new shared component — used by both the tray detail page and the trays list multi-select).
  - LostReasonModal: native-feeling sheet with a chip selector for common reasons (Damping off disease · Mold · Failed germination · Pest damage · Other), an optional free-text input that pre-fills when a chip is tapped, and a `Confirm` button that calls `POST /api/microgreens/trays/[id]/terminate` with `{ lost: true, lost_reason }`. On success: `router.refresh()`.
  - "Delete tray" calls `window.confirm("Delete tray {label}? This is permanent.")`. On confirm: `DELETE /api/microgreens/trays/[id]`. On 409 (has harvests), show a brief error toast: "Tray has harvest events — mark as lost instead." On success: `router.push("/admin/microgreens/trays")`.

Subtitle change in the server component:

```tsx
subtitle={
  crop
    ? `${crop.name}${crop.variety ? ` — ${crop.variety}` : ""} · harvest at ${stageLabel(crop.harvest_stage)}`
    : undefined
}
```

Helper `stageLabel()` lives in `src/lib/microgreens/constants.ts`:

```ts
export const HARVEST_STAGE_LABELS: Record<MicrogreenHarvestStage, string> = {
  cotyledon: "Cotyledon",
  true_leaf: "True Leaf",
  baby_green: "Baby Green",
};
```

### 4. UI: trays list with multi-select

File: `src/app/admin/microgreens/trays/page.tsx`

- Keep the server component as-is (data fetch + render).
- Wrap the `<ul>` of tray rows in a new client component `TrayListClient` that owns:
  - `selectMode: boolean` toggled by a "Select" button next to the filter chips.
  - `selectedIds: Set<string>` for tracked checkboxes.
  - When `selectMode` is on, each row renders a leading checkbox; the surrounding `Link` becomes a `<button>` that toggles selection. Terminal-state trays render a disabled checkbox.
  - Sticky bottom bar (when `selectedIds.size > 0`): "Mark N trays as lost…" button + "Cancel" button. Reuses `LostReasonModal` from `src/components/admin/microgreens/LostReasonModal.tsx`.
  - On confirm, calls `POST /api/microgreens/trays/bulk-lost` with `{ tray_ids: [...selectedIds], lost_reason }`, then exits select mode and `router.refresh()`.
- Sticky bar styling: `fixed bottom-16 left-0 right-0` (clears the global bottom nav at `bottom-0 h-16`).

### 5. UI: crop edit + new-crop forms

File: `src/components/admin/microgreens/CropForm.tsx`

- Add a `<label>Harvest stage</label>` `<select>` between the "Ideal harvest day" and "Expected yield (oz/tray)" fields.
- Options drawn from `HARVEST_STAGE_LABELS`.
- Default for a new crop: `baby_green`.
- Helper text below the select: *"Determines the label shown on tray timelines. Set 'Ideal harvest day' above to the actual day count."*

API: `PATCH /api/microgreens/crops/[id]` and `POST /api/microgreens/crops` already pass through unknown fields via spread; verify both accept `harvest_stage` in their accepted-fields list — add to the list if they whitelist.

### 6. UI: crop list — stage chip

File: `src/app/admin/microgreens/crops/page.tsx`

- Add a small chip next to each crop name showing the harvest stage. Use existing `farm-*` palette:
  - `cotyledon` → `bg-farm-muted/10 text-farm-muted`
  - `true_leaf` → `bg-farm-green/10 text-farm-green`
  - `baby_green` → `bg-farm-green/20 text-farm-green font-medium`

### 7. UI: stage timeline label

File: `src/components/admin/microgreens/StageTimeline.tsx`

- Accept an optional `harvest_stage` from the `crop` prop (already passed). Change the final "Harvest" pill's label to:
  - `"Harvest (Baby Green)"` / `"Harvest (Cotyledon)"` / `"Harvest (True Leaf)"`.
- Keep behaviour identical otherwise.

### 8. Types

File: `src/types/database.ts`

```ts
export type MicrogreenHarvestStage = "cotyledon" | "true_leaf" | "baby_green";

export type MicrogreenCrop = {
  // …existing fields…
  harvest_stage: MicrogreenHarvestStage;
};
```

### 9. Seed data update

File: `src/lib/microgreens/seedData.ts`

- Add `harvest_stage: 'baby_green'` to every entry by default.
- Override to `'cotyledon'` for `Pea Shoot`, `Sunflower`, `Wheatgrass`, `Popcorn`, `Corn`, `Nasturtium` to mirror the migration exception list. (These are shoot/grain crops where "baby green" is semantically nonsense.)

No day-number changes in the seed file — those numbers remain the cotyledon-reference baseline for future re-seeding scenarios. The runtime DB diverges by design after migration 047 runs.

## Edge cases

- **Bulk-lost on already-lost trays.** Server filters via `.in("status", [active...])`. Returned `updated` count reflects what actually changed. The UI shows "Marked N trays as lost" using the server's count, not the client's selection size.
- **Delete on a tray with harvests.** API returns 409, UI shows a toast pointing user to "Mark as lost" instead.
- **Concurrent admin edits.** Last-write-wins. We don't optimistic-lock — the cull and edit volume is low.
- **Migration applied while trays are in flight.** Tray `sow_date`-based timing math (`isReadyToHarvest`, `nextTransitionLabel`) reads `crop.ideal_harvest_day` at query time, so all in-flight trays immediately shift their "harvest today" date forward by 5 days. This is the desired effect.
- **Crop with `keep_in_blackout = true`** (Popcorn, Corn): their `harvest_stage` is `cotyledon` and `ideal_harvest_day` is unchanged. No regression in the keep-in-blackout flow.
- **`blackout_within_harvest` check constraint.** Migration only adds days, never subtracts, and never modifies `blackout_days`, so the constraint always remains satisfied.
- **Crops not in the exception list but with weird timing.** If any active crop has unusual day numbers (e.g., a 30-day Sorrel), the +5 bump still applies. Micheal fine-tunes after via the crop edit page.

## Testing

- **Unit tests** in `src/lib/microgreens/__tests__/`:
  - Existing tests in `stages.test.ts` still pass after the column addition (no logic change).
  - Add `TrayActionsFooter` interaction tests only if there are precedents for client-component tests in the repo; otherwise skip and rely on manual verification.
- **Manual verification** (Micheal, on `localhost:3000` before push):
  - Mark a single tray as lost from detail page → appears in `Lost` filter, disappears from active counts.
  - Multi-select 3 trays on the list, mark all as lost with reason "Damping off disease" → server returns `{ updated: 3 }`, list re-renders.
  - Delete an empty-harvest tray → row gone from list, navigates back.
  - Try to delete a tray with logged harvests → 409 toast, row still present.
  - Open crop edit page, change stage to `True Leaf`, save → list chip updates, tray detail subtitle updates.
  - Check that `/admin/microgreens` dashboard "Harvest today" tasks shift to dates +5 days later for active leaf crops.

## Rollout

- Single PR-ish bundle (Micheal pushes directly to `main`).
- Order: migration first (Micheal runs SQL in Supabase web editor), confirm column exists, then push code.
- If the code lands before migration: the crop list / edit / detail pages will throw on `harvest_stage` selects until migration runs. **Ship migration → confirm → push code.**

## Open follow-ups

- Mortality reporting page (`/admin/reports/microgreens-mortality`) — count `lost_reason` per crop per quarter. Not in scope here.
- Per-crop, per-stage timing presets (e.g., "switch crop to True Leaf and auto-set ideal_harvest_day to its true-leaf default"). Requires a lookup table; not in scope.
- Restore-from-lost flow. Not asked for.
