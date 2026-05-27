# Microgreen Tray Cull + Harvest Stage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two co-dependent fixes to the microgreens admin module — (1) a tray cull workflow (mark-as-lost + hard-delete, single and bulk) and (2) a per-crop `harvest_stage` enum (`cotyledon | true_leaf | baby_green`) with a one-time DB bump so timings match Press Farm's baby-green harvest preference.

**Architecture:** Two phases. **Phase A** (tray cull) ships first — no schema dependency, only new API routes (`DELETE /api/microgreens/trays/[id]` and `POST /api/microgreens/trays/bulk-lost`) and new client components (`LostReasonModal`, `TrayActionsFooter`, `TrayListClient`). **Phase B** (harvest stage) requires migration 060, type changes, seed-data update, and small UI additions to the crop form, crop list, tray detail subtitle, and `StageTimeline` harvest pill.

**Tech Stack:** Next.js 14 App Router · TypeScript · Supabase (PostgreSQL 15, service-role admin client) · Tailwind (`farm-*` palette) · Vitest for API/route tests · React Email unaffected.

**Spec:** [`docs/superpowers/specs/2026-05-27-microgreen-tray-cull-and-harvest-stage-design.md`](../specs/2026-05-27-microgreen-tray-cull-and-harvest-stage-design.md)

---

## File Map

### Phase A — Tray cull (no migration)

**Create:**
- `src/app/api/microgreens/trays/bulk-lost/route.ts` — POST handler accepting `{ tray_ids, lost_reason }`.
- `src/components/admin/microgreens/LostReasonModal.tsx` — shared client modal with reason chips + free-text input.
- `src/components/admin/microgreens/TrayActionsFooter.tsx` — client island for the tray detail page; renders "Mark as lost…" + "Delete tray" buttons.
- `src/components/admin/microgreens/TrayListClient.tsx` — client island for the trays list; owns multi-select mode + sticky action bar.
- `tests/api/microgreens/trays-delete.test.ts` — vitest cases for DELETE /trays/[id].
- `tests/api/microgreens/trays-bulk-lost.test.ts` — vitest cases for POST /trays/bulk-lost.

**Modify:**
- `src/app/api/microgreens/trays/[id]/route.ts` — add `DELETE` handler (PATCH/GET stay as-is).
- `src/app/admin/microgreens/trays/[id]/page.tsx` — mount `TrayActionsFooter` + fetch `harvest_count`.
- `src/app/admin/microgreens/trays/page.tsx` — wrap the `<ul>` in `TrayListClient`.

### Phase B — Harvest stage (needs migration 060)

**Create:**
- `supabase/migrations/060_microgreen_harvest_stage.sql` — adds enum, column, and one-time UPDATE on active crops.

**Modify:**
- `src/types/database.ts` — add `MicrogreenHarvestStage` type and `harvest_stage` field on `MicrogreenCrop`.
- `src/lib/microgreens/constants.ts` — add `HARVEST_STAGE_LABELS` map.
- `src/lib/microgreens/seedData.ts` — add `harvest_stage` to `SeedCrop` type + every row.
- `src/components/admin/microgreens/CropForm.tsx` — stage selector between "Ideal harvest day" and "Yield" sections.
- `src/app/admin/microgreens/crops/page.tsx` — stage chip on each crop row.
- `src/app/admin/microgreens/trays/[id]/page.tsx` — subtitle includes "harvest at {stage label}".
- `src/components/admin/microgreens/StageTimeline.tsx` — harvest pill label becomes "Harvest ({Stage})".

---

# Phase A — Tray cull

## Task 1: DELETE /api/microgreens/trays/[id] — tests first

**Files:**
- Test: `tests/api/microgreens/trays-delete.test.ts`

- [ ] **Step 1: Write the failing test file**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseMock } from "../../helpers/supabase-mock";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { createAdminClient } = await import("@/lib/supabase/admin");
const { createClient } = await import("@/lib/supabase/server");
const { DELETE } = await import("@/app/api/microgreens/trays/[id]/route");

describe("DELETE /api/microgreens/trays/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes a tray with no harvests", async () => {
    const sb = makeSupabaseMock({
      microgreen_trays: [{ id: "t1", status: "blackout" }],
      microgreen_harvests: [],
    });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/trays/t1", { method: "DELETE" });
    const res = await DELETE(req, { params: { id: "t1" } });

    expect(res.status).toBe(200);
    expect(sb._data.microgreen_trays).toHaveLength(0);
  });

  it("refuses delete when tray has harvest events", async () => {
    const sb = makeSupabaseMock({
      microgreen_trays: [{ id: "t1", status: "harvesting" }],
      microgreen_harvests: [{ id: "h1", tray_id: "t1", yield_oz: 5 }],
    });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/trays/t1", { method: "DELETE" });
    const res = await DELETE(req, { params: { id: "t1" } });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/harvest events/i);
    expect(sb._data.microgreen_trays).toHaveLength(1);
  });

  it("returns 401 when not authenticated", async () => {
    const sb = makeSupabaseMock({});
    sb.auth.getUser = vi.fn(async () => ({ data: { user: null }, error: null })) as any;
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/trays/t1", { method: "DELETE" });
    const res = await DELETE(req, { params: { id: "t1" } });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/api/microgreens/trays-delete.test.ts`
Expected: FAIL — `DELETE` is not exported from `route.ts`.

## Task 2: Implement DELETE handler

**Files:**
- Modify: `src/app/api/microgreens/trays/[id]/route.ts`

- [ ] **Step 1: Add DELETE export at the end of the file**

Append after the existing PATCH handler:

```ts
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // Refuse if any harvest events exist for this tray.
  const { data: harvests, error: countErr } = await (admin as any)
    .from("microgreen_harvests")
    .select("id")
    .eq("tray_id", params.id)
    .limit(1);
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });
  if ((harvests ?? []).length > 0) {
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

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test -- tests/api/microgreens/trays-delete.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 3: Commit**

```bash
git add tests/api/microgreens/trays-delete.test.ts src/app/api/microgreens/trays/[id]/route.ts
git commit -m "$(cat <<'EOF'
feat(microgreens): DELETE /api/microgreens/trays/[id]

Hard-deletes a tray when no harvest events exist. Returns 409
otherwise so the UI can suggest "Mark as lost" instead.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Task 3: POST /api/microgreens/trays/bulk-lost — tests first

**Files:**
- Test: `tests/api/microgreens/trays-bulk-lost.test.ts`

- [ ] **Step 1: Write the failing test file**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseMock } from "../../helpers/supabase-mock";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { createAdminClient } = await import("@/lib/supabase/admin");
const { createClient } = await import("@/lib/supabase/server");
const { POST } = await import("@/app/api/microgreens/trays/bulk-lost/route");

describe("POST /api/microgreens/trays/bulk-lost", () => {
  beforeEach(() => vi.clearAllMocks());

  it("marks every listed active tray as lost with the reason", async () => {
    const sb = makeSupabaseMock({
      microgreen_trays: [
        { id: "t1", status: "blackout", lost_reason: null },
        { id: "t2", status: "light", lost_reason: null },
        { id: "t3", status: "harvesting", lost_reason: null },
      ],
    });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/trays/bulk-lost", {
      method: "POST",
      body: JSON.stringify({ tray_ids: ["t1", "t2", "t3"], lost_reason: "Damping off disease" }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.updated).toBe(3);
    expect(sb._data.microgreen_trays.every((t: any) => t.status === "lost")).toBe(true);
    expect(sb._data.microgreen_trays.every((t: any) => t.lost_reason === "Damping off disease")).toBe(true);
  });

  it("skips trays already in a terminal state", async () => {
    const sb = makeSupabaseMock({
      microgreen_trays: [
        { id: "t1", status: "blackout", lost_reason: null },
        { id: "t2", status: "terminated", lost_reason: null },
        { id: "t3", status: "lost", lost_reason: "Mold" },
      ],
    });
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/trays/bulk-lost", {
      method: "POST",
      body: JSON.stringify({ tray_ids: ["t1", "t2", "t3"], lost_reason: "Damping off" }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(body.updated).toBe(1);
    expect(sb._data.microgreen_trays.find((t: any) => t.id === "t2").status).toBe("terminated");
    expect(sb._data.microgreen_trays.find((t: any) => t.id === "t3").lost_reason).toBe("Mold");
  });

  it("returns 400 when tray_ids is empty", async () => {
    const sb = makeSupabaseMock({});
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/trays/bulk-lost", {
      method: "POST",
      body: JSON.stringify({ tray_ids: [], lost_reason: "X" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when lost_reason is missing", async () => {
    const sb = makeSupabaseMock({});
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/trays/bulk-lost", {
      method: "POST",
      body: JSON.stringify({ tray_ids: ["t1"] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 401 when not authenticated", async () => {
    const sb = makeSupabaseMock({});
    sb.auth.getUser = vi.fn(async () => ({ data: { user: null }, error: null })) as any;
    (createAdminClient as any).mockReturnValue(sb);
    (createClient as any).mockResolvedValue(sb);

    const req = new Request("http://test/api/microgreens/trays/bulk-lost", {
      method: "POST",
      body: JSON.stringify({ tray_ids: ["t1"], lost_reason: "x" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/api/microgreens/trays-bulk-lost.test.ts`
Expected: FAIL — route doesn't exist yet.

## Task 4: Implement bulk-lost handler

**Files:**
- Create: `src/app/api/microgreens/trays/bulk-lost/route.ts`

- [ ] **Step 1: Create the route file**

```ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { tray_ids, lost_reason } = body;

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
    .in("status", ["soaking", "blackout", "light", "harvesting"])
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: data?.length ?? 0 });
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm test -- tests/api/microgreens/trays-bulk-lost.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 3: Commit**

```bash
git add tests/api/microgreens/trays-bulk-lost.test.ts src/app/api/microgreens/trays/bulk-lost/route.ts
git commit -m "$(cat <<'EOF'
feat(microgreens): POST /api/microgreens/trays/bulk-lost

Marks a list of active trays as 'lost' in one call with a shared
lost_reason. Already-terminal trays are skipped via in-status filter,
so a stale list never overwrites an existing lost_reason or terminated_at.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Task 5: LostReasonModal component

**Files:**
- Create: `src/components/admin/microgreens/LostReasonModal.tsx`

- [ ] **Step 1: Create the modal component**

```tsx
"use client";
import { useState } from "react";

const REASON_CHIPS = [
  "Damping off disease",
  "Mold",
  "Failed germination",
  "Pest damage",
  "Tray contaminated",
];

type Props = {
  open: boolean;
  trayCount: number;          // 1 for single, N for bulk
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
};

export function LostReasonModal({ open, trayCount, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleConfirm() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Pick a reason or type one.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(trimmed);
      setReason("");
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Could not mark as lost.");
    } finally {
      setSubmitting(false);
    }
  }

  const title = trayCount === 1 ? "Mark tray as lost" : `Mark ${trayCount} trays as lost`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-farm-muted text-sm px-2 py-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-farm-muted">Common reasons</p>
          <div className="flex flex-wrap gap-1.5">
            {REASON_CHIPS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setReason(c)}
                className={
                  reason === c
                    ? "px-2.5 py-1 rounded-full bg-farm-dark text-white text-xs"
                    : "px-2.5 py-1 rounded-full border border-farm-dark/15 text-farm-muted hover:border-farm-dark/30 text-xs"
                }
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="block text-xs text-farm-muted mb-1">Reason</span>
          <input
            type="text"
            className="input w-full"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Damping off disease"
          />
        </label>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-farm-muted"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="px-4 py-2 text-sm rounded-lg bg-red-700 text-white font-medium disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Mark as lost"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Quick sanity check that it compiles**

Run: `npx tsc --noEmit`
Expected: no errors related to the new file.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/microgreens/LostReasonModal.tsx
git commit -m "$(cat <<'EOF'
feat(microgreens): LostReasonModal shared component

Bottom sheet on mobile, centered card on desktop. Reason chips
prefill the free-text input; Confirm disables while submitting and
surfaces server errors inline. Used by both single-tray and
bulk-select cull flows.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Task 6: TrayActionsFooter component

**Files:**
- Create: `src/components/admin/microgreens/TrayActionsFooter.tsx`

- [ ] **Step 1: Create the footer component**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LostReasonModal } from "./LostReasonModal";
import type { MicrogreenTrayStatus } from "@/types/database";

type Props = {
  trayId: string;
  trayLabel: string;
  status: MicrogreenTrayStatus;
  hasHarvests: boolean;
};

const ACTIVE: MicrogreenTrayStatus[] = ["soaking", "blackout", "light", "harvesting"];

export function TrayActionsFooter({ trayId, trayLabel, status, hasHarvests }: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canMarkLost = ACTIVE.includes(status);
  const canDelete = !hasHarvests;

  if (!canMarkLost && !canDelete) return null;

  async function markLost(reason: string) {
    const res = await fetch(`/api/microgreens/trays/${trayId}/terminate`, {
      method: "POST",
      body: JSON.stringify({ lost: true, lost_reason: reason }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Could not mark as lost.");
    }
    router.refresh();
  }

  async function handleDelete() {
    if (!window.confirm(`Delete tray ${trayLabel}? This is permanent.`)) return;
    setDeleteError(null);
    const res = await fetch(`/api/microgreens/trays/${trayId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin/microgreens/trays");
      return;
    }
    const body = await res.json().catch(() => ({}));
    setDeleteError(body.error ?? "Could not delete tray.");
  }

  return (
    <>
      <div className="border-t border-farm-dark/10 pt-4 mt-6 flex flex-wrap gap-2">
        {canMarkLost && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 text-sm rounded-lg border border-red-700 text-red-700 font-medium hover:bg-red-50"
          >
            Mark as lost…
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            className="px-4 py-2 text-sm rounded-lg bg-red-700 text-white font-medium hover:bg-red-800"
          >
            Delete tray
          </button>
        )}
      </div>
      {deleteError && (
        <p className="text-sm text-red-700 mt-2">{deleteError}</p>
      )}
      <LostReasonModal
        open={modalOpen}
        trayCount={1}
        onClose={() => setModalOpen(false)}
        onConfirm={markLost}
      />
    </>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/microgreens/TrayActionsFooter.tsx
git commit -m "$(cat <<'EOF'
feat(microgreens): TrayActionsFooter for tray detail page

Renders 'Mark as lost…' (when tray is active) and 'Delete tray'
(when no harvests logged) below the existing tray detail body.
Delete uses native confirm + surfaces 409 errors inline pointing
the admin to mark as lost instead.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Task 7: Wire TrayActionsFooter into tray detail page

**Files:**
- Modify: `src/app/admin/microgreens/trays/[id]/page.tsx`

- [ ] **Step 1: Add harvest_count fetch and footer mount**

Replace the existing file's body. The full file becomes:

```tsx
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { StageBadge } from "@/components/admin/microgreens/StageBadge";
import { StageTimeline } from "@/components/admin/microgreens/StageTimeline";
import { TrayActionsFooter } from "@/components/admin/microgreens/TrayActionsFooter";
import { harvestUnitLabel } from "@/lib/microgreens/types";

function fmtQty(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

export const dynamic = "force-dynamic";

export default async function TrayDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  const { data: tray } = await (admin as any)
    .from("microgreen_trays")
    .select("*, batch:microgreen_batches(*, crop:microgreen_crops(*))")
    .eq("id", id).maybeSingle();
  if (!tray) notFound();

  const { data: harvests } = await (admin as any)
    .from("microgreen_harvests")
    .select("*, delivery:deliveries(delivery_date, restaurant:restaurants(name))")
    .eq("tray_id", id)
    .order("harvested_at", { ascending: false });

  const crop = tray.batch?.crop;
  const totalsByUnit: Record<string, number> = {};
  for (const h of harvests ?? []) {
    const label = harvestUnitLabel(h.unit);
    totalsByUnit[label] = (totalsByUnit[label] ?? 0) + Number(h.yield_oz);
  }
  const totalsLabel = Object.entries(totalsByUnit)
    .map(([u, q]) => `${fmtQty(q)} ${u}`)
    .join(" · ");

  return (
    <main className="pb-24">
      <EditorialHero
        eyebrow="Microgreens / Trays"
        title={tray.tray_label}
        subtitle={crop ? `${crop.name}${crop.variety ? ` — ${crop.variety}` : ""}` : undefined}
        backHref="/admin/microgreens/trays"
      />
      <div className="px-4 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <StageBadge status={tray.status} />
          <span className="text-sm text-farm-muted">sown {tray.sow_date}</span>
        </div>

        {crop && <StageTimeline current={tray.status} crop={crop} />}

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-2">
            Harvest history{totalsLabel ? ` (${totalsLabel} total)` : ""}
          </h2>
          {(harvests ?? []).length === 0 ? (
            <p className="text-sm text-farm-muted">No harvests logged yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {(harvests ?? []).map((h: any) => (
                <li key={h.id} className="p-2 bg-white rounded border border-farm-muted/15 flex justify-between">
                  <span>{new Date(h.harvested_at).toLocaleString()}</span>
                  <span className="font-medium">{h.yield_oz} {harvestUnitLabel(h.unit)}</span>
                  <span className="text-xs text-farm-muted">
                    {h.delivery?.delivery_date ?? "unassigned"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {tray.lost_reason && (
          <p className="text-sm text-red-700">Lost: {tray.lost_reason}</p>
        )}

        <TrayActionsFooter
          trayId={tray.id}
          trayLabel={tray.tray_label}
          status={tray.status}
          hasHarvests={(harvests ?? []).length > 0}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Build to verify nothing regressed**

Run: `npm run build`
Expected: build passes.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/microgreens/trays/[id]/page.tsx
git commit -m "$(cat <<'EOF'
feat(microgreens): mount TrayActionsFooter on tray detail

Tray detail page now exposes 'Mark as lost…' and 'Delete tray'
actions. hasHarvests is computed from the existing harvests query
so no extra round-trip.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Task 8: TrayListClient with multi-select

**Files:**
- Create: `src/components/admin/microgreens/TrayListClient.tsx`

- [ ] **Step 1: Create the client component**

```tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StageBadge } from "./StageBadge";
import { LostReasonModal } from "./LostReasonModal";
import type { MicrogreenTrayStatus } from "@/types/database";

const ACTIVE: MicrogreenTrayStatus[] = ["soaking", "blackout", "light", "harvesting"];

export type TrayRow = {
  id: string;
  tray_label: string;
  status: MicrogreenTrayStatus;
  sow_date: string;
  cropName: string;
  daysIn: number;
  nextTransition: string | null;
};

export function TrayListClient({ trays }: { trays: TrayRow[] }) {
  const router = useRouter();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function cancelSelect() {
    setSelectMode(false);
    setSelected(new Set());
  }

  async function bulkLost(reason: string) {
    const res = await fetch("/api/microgreens/trays/bulk-lost", {
      method: "POST",
      body: JSON.stringify({ tray_ids: [...selected], lost_reason: reason }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Could not mark trays as lost.");
    }
    cancelSelect();
    router.refresh();
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        {selectMode ? (
          <button
            type="button"
            onClick={cancelSelect}
            className="text-sm px-3 py-1.5 rounded-lg border border-farm-dark/15 text-farm-muted"
          >
            Cancel select
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setSelectMode(true)}
            className="text-sm px-3 py-1.5 rounded-lg border border-farm-dark/15 text-farm-dark"
          >
            Select
          </button>
        )}
      </div>

      <ul className="space-y-2">
        {trays.map((t) => {
          const isActive = ACTIVE.includes(t.status);
          const checked = selected.has(t.id);

          if (selectMode) {
            return (
              <li key={t.id}>
                <button
                  type="button"
                  disabled={!isActive}
                  onClick={() => isActive && toggle(t.id)}
                  className={
                    "w-full bg-white border rounded-xl px-4 py-3 flex items-center gap-3 text-left " +
                    (isActive
                      ? "border-farm-dark/10 hover:border-farm-dark/25"
                      : "border-farm-dark/5 opacity-50 cursor-not-allowed")
                  }
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => isActive && toggle(t.id)}
                    disabled={!isActive}
                    className="w-5 h-5 accent-farm-green"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-xs text-farm-muted">{t.tray_label}</span>
                      <span className="text-sm font-medium text-farm-dark truncate">{t.cropName}</span>
                    </div>
                    <p className="text-[11px] text-farm-muted mt-0.5">
                      Sown {t.sow_date} · day {t.daysIn}{t.nextTransition ? ` · ${t.nextTransition}` : ""}
                    </p>
                  </div>
                  <StageBadge status={t.status} />
                </button>
              </li>
            );
          }

          return (
            <li key={t.id}>
              <Link
                href={`/admin/microgreens/trays/${t.id}`}
                className="bg-white border border-farm-dark/10 rounded-xl px-4 py-3 hover:border-farm-dark/25 transition-colors flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-xs text-farm-muted">{t.tray_label}</span>
                    <span className="text-sm font-medium text-farm-dark truncate">{t.cropName}</span>
                  </div>
                  <p className="text-[11px] text-farm-muted mt-0.5">
                    Sown {t.sow_date} · day {t.daysIn}{t.nextTransition ? ` · ${t.nextTransition}` : ""}
                  </p>
                </div>
                <StageBadge status={t.status} />
              </Link>
            </li>
          );
        })}
      </ul>

      {selectMode && selected.size > 0 && (
        <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-3">
          <div className="max-w-4xl mx-auto bg-white border border-farm-dark/15 rounded-xl shadow-lg p-3 flex items-center justify-between gap-3">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={cancelSelect}
                className="px-3 py-1.5 text-sm text-farm-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="px-3 py-1.5 text-sm rounded-lg bg-red-700 text-white font-medium"
              >
                Mark as lost…
              </button>
            </div>
          </div>
        </div>
      )}

      <LostReasonModal
        open={modalOpen}
        trayCount={selected.size}
        onClose={() => setModalOpen(false)}
        onConfirm={bulkLost}
      />
    </>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/microgreens/TrayListClient.tsx
git commit -m "$(cat <<'EOF'
feat(microgreens): TrayListClient with multi-select cull

Adds a 'Select' toggle to the trays list. In select mode each
active-status row gets a checkbox; terminal-status rows are
greyed out. Sticky bottom action bar (clears the global bottom nav
at bottom-16) shows the selection count and opens LostReasonModal.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Task 9: Wire TrayListClient into trays list page

**Files:**
- Modify: `src/app/admin/microgreens/trays/page.tsx`

- [ ] **Step 1: Replace the page body**

The server component continues to fetch and sort. It now maps the rows to `TrayRow` shape and hands the array to `TrayListClient`. Filter chips stay in the server component (they're plain `<Link>`s and don't need client state). Replace the full file:

```tsx
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { TrayListClient, type TrayRow } from "@/components/admin/microgreens/TrayListClient";
import type { MicrogreenTrayStatus } from "@/types/database";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ status?: string }> };

const STATUS_ORDER: MicrogreenTrayStatus[] = [
  "soaking", "blackout", "light", "harvesting", "terminated", "lost",
];

function daysBetween(fromIso: string, to: Date): number {
  const a = new Date(fromIso + "T00:00:00Z").getTime();
  return Math.round((to.getTime() - a) / (24 * 3600 * 1000));
}

function statusOrder(s: string): number {
  const order: Record<string, number> = {
    soaking: 0, blackout: 1, light: 2, harvesting: 3, terminated: 4, lost: 5,
  };
  return order[s] ?? 99;
}

export default async function TraysListPage({ searchParams }: Props) {
  const { status: statusFilter } = await searchParams;
  const admin = createAdminClient();

  let q = (admin as any).from("microgreen_trays")
    .select(`
      *,
      batch:microgreen_batches(
        id,
        crop:microgreen_crops(name, blackout_days, ideal_harvest_day, is_continuous_harvest, productive_life_days)
      )
    `)
    .order("sow_date", { ascending: false })
    .limit(500);
  if (statusFilter) q = q.eq("status", statusFilter);
  const { data: trays, error } = await q;

  const { data: allTrays } = await (admin as any)
    .from("microgreen_trays")
    .select("status");

  const counts: Record<MicrogreenTrayStatus, number> = {
    soaking: 0, blackout: 0, light: 0, harvesting: 0, terminated: 0, lost: 0,
  };
  for (const t of allTrays ?? []) {
    counts[t.status as MicrogreenTrayStatus] = (counts[t.status as MicrogreenTrayStatus] ?? 0) + 1;
  }
  const total = (allTrays ?? []).length;

  const sortedTrays = [...(trays ?? [])].sort((a: any, b: any) => {
    const sd = statusOrder(a.status) - statusOrder(b.status);
    if (sd !== 0) return sd;
    return (b.sow_date ?? "").localeCompare(a.sow_date ?? "");
  });

  const now = new Date();

  function nextTransitionLabel(tray: any): string | null {
    const crop = tray.batch?.crop;
    if (!crop) return null;
    const sowDate = tray.sow_date;
    if (!sowDate) return null;
    const daysIn = daysBetween(sowDate, now);

    if (tray.status === "soaking") return "→ blackout once soak/presprout completes";
    if (tray.status === "blackout") {
      const remaining = (crop.blackout_days ?? 0) - daysIn;
      if (remaining > 0) return `→ light in ${remaining} d`;
      if (remaining === 0) return "→ light today";
      return `→ light overdue (${Math.abs(remaining)} d late)`;
    }
    if (tray.status === "light") {
      const remaining = (crop.ideal_harvest_day ?? 0) - daysIn;
      if (remaining > 0) return `harvest in ${remaining} d`;
      if (remaining === 0) return "harvest today";
      return `harvest overdue (${Math.abs(remaining)} d late)`;
    }
    if (tray.status === "harvesting" && crop.is_continuous_harvest) {
      const life = crop.productive_life_days ?? 0;
      const remaining = life - daysIn;
      if (remaining > 0) return `continuous · ${remaining} d productive life left`;
      if (remaining === 0) return "continuous · terminate today";
      return `continuous · ${Math.abs(remaining)} d past productive life`;
    }
    return null;
  }

  const rows: TrayRow[] = sortedTrays.map((t: any) => ({
    id: t.id,
    tray_label: t.tray_label,
    status: t.status,
    sow_date: t.sow_date,
    cropName: t.batch?.crop?.name ?? "—",
    daysIn: daysBetween(t.sow_date, now),
    nextTransition: nextTransitionLabel(t),
  }));

  return (
    <main className="pb-24">
      <EditorialHero
        eyebrow="Microgreens"
        title="Trays"
        subtitle={
          statusFilter
            ? `Filtered to ${statusFilter} — ${(trays ?? []).length} of ${total}`
            : `${total} trays total · ${counts.soaking + counts.blackout + counts.light + counts.harvesting} active`
        }
        backHref="/admin/microgreens"
      />
      <div className="px-4 max-w-4xl mx-auto">
        <div className="mb-4 flex gap-2 text-xs flex-wrap">
          <Link
            href="/admin/microgreens/trays"
            className={
              !statusFilter
                ? "px-2.5 py-1 rounded-full bg-farm-dark text-white"
                : "px-2.5 py-1 rounded-full border border-farm-dark/15 text-farm-muted hover:border-farm-dark/30"
            }
          >
            All ({total})
          </Link>
          {STATUS_ORDER.map((s) => {
            const c = counts[s];
            const active = statusFilter === s;
            return (
              <Link
                key={s}
                href={`/admin/microgreens/trays?status=${s}`}
                className={
                  active
                    ? "px-2.5 py-1 rounded-full bg-farm-dark text-white capitalize"
                    : "px-2.5 py-1 rounded-full border border-farm-dark/15 text-farm-muted hover:border-farm-dark/30 capitalize"
                }
              >
                {s} ({c})
              </Link>
            );
          })}
        </div>

        {error && (
          <p className="p-3 mb-3 rounded bg-red-50 border border-red-200 text-red-800 text-sm">
            Couldn't load trays: {(error as any).message}
          </p>
        )}

        {rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-farm-muted bg-white border border-farm-dark/10 rounded-xl">
            {statusFilter
              ? `No trays in ${statusFilter} status.`
              : "No trays sown yet. Open the dashboard and tap + Sow ad-hoc to log one."}
          </p>
        ) : (
          <TrayListClient trays={rows} />
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Run the full test suite to confirm no regressions**

Run: `npm test`
Expected: all tests green.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build passes.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/microgreens/trays/page.tsx
git commit -m "$(cat <<'EOF'
feat(microgreens): wire multi-select cull into trays list

Server component now maps tray rows into TrayRow shape and delegates
rendering to TrayListClient. Filter chips and counts stay
server-rendered.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Task 10: Phase A manual verification

Phase A can be tested end-to-end without any migration.

- [ ] **Step 1: Run the dev server**

Run: `npm run dev` (in a separate terminal)

- [ ] **Step 2: Verify single-tray Mark as lost**

1. Open `http://localhost:3000/admin/microgreens/trays` in a browser.
2. Click any active-status tray.
3. Confirm `Mark as lost…` button is visible at the bottom of the page.
4. Click it; the modal opens.
5. Click "Damping off disease" chip → text field fills.
6. Click "Mark as lost".
7. Page refreshes; tray's stage badge shows "Lost" and the lost_reason text shows below the harvest section.

- [ ] **Step 3: Verify hard delete**

1. From the dashboard, sow an ad-hoc test tray (any crop).
2. Open that tray's detail page.
3. Click `Delete tray` → confirm in the native dialog.
4. Navigates back to trays list; the row is gone.

- [ ] **Step 4: Verify delete refusal when harvests logged**

1. Open a tray that has at least one harvest event (from the dashboard's "Harvest" section, log a harvest).
2. On the tray detail page, `Delete tray` button is NOT rendered (because `hasHarvests` is true).

- [ ] **Step 5: Verify multi-select bulk lost**

1. Open `/admin/microgreens/trays`.
2. Click `Select` top-right.
3. Tap 2–3 active trays — checkboxes fill; sticky bar at the bottom shows "N selected".
4. Click `Mark as lost…`, pick reason, confirm.
5. Page refreshes; all selected trays show Lost status; counts in filter chips update.

- [ ] **Step 6: Verify terminal trays cannot be selected**

1. Re-enter `Select` mode.
2. Trays already in Lost or Done state are greyed-out with disabled checkboxes.

If any step fails, fix before moving to Phase B.

---

# Phase B — Harvest stage

## Task 11: Write migration 060

**Files:**
- Create: `supabase/migrations/060_microgreen_harvest_stage.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Migration 060: Microgreen harvest_stage enum + one-time timing bump.
--
-- Press Farm harvests microgreens at the Baby Green stage, not the
-- cotyledon stage the seed data was tuned for. This migration:
--   1. Adds a microgreen_harvest_stage enum.
--   2. Adds harvest_stage column to microgreen_crops (default 'baby_green').
--   3. Bumps active leaf crops' ideal_harvest_day / harvest_min_days /
--      harvest_max_days so the dashboard's "harvest today" tasks fire
--      closer to baby-green readiness.
--
-- Exception list: shoot/grain crops where "baby green" is semantically
-- nonsense are not bumped. They still get harvest_stage = 'baby_green'
-- via the column default (harmless label) but their day numbers stay put.

CREATE TYPE microgreen_harvest_stage AS ENUM ('cotyledon', 'true_leaf', 'baby_green');

ALTER TABLE microgreen_crops
  ADD COLUMN harvest_stage microgreen_harvest_stage NOT NULL DEFAULT 'baby_green';

UPDATE microgreen_crops
SET
  ideal_harvest_day = ideal_harvest_day + 5,
  harvest_min_days  = CASE WHEN harvest_min_days IS NOT NULL THEN harvest_min_days + 3 ELSE NULL END,
  harvest_max_days  = CASE WHEN harvest_max_days IS NOT NULL THEN harvest_max_days + 7 ELSE NULL END
WHERE is_active = true
  AND name NOT IN (
    'Pea Shoot', 'Sunflower', 'Wheatgrass', 'Popcorn', 'Corn', 'Nasturtium'
  );

-- Sanity check: blackout_within_harvest constraint (blackout_days <= ideal_harvest_day)
-- holds because we only added days; never subtracted, never modified blackout_days.
```

- [ ] **Step 2: Verify syntactic correctness (eye-check only — Micheal runs this)**

Confirm:
- Enum exists in only one place (no duplicate `CREATE TYPE`).
- Column default is `'baby_green'`, not `'cotyledon'`.
- UPDATE has `is_active = true` and the exception list.

- [ ] **Step 3: Commit (but DO NOT apply yet)**

```bash
git add supabase/migrations/060_microgreen_harvest_stage.sql
git commit -m "$(cat <<'EOF'
feat(microgreens): migration 060 — harvest_stage enum + timing bump

Adds microgreen_harvest_stage enum (cotyledon | true_leaf |
baby_green) and a harvest_stage column on microgreen_crops with a
baby_green default. One-time UPDATE bumps active leaf-crops' harvest
days by +5/+3/+7 so dashboard 'harvest today' tasks fire closer to
baby-green readiness. Shoot/grain crops (Pea Shoot, Sunflower,
Wheatgrass, Popcorn, Corn, Nasturtium) are excluded from the bump.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Task 12: Update database types

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Add `MicrogreenHarvestStage` next to `MicrogreenTrayStatus`**

Locate line 635 in `src/types/database.ts`. Just before `export interface MicrogreenCrop {`, add:

```ts
export type MicrogreenHarvestStage = "cotyledon" | "true_leaf" | "baby_green";
```

- [ ] **Step 2: Add `harvest_stage` field to `MicrogreenCrop`**

Inside `MicrogreenCrop`, add the field next to the other harvest fields. The interface should look like:

```ts
export interface MicrogreenCrop {
  id: string;
  farm_id: string;
  item_id: string | null;
  name: string;
  variety: string | null;
  seed_density_g_per_tray: number;
  presoak_hours: number;
  presprout_hours: number;
  bury_seed: boolean;
  weight_during_blackout: boolean;
  blackout_days: number;
  keep_in_blackout: boolean;
  ideal_harvest_day: number;
  harvest_min_days: number | null;
  harvest_max_days: number | null;
  harvest_stage: MicrogreenHarvestStage;
  expected_yield_oz_per_tray: number;
  yield_per_tray: Record<string, number>;
  is_continuous_harvest: boolean;
  productive_life_days: number | null;
  growing_medium: string[];
  preferred_medium: string | null;
  tray_size: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors. The existing test fixture in `tests/lib/microgreens/stages.test.ts` (`baseCrop`) does NOT set `harvest_stage` — it'll fail type-check.

- [ ] **Step 4: Patch the test fixture**

Open `tests/lib/microgreens/stages.test.ts`. In the `baseCrop` object (line 10-23), add:

```ts
harvest_stage: "baby_green",
```

just after the `harvest_max_days: 12,` line.

- [ ] **Step 5: Re-run tsc**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: all pass (the test fixture change is the only one needed; logic is unchanged).

## Task 13: Add HARVEST_STAGE_LABELS to constants

**Files:**
- Modify: `src/lib/microgreens/constants.ts`

- [ ] **Step 1: Append the labels map and import the type**

Update the imports line at the top:

```ts
import type { MicrogreenHarvestStage, MicrogreenTrayStatus } from "@/types/database";
```

Append at the end of the file:

```ts
export const HARVEST_STAGE_LABELS: Record<MicrogreenHarvestStage, string> = {
  cotyledon: "Cotyledon",
  true_leaf: "True Leaf",
  baby_green: "Baby Green",
};

export const HARVEST_STAGE_CHIP_CLASS: Record<MicrogreenHarvestStage, string> = {
  cotyledon: "bg-farm-muted/10 text-farm-muted",
  true_leaf: "bg-farm-green/10 text-farm-green",
  baby_green: "bg-farm-green/20 text-farm-green font-medium",
};
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit (along with types from Task 12)**

```bash
git add src/types/database.ts src/lib/microgreens/constants.ts tests/lib/microgreens/stages.test.ts
git commit -m "$(cat <<'EOF'
feat(microgreens): MicrogreenHarvestStage type + label maps

Adds the enum-mirrored TypeScript type, the harvest_stage field on
MicrogreenCrop, HARVEST_STAGE_LABELS (UI label per stage), and
HARVEST_STAGE_CHIP_CLASS (Tailwind classes per stage).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Task 14: Update seedData with harvest_stage

**Files:**
- Modify: `src/lib/microgreens/seedData.ts`

- [ ] **Step 1: Add the field to the `SeedCrop` type**

In `src/lib/microgreens/seedData.ts`, locate the `SeedCrop` type (around line 5). After `productive_life_days?: number;`, add:

```ts
harvest_stage: "cotyledon" | "true_leaf" | "baby_green";
```

- [ ] **Step 2: Add `harvest_stage` to every entry**

This is a mechanical edit. For each `SEED_CROPS` entry, add `harvest_stage: "baby_green",` (placed right after `productive_life_days` if present, otherwise after `is_continuous_harvest`). For the six shoot/grain exceptions, set `"cotyledon"` instead.

**Exception list** (use `"cotyledon"` for these):
- `Pea Shoot`
- `Sunflower`
- `Wheatgrass`
- `Popcorn`
- `Corn`
- `Nasturtium`

Every other entry (~60 rows) gets `"baby_green"`.

Tip: write the edit as two passes — first add `harvest_stage: "baby_green",` to every row, then do a targeted find-replace on the six exception names changing them to `"cotyledon"`.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors. If any entry is missing `harvest_stage`, the type checker flags it.

- [ ] **Step 4: Commit**

```bash
git add src/lib/microgreens/seedData.ts
git commit -m "$(cat <<'EOF'
feat(microgreens): seed data declares harvest_stage per crop

Every SEED_CROPS row gets a harvest_stage field. Most default to
'baby_green' to match Press Farm's actual harvest preference; six
shoot/grain crops (Pea Shoot, Sunflower, Wheatgrass, Popcorn, Corn,
Nasturtium) stay at 'cotyledon' since 'baby green' is semantically
nonsense for them.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Task 15: Add harvest_stage selector to CropForm

**Files:**
- Modify: `src/components/admin/microgreens/CropForm.tsx`

- [ ] **Step 1: Import the labels map**

Add to the imports at the top of `CropForm.tsx`:

```ts
import { GROWING_MEDIA, HARVEST_STAGE_LABELS } from "@/lib/microgreens/constants";
```

(Append to the existing `GROWING_MEDIA` import — it lives next door.)

- [ ] **Step 2: Add `harvest_stage` to form state defaults**

In the `useState<any>({...})` block around line 18, add inside the object:

```ts
harvest_stage: initial?.harvest_stage ?? "baby_green",
```

(Add it right after `harvest_max_days: ...` for readability.)

- [ ] **Step 3: Add the select control**

Inside the `Growth` fieldset (around line 111-135), immediately after the "Ideal harvest day" label, insert:

```tsx
<label className="block">
  <span className="block text-sm">Harvest stage</span>
  <select
    className="input w-full"
    value={form.harvest_stage}
    onChange={(e) => update("harvest_stage", e.target.value)}
  >
    {(Object.keys(HARVEST_STAGE_LABELS) as Array<keyof typeof HARVEST_STAGE_LABELS>).map((k) => (
      <option key={k} value={k}>{HARVEST_STAGE_LABELS[k]}</option>
    ))}
  </select>
  <p className="text-xs text-farm-muted mt-1">
    Determines the label shown on tray timelines. Set "Ideal harvest day" above to the actual day count.
  </p>
</label>
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/microgreens/CropForm.tsx
git commit -m "$(cat <<'EOF'
feat(microgreens): harvest_stage selector on CropForm

New select in the Growth fieldset. Defaults to baby_green for new
crops. Existing crops load their persisted stage. The crops POST
and PATCH handlers already pass-through unknown fields, so no API
change is needed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Task 16: Add stage chip to crop list

**Files:**
- Modify: `src/app/admin/microgreens/crops/page.tsx`

- [ ] **Step 1: Import the label + chip class maps**

Update the imports near the top:

```tsx
import { HARVEST_STAGE_LABELS, HARVEST_STAGE_CHIP_CLASS } from "@/lib/microgreens/constants";
```

- [ ] **Step 2: Render the chip next to the crop name**

Inside the `crops.map((c) => (...))` block, locate the `<div className="font-medium">{c.name}{c.variety...}</div>` line (around line 44). Replace it with:

```tsx
<div className="font-medium flex items-center gap-2">
  <span>{c.name}{c.variety ? ` — ${c.variety}` : ""}</span>
  <span
    className={`text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 ${HARVEST_STAGE_CHIP_CLASS[c.harvest_stage]}`}
  >
    {HARVEST_STAGE_LABELS[c.harvest_stage]}
  </span>
  {!c.is_active && (
    <span className="text-[10px] uppercase tracking-wide text-farm-muted border border-farm-muted/30 rounded px-1.5 py-0.5">
      inactive
    </span>
  )}
</div>
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/microgreens/crops/page.tsx
git commit -m "$(cat <<'EOF'
feat(microgreens): harvest stage chip on crops list

Each crop row now shows a small stage chip (Cotyledon / True Leaf /
Baby Green) next to the name so you can spot stage at a glance.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Task 17: Tray detail subtitle shows harvest stage

**Files:**
- Modify: `src/app/admin/microgreens/trays/[id]/page.tsx`

- [ ] **Step 1: Import HARVEST_STAGE_LABELS**

Add to the imports:

```ts
import { HARVEST_STAGE_LABELS } from "@/lib/microgreens/constants";
```

- [ ] **Step 2: Update the `subtitle` prop**

Locate `<EditorialHero ... subtitle={crop ? `${crop.name}...` : undefined} />`. Replace it with:

```tsx
<EditorialHero
  eyebrow="Microgreens / Trays"
  title={tray.tray_label}
  subtitle={
    crop
      ? `${crop.name}${crop.variety ? ` — ${crop.variety}` : ""} · harvest at ${HARVEST_STAGE_LABELS[crop.harvest_stage]}`
      : undefined
  }
  backHref="/admin/microgreens/trays"
/>
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/microgreens/trays/[id]/page.tsx
git commit -m "$(cat <<'EOF'
feat(microgreens): tray detail subtitle shows target harvest stage

EditorialHero subtitle now reads e.g. "Broccoli · harvest at Baby
Green" so the target stage is visible above the timeline.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Task 18: StageTimeline shows stage in Harvest pill

**Files:**
- Modify: `src/components/admin/microgreens/StageTimeline.tsx`

- [ ] **Step 1: Import HARVEST_STAGE_LABELS**

Add to the imports:

```ts
import { HARVEST_STAGE_LABELS } from "@/lib/microgreens/constants";
```

- [ ] **Step 2: Build the dynamic label for the Harvest pill**

Replace the `STAGE_LABELS` constant. The trick: every label stays the same except `harvesting`, which becomes a function of the crop's `harvest_stage`. Update the component to:

```tsx
import { cn } from "@/lib/utils";
import { HARVEST_STAGE_LABELS } from "@/lib/microgreens/constants";
import type { MicrogreenTrayStatus, MicrogreenCrop } from "@/types/database";

const STAGES: MicrogreenTrayStatus[] = ["soaking", "blackout", "light", "harvesting"];

function stageLabel(stage: MicrogreenTrayStatus, crop: MicrogreenCrop): string {
  if (stage === "harvesting") return `Harvest (${HARVEST_STAGE_LABELS[crop.harvest_stage]})`;
  const base: Record<MicrogreenTrayStatus, string> = {
    soaking: "Soak", blackout: "Blackout", light: "Light",
    harvesting: "Harvest", terminated: "Done", lost: "Lost",
  };
  return base[stage];
}

export function StageTimeline({
  current,
  crop,
}: {
  current: MicrogreenTrayStatus;
  crop: MicrogreenCrop;
}) {
  const visible = STAGES.filter((s) =>
    !(s === "soaking" && crop.presoak_hours === 0 && crop.presprout_hours === 0)
  ).filter((s) =>
    !(s === "light" && crop.keep_in_blackout)
  );
  const currentIdx = visible.indexOf(current);

  return (
    <div className="flex items-center gap-1 text-xs">
      {visible.map((s, i) => (
        <div key={s} className="flex items-center gap-1">
          <div
            className={cn(
              "px-2 py-0.5 rounded-full whitespace-nowrap",
              i < currentIdx && "bg-farm-green/15 text-farm-green",
              i === currentIdx && "bg-farm-green text-white font-medium",
              i > currentIdx && "bg-farm-muted/15 text-farm-muted",
            )}
          >
            {stageLabel(s, crop)}
          </div>
          {i < visible.length - 1 && <span className="text-farm-muted">→</span>}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build passes.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/microgreens/StageTimeline.tsx
git commit -m "$(cat <<'EOF'
feat(microgreens): StageTimeline harvest pill names the target stage

The 'Harvest' pill on the tray timeline now reads e.g.
'Harvest (Baby Green)' or 'Harvest (Cotyledon)'. Other pills are
unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

## Task 19: Apply migration + push

This task is the only one that requires Micheal — the migration runs in the Supabase web SQL editor.

- [ ] **Step 1: Hand the migration SQL to Micheal**

Paste the contents of `supabase/migrations/060_microgreen_harvest_stage.sql` into the message and ask him to run it at:

`https://supabase.com/dashboard/project/rxdfjaseilmjvcwamqyk/sql/new`

Tell him to confirm:
1. No error.
2. `SELECT harvest_stage, COUNT(*) FROM microgreen_crops GROUP BY harvest_stage;` returns one row, `baby_green` with the full crop count.
3. Spot-check a few active leaf crops: their `ideal_harvest_day` is now +5 vs. yesterday's value. (Use `SELECT name, ideal_harvest_day FROM microgreen_crops WHERE name IN ('Broccoli','Radish','Arugula');`.)
4. Spot-check Pea Shoot / Sunflower: their `ideal_harvest_day` is unchanged.

- [ ] **Step 2: Wait for confirmation**

Do not push code until Micheal confirms the migration ran cleanly. Without the column, every crop list / edit / detail page will throw `column "harvest_stage" does not exist`.

- [ ] **Step 3: Run the full test suite one more time**

Run: `npm test`
Expected: green.

- [ ] **Step 4: Run a final build**

Run: `npm run build`
Expected: green.

- [ ] **Step 5: Push to origin**

```bash
git push origin claude/bold-snyder-417a5b:main
```

(Or whatever push command Micheal prefers; auto-deploys via Vercel.)

## Task 20: Phase B manual verification

After Vercel finishes deploying, walk through the harvest-stage UI on production (or `npm run dev` locally if you'd rather):

- [ ] **Step 1: Crop list shows chips**

Open `/admin/microgreens/crops`. Every crop has a stage chip. Shoot/grain crops show "Cotyledon"; everything else shows "Baby Green".

- [ ] **Step 2: Crop edit form has the selector**

Open any crop's edit page. The "Harvest stage" select appears in the Growth fieldset; the current value is selected. Change it, save, list updates.

- [ ] **Step 3: Tray detail subtitle**

Open any active tray. Subtitle reads e.g. "Broccoli · harvest at Baby Green".

- [ ] **Step 4: Stage timeline pill**

Same tray detail page — the Harvest pill on the right of the timeline reads e.g. "Harvest (Baby Green)" instead of just "Harvest".

- [ ] **Step 5: Dashboard harvest tasks shifted**

Open `/admin/microgreens`. Any tray that was previously "harvest today" should now show "harvest in 5 d" (for non-exception crops).

If any of these are off, debug and fix before considering the work done.

---

## Self-Review checklist (verified before publishing this plan)

- **Spec coverage:** Every section of the spec (cull API, cull UI, migration, types, seed data, crop form, crop list, tray subtitle, timeline label) has a numbered task.
- **No placeholders:** All code blocks are concrete. No "TBD" / "handle errors" / "similar to above".
- **Type consistency:** `MicrogreenHarvestStage` is defined in Task 12 and referenced consistently in Tasks 13–18. `LostReasonModal` API (`open`, `trayCount`, `onClose`, `onConfirm`) is identical in Tasks 5, 6, and 8. `TrayRow` shape defined in Task 8 matches the mapping in Task 9.
- **Migration ordering:** Phase B explicitly halts on Task 19 until Micheal confirms migration ran. Phase A is independent and can ship before Phase B.
- **Test mock compatibility:** The DELETE handler uses `.select("id").eq().limit(1)` instead of count-API so it works with the existing `supabase-mock` helper.
