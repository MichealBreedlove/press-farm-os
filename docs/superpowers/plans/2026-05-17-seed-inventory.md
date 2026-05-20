# Seed Inventory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a full on-hand seed inventory feature for Press Farm OS admin — track varieties, log sowings against plantings, record germination tests, and import/export via CSV.

**Architecture:** New top-level admin resource at `/admin/seeds` mirroring the items/expenses/deliveries pattern. Three new tables (`seeds`, `seed_sowings`, `seed_germination_tests`) plus a computed view `seeds_with_on_hand`. Optional `plantings.seed_id` FK for light linkage. Feature-flagged behind `SEEDS_ENABLED` constant until migration 046 is run in production.

**Tech Stack:** Next.js 14 App Router (TypeScript strict), Supabase Postgres + RLS, EditorialHero brand pattern, Tailwind with `farm-*` / `pf-*` token namespaces, SheetJS (xlsx) for CSV.

**Verification model:** This codebase relies on TypeScript strict + `npm run build` as the primary gate (per CLAUDE.md). There is no unit-test suite for API routes. Each task ends with a build check and manual verification. Push to `origin/main` auto-deploys to Vercel — do not push broken commits.

**Reference spec:** [docs/superpowers/specs/2026-05-17-seed-inventory-design.md](../specs/2026-05-17-seed-inventory-design.md)

---

## Task 1: Migration 046 — schema + view + planting FK

**Files:**
- Create: `supabase/migrations/046_seed_inventory.sql`

This migration is run manually by Micheal in the Supabase SQL editor at https://supabase.com/dashboard/project/rxdfjaseilmjvcwamqyk/sql/new — there is no `supabase` CLI link.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/046_seed_inventory.sql`:

```sql
-- Migration 046: Seed inventory
-- New tables: seeds, seed_sowings, seed_germination_tests
-- New view: seeds_with_on_hand (computes on_hand and is_low from sowings)
-- Adds optional plantings.seed_id FK

CREATE TABLE IF NOT EXISTS seeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  variety text NOT NULL,
  initial_quantity decimal(10,2) NOT NULL,
  quantity_unit text NOT NULL,
  packed_for_year integer,
  purchase_date date,
  supplier text,
  cost decimal(10,2),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'low', 'exhausted', 'discarded')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seed_sowings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_id uuid NOT NULL REFERENCES seeds(id) ON DELETE CASCADE,
  planting_id uuid REFERENCES plantings(id) ON DELETE SET NULL,
  amount_used decimal(10,2) NOT NULL,
  sown_on date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS seed_germination_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_id uuid NOT NULL REFERENCES seeds(id) ON DELETE CASCADE,
  tested_on date NOT NULL DEFAULT CURRENT_DATE,
  germination_pct decimal(5,2) NOT NULL CHECK (germination_pct >= 0 AND germination_pct <= 100),
  seeds_tested integer,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE plantings ADD COLUMN IF NOT EXISTS seed_id uuid REFERENCES seeds(id) ON DELETE SET NULL;

CREATE OR REPLACE VIEW seeds_with_on_hand AS
SELECT
  s.id,
  s.farm_id,
  s.item_id,
  s.variety,
  s.initial_quantity,
  s.quantity_unit,
  s.packed_for_year,
  s.purchase_date,
  s.supplier,
  s.cost,
  s.status,
  s.notes,
  s.created_at,
  s.updated_at,
  (s.initial_quantity - COALESCE(SUM(sw.amount_used), 0)) AS on_hand,
  CASE
    WHEN s.initial_quantity > 0
      AND (s.initial_quantity - COALESCE(SUM(sw.amount_used), 0))
          <= s.initial_quantity * 0.20
    THEN true
    ELSE false
  END AS is_low,
  MAX(sw.sown_on) AS last_sown_on,
  (SELECT germination_pct FROM seed_germination_tests gt
    WHERE gt.seed_id = s.id ORDER BY tested_on DESC LIMIT 1) AS latest_germ_pct,
  (SELECT tested_on FROM seed_germination_tests gt
    WHERE gt.seed_id = s.id ORDER BY tested_on DESC LIMIT 1) AS latest_germ_tested_on
FROM seeds s
LEFT JOIN seed_sowings sw ON sw.seed_id = s.id
GROUP BY s.id;

ALTER TABLE seeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE seed_sowings ENABLE ROW LEVEL SECURITY;
ALTER TABLE seed_germination_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to seeds"
  ON seeds FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin full access to seed_sowings"
  ON seed_sowings FOR ALL USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin full access to seed_germination_tests"
  ON seed_germination_tests FOR ALL USING (is_admin()) WITH CHECK (is_admin());

CREATE TRIGGER update_seeds_updated_at
  BEFORE UPDATE ON seeds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_seeds_item ON seeds (item_id);
CREATE INDEX IF NOT EXISTS idx_seeds_status ON seeds (status);
CREATE INDEX IF NOT EXISTS idx_seed_sowings_seed ON seed_sowings (seed_id);
CREATE INDEX IF NOT EXISTS idx_seed_sowings_planting ON seed_sowings (planting_id);
CREATE INDEX IF NOT EXISTS idx_seed_germ_tests_seed ON seed_germination_tests (seed_id);
```

- [ ] **Step 2: Hand the SQL to Micheal**

Per CLAUDE.md, the user does NOT have the `supabase` CLI linked. Surface the migration to Micheal in your status update with this exact message:

> Migration 046 written. Please run it in the SQL editor: https://supabase.com/dashboard/project/rxdfjaseilmjvcwamqyk/sql/new
>
> File: `supabase/migrations/046_seed_inventory.sql`

Do NOT proceed to push code that SELECTs from `seeds_with_on_hand` until Micheal confirms the migration ran. The feature flag `SEEDS_ENABLED=false` (added in Task 2) makes it safe to ship the code first.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/046_seed_inventory.sql
git commit -m "$(cat <<'EOF'
feat(db): migration 046 — seed inventory schema + planting FK

Three new tables (seeds, seed_sowings, seed_germination_tests) plus
seeds_with_on_hand view that computes on_hand and is_low from sowings.
Adds optional plantings.seed_id FK for light linkage.

Run in Supabase SQL editor before deploying any code that selects
from these tables. Code ships behind SEEDS_ENABLED feature flag.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Constants, types, and feature flag

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `src/types/database.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add SEEDS_ENABLED flag and seed enums to constants**

Append to `src/lib/constants.ts`:

```typescript
// ─── Seeds ──────────────────────────────────────────────────────────────
// Master kill switch for the /admin/seeds feature. Flip to true AFTER
// migration 046 has been run in production (Supabase SQL editor).
export const SEEDS_ENABLED = false;

export const SEED_STATUSES = ["active", "low", "exhausted", "discarded"] as const;
export type SeedStatus = (typeof SEED_STATUSES)[number];

export const SEED_STATUS_LABELS: Record<SeedStatus, string> = {
  active: "Active",
  low: "Low",
  exhausted: "Exhausted",
  discarded: "Discarded",
};

// Free-text suggestions for the unit picker — user can type anything.
export const SEED_QUANTITY_UNIT_SUGGESTIONS = [
  "packets",
  "g",
  "oz",
  "seeds",
  "lbs",
] as const;
```

- [ ] **Step 2: Add database types**

Append to `src/types/database.ts` (locate the end of the existing type exports; if a `Database` interface exists, do not modify it — these are app-side row types matching what `(supabase as any)` returns):

```typescript
// ─── Seeds ──────────────────────────────────────────────────────────────
export interface SeedRow {
  id: string;
  farm_id: string;
  item_id: string;
  variety: string;
  initial_quantity: number;
  quantity_unit: string;
  packed_for_year: number | null;
  purchase_date: string | null;
  supplier: string | null;
  cost: number | null;
  status: "active" | "low" | "exhausted" | "discarded";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SeedSowingRow {
  id: string;
  seed_id: string;
  planting_id: string | null;
  amount_used: number;
  sown_on: string;
  notes: string | null;
  created_at: string;
}

export interface SeedGerminationTestRow {
  id: string;
  seed_id: string;
  tested_on: string;
  germination_pct: number;
  seeds_tested: number | null;
  notes: string | null;
  created_at: string;
}

// View shape — includes computed columns
export interface SeedWithOnHandRow extends SeedRow {
  on_hand: number;
  is_low: boolean;
  last_sown_on: string | null;
  latest_germ_pct: number | null;
  latest_germ_tested_on: string | null;
}
```

- [ ] **Step 3: Add enriched join shape to app-level types**

Append to `src/types/index.ts`:

```typescript
import type {
  SeedWithOnHandRow,
  SeedSowingRow,
  SeedGerminationTestRow,
} from "./database";

// Seed enriched with the linked item's name + category for display
export interface SeedWithItem extends SeedWithOnHandRow {
  item: {
    id: string;
    name: string;
    category: string;
  } | null;
}

// Sowing enriched with the linked planting (if any)
export interface SeedSowingWithPlanting extends SeedSowingRow {
  planting: {
    id: string;
    crop_name: string;
    variety: string | null;
    sow_date: string | null;
  } | null;
}

export type { SeedGerminationTestRow };
```

- [ ] **Step 4: Build check**

Run: `npm run build`
Expected: clean build, no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/constants.ts src/types/database.ts src/types/index.ts
git commit -m "$(cat <<'EOF'
feat(seeds): add types, status enum, and SEEDS_ENABLED feature flag

Flag defaults to false. Flip to true after migration 046 runs in prod.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: API — `/api/seeds` (list + create)

**Files:**
- Create: `src/app/api/seeds/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/seeds/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SEED_STATUSES } from "@/lib/constants";

const VALID_STATUSES = new Set<string>(SEED_STATUSES);

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

/**
 * GET /api/seeds?status=active&item_id=...
 * Returns seeds enriched with item name + on_hand computed column.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status");
  const itemIdFilter = searchParams.get("item_id");

  const admin = createAdminClient();
  let query = (admin as any)
    .from("seeds_with_on_hand")
    .select("*, item:items(id, name, category)")
    .order("variety");

  if (statusFilter && VALID_STATUSES.has(statusFilter)) query = query.eq("status", statusFilter);
  if (itemIdFilter) query = query.eq("item_id", itemIdFilter);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ seeds: data ?? [] });
}

/**
 * POST /api/seeds
 * Body: { item_id, variety, initial_quantity, quantity_unit, packed_for_year?, purchase_date?, supplier?, cost?, status?, notes? }
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const item_id = String(body.item_id ?? "").trim();
  const variety = String(body.variety ?? "").trim();
  const quantity_unit = String(body.quantity_unit ?? "").trim();
  const initial_quantity_raw = body.initial_quantity;

  if (!item_id) return NextResponse.json({ error: "item_id required" }, { status: 400 });
  if (!variety) return NextResponse.json({ error: "variety required" }, { status: 400 });
  if (!quantity_unit) return NextResponse.json({ error: "quantity_unit required" }, { status: 400 });

  const initial_quantity = typeof initial_quantity_raw === "number"
    ? initial_quantity_raw
    : parseFloat(String(initial_quantity_raw));
  if (!Number.isFinite(initial_quantity) || initial_quantity < 0) {
    return NextResponse.json({ error: "initial_quantity must be a non-negative number" }, { status: 400 });
  }

  const status = body.status ? String(body.status) : "active";
  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: farm } = await (admin as any).from("farms").select("id").single();
  if (!farm) return NextResponse.json({ error: "Farm not found" }, { status: 500 });

  // Validate item exists
  const { data: item } = await (admin as any).from("items").select("id").eq("id", item_id).single();
  if (!item) return NextResponse.json({ error: "item_id does not match any item" }, { status: 400 });

  const insertRow: Record<string, unknown> = {
    farm_id: farm.id,
    item_id,
    variety,
    initial_quantity,
    quantity_unit,
    status,
    packed_for_year: body.packed_for_year != null ? Number(body.packed_for_year) : null,
    purchase_date: body.purchase_date ? String(body.purchase_date) : null,
    supplier: body.supplier ? String(body.supplier).trim() : null,
    cost: body.cost != null ? Number(body.cost) : null,
    notes: body.notes ? String(body.notes).trim() : null,
  };

  const { data: seed, error } = await (admin as any)
    .from("seeds")
    .insert(insertRow)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ seed }, { status: 201 });
}
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/seeds/route.ts
git commit -m "feat(api): /api/seeds GET list + POST create

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: API — `/api/seeds/[seedId]` (read, update, delete)

**Files:**
- Create: `src/app/api/seeds/[seedId]/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/seeds/[seedId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SEED_STATUSES } from "@/lib/constants";

const VALID_STATUSES = new Set<string>(SEED_STATUSES);
type Params = Promise<{ seedId: string }>;

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

/**
 * GET /api/seeds/[seedId]
 * Returns the seed with on_hand, sowing history, and germ test history.
 */
export async function GET(_req: Request, { params }: { params: Params }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { seedId } = await params;
  const admin = createAdminClient();

  const { data: seed, error } = await (admin as any)
    .from("seeds_with_on_hand")
    .select("*, item:items(id, name, category)")
    .eq("id", seedId)
    .single();
  if (error || !seed) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: sowings } = await (admin as any)
    .from("seed_sowings")
    .select("*, planting:plantings(id, crop_name, variety, sow_date)")
    .eq("seed_id", seedId)
    .order("sown_on", { ascending: false });

  const { data: germTests } = await (admin as any)
    .from("seed_germination_tests")
    .select("*")
    .eq("seed_id", seedId)
    .order("tested_on", { ascending: false });

  return NextResponse.json({
    seed,
    sowings: sowings ?? [],
    germTests: germTests ?? [],
  });
}

/**
 * PATCH /api/seeds/[seedId]
 * Body: any subset of editable fields.
 */
export async function PATCH(request: Request, { params }: { params: Params }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { seedId } = await params;
  const updates: Record<string, unknown> = {};

  if (body.variety !== undefined) {
    const v = String(body.variety).trim();
    if (!v) return NextResponse.json({ error: "variety cannot be empty" }, { status: 400 });
    updates.variety = v;
  }
  if (body.initial_quantity !== undefined) {
    const n = typeof body.initial_quantity === "number"
      ? body.initial_quantity
      : parseFloat(String(body.initial_quantity));
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: "initial_quantity must be a non-negative number" }, { status: 400 });
    }
    updates.initial_quantity = n;
  }
  if (body.quantity_unit !== undefined) {
    const u = String(body.quantity_unit).trim();
    if (!u) return NextResponse.json({ error: "quantity_unit cannot be empty" }, { status: 400 });
    updates.quantity_unit = u;
  }
  if (body.packed_for_year !== undefined) {
    updates.packed_for_year = body.packed_for_year == null ? null : Number(body.packed_for_year);
  }
  if (body.purchase_date !== undefined) {
    updates.purchase_date = body.purchase_date ? String(body.purchase_date) : null;
  }
  if (body.supplier !== undefined) {
    updates.supplier = body.supplier ? String(body.supplier).trim() : null;
  }
  if (body.cost !== undefined) {
    updates.cost = body.cost == null ? null : Number(body.cost);
  }
  if (body.status !== undefined) {
    if (!VALID_STATUSES.has(String(body.status))) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = body.status;
  }
  if (body.notes !== undefined) {
    updates.notes = body.notes ? String(body.notes).trim() : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: seed, error } = await (admin as any)
    .from("seeds")
    .update(updates)
    .eq("id", seedId)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ seed });
}

/**
 * DELETE /api/seeds/[seedId]
 * Only allowed if the seed has no sowings. Otherwise client should
 * PATCH status to 'discarded' to archive without losing history.
 */
export async function DELETE(_req: Request, { params }: { params: Params }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { seedId } = await params;
  const admin = createAdminClient();

  const { count } = await (admin as any)
    .from("seed_sowings")
    .select("id", { count: "exact", head: true })
    .eq("seed_id", seedId);

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Cannot delete a seed with logged sowings. Set status to 'discarded' instead." },
      { status: 409 },
    );
  }

  const { error } = await (admin as any).from("seeds").delete().eq("id", seedId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/seeds/\[seedId\]/route.ts
git commit -m "feat(api): /api/seeds/[seedId] GET/PATCH/DELETE

DELETE blocked when sowings exist — clients must set status='discarded' instead.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: API — sowing log

**Files:**
- Create: `src/app/api/seeds/[seedId]/sowings/route.ts`
- Create: `src/app/api/seeds/[seedId]/sowings/[sowingId]/route.ts`

- [ ] **Step 1: Write the POST/list route**

Create `src/app/api/seeds/[seedId]/sowings/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = Promise<{ seedId: string }>;

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

/**
 * POST /api/seeds/[seedId]/sowings
 * Body: { amount_used, planting_id?, sown_on?, notes? }
 */
export async function POST(request: Request, { params }: { params: Params }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { seedId } = await params;
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const amount = typeof body.amount_used === "number"
    ? body.amount_used
    : parseFloat(String(body.amount_used));
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount_used must be a positive number" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify seed exists
  const { data: seed } = await (admin as any).from("seeds").select("id").eq("id", seedId).single();
  if (!seed) return NextResponse.json({ error: "Seed not found" }, { status: 404 });

  // Verify planting if provided
  let planting_id: string | null = null;
  if (body.planting_id) {
    const { data: p } = await (admin as any)
      .from("plantings").select("id").eq("id", body.planting_id).single();
    if (!p) return NextResponse.json({ error: "planting_id does not match any planting" }, { status: 400 });
    planting_id = String(body.planting_id);
  }

  const { data: sowing, error } = await (admin as any)
    .from("seed_sowings")
    .insert({
      seed_id: seedId,
      planting_id,
      amount_used: amount,
      sown_on: body.sown_on ? String(body.sown_on) : new Date().toISOString().slice(0, 10),
      notes: body.notes ? String(body.notes).trim() : null,
    })
    .select("*, planting:plantings(id, crop_name, variety, sow_date)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sowing }, { status: 201 });
}
```

- [ ] **Step 2: Write the DELETE route for individual sowings**

Create `src/app/api/seeds/[seedId]/sowings/[sowingId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = Promise<{ seedId: string; sowingId: string }>;

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

/** DELETE /api/seeds/[seedId]/sowings/[sowingId] */
export async function DELETE(_req: Request, { params }: { params: Params }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { seedId, sowingId } = await params;
  const admin = createAdminClient();
  const { error } = await (admin as any)
    .from("seed_sowings")
    .delete()
    .eq("id", sowingId)
    .eq("seed_id", seedId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Build check**

Run: `npm run build`
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/seeds/\[seedId\]/sowings/
git commit -m "feat(api): sowing log POST + DELETE individual sowing

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: API — germination tests

**Files:**
- Create: `src/app/api/seeds/[seedId]/germ-tests/route.ts`
- Create: `src/app/api/seeds/[seedId]/germ-tests/[testId]/route.ts`

- [ ] **Step 1: Write the POST route**

Create `src/app/api/seeds/[seedId]/germ-tests/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = Promise<{ seedId: string }>;

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

/**
 * POST /api/seeds/[seedId]/germ-tests
 * Body: { germination_pct, tested_on?, seeds_tested?, notes? }
 */
export async function POST(request: Request, { params }: { params: Params }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { seedId } = await params;
  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const pct = typeof body.germination_pct === "number"
    ? body.germination_pct
    : parseFloat(String(body.germination_pct));
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    return NextResponse.json({ error: "germination_pct must be between 0 and 100" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: seed } = await (admin as any).from("seeds").select("id").eq("id", seedId).single();
  if (!seed) return NextResponse.json({ error: "Seed not found" }, { status: 404 });

  const { data: test, error } = await (admin as any)
    .from("seed_germination_tests")
    .insert({
      seed_id: seedId,
      germination_pct: pct,
      tested_on: body.tested_on ? String(body.tested_on) : new Date().toISOString().slice(0, 10),
      seeds_tested: body.seeds_tested != null ? Number(body.seeds_tested) : null,
      notes: body.notes ? String(body.notes).trim() : null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ test }, { status: 201 });
}
```

- [ ] **Step 2: Write the DELETE route**

Create `src/app/api/seeds/[seedId]/germ-tests/[testId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Params = Promise<{ seedId: string; testId: string }>;

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

/** DELETE /api/seeds/[seedId]/germ-tests/[testId] */
export async function DELETE(_req: Request, { params }: { params: Params }) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const { seedId, testId } = await params;
  const admin = createAdminClient();
  const { error } = await (admin as any)
    .from("seed_germination_tests")
    .delete()
    .eq("id", testId)
    .eq("seed_id", seedId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Build check + commit**

```bash
npm run build
git add src/app/api/seeds/\[seedId\]/germ-tests/
git commit -m "feat(api): germination test log POST + DELETE

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: API — CSV export + import

**Files:**
- Create: `src/app/api/seeds/export/route.ts`
- Create: `src/app/api/import/seeds-csv/route.ts`

- [ ] **Step 1: Write the export route**

Create `src/app/api/seeds/export/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const HEADER = [
  "id",
  "item_name",
  "variety",
  "initial_quantity",
  "quantity_unit",
  "packed_for_year",
  "purchase_date",
  "supplier",
  "cost",
  "status",
  "notes",
] as const;

function csvEscape(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** GET /api/seeds/export — returns CSV download */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("seeds")
    .select("*, item:items(name)")
    .order("variety");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const lines: string[] = [HEADER.join(",")];
  for (const row of (data ?? []) as Array<Record<string, unknown> & { item: { name: string } | null }>) {
    lines.push([
      row.id,
      row.item?.name ?? "",
      row.variety,
      row.initial_quantity,
      row.quantity_unit,
      row.packed_for_year ?? "",
      row.purchase_date ?? "",
      row.supplier ?? "",
      row.cost ?? "",
      row.status,
      row.notes ?? "",
    ].map(csvEscape).join(","));
  }

  const csv = lines.join("\n");
  const filename = `seeds-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

- [ ] **Step 2: Write the import route**

Create `src/app/api/import/seeds-csv/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import * as XLSX from "xlsx";
import { SEED_STATUSES } from "@/lib/constants";

const VALID_STATUSES = new Set<string>(SEED_STATUSES);

interface ParsedRow {
  id?: string;
  item_name: string;
  variety: string;
  initial_quantity: number;
  quantity_unit: string;
  packed_for_year: number | null;
  purchase_date: string | null;
  supplier: string | null;
  cost: number | null;
  status: string;
  notes: string | null;
}

function pick(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function parseDate(raw: string): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d+(\.\d+)?$/.test(s)) {
    const num = parseFloat(s);
    if (num > 1 && num < 100000) {
      const ms = (num - 25569) * 86400 * 1000;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * POST /api/import/seeds-csv
 * Multipart form: { file: <csv or xlsx> }
 * Upserts by `id` if present; otherwise inserts new rows.
 * Matches item by `item_name` (case-insensitive) against the items catalog.
 * Returns { imported, updated, errors: [{ row: number, message: string }] }.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file field required" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const admin = createAdminClient();
  const { data: farm } = await (admin as any).from("farms").select("id").single();
  if (!farm) return NextResponse.json({ error: "Farm not found" }, { status: 500 });

  // Build a case-insensitive name → id index of items, once.
  const { data: items } = await (admin as any).from("items").select("id, name");
  const itemByName = new Map<string, string>();
  for (const it of (items ?? []) as Array<{ id: string; name: string }>) {
    itemByName.set(it.name.toLowerCase().trim(), it.id);
  }

  let imported = 0;
  let updated = 0;
  const errors: Array<{ row: number; message: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2; // header is row 1

    const id = pick(r, "id");
    const item_name = pick(r, "item_name", "item", "crop");
    const variety = pick(r, "variety");
    const initial_quantity_raw = pick(r, "initial_quantity", "quantity");
    const quantity_unit = pick(r, "quantity_unit", "unit");

    if (!item_name) { errors.push({ row: rowNum, message: "missing item_name" }); continue; }
    if (!variety) { errors.push({ row: rowNum, message: "missing variety" }); continue; }
    if (!initial_quantity_raw) { errors.push({ row: rowNum, message: "missing initial_quantity" }); continue; }
    if (!quantity_unit) { errors.push({ row: rowNum, message: "missing quantity_unit" }); continue; }

    const item_id = itemByName.get(item_name.toLowerCase().trim());
    if (!item_id) {
      errors.push({ row: rowNum, message: `no matching item: '${item_name}'` });
      continue;
    }

    const initial_quantity = parseFloat(initial_quantity_raw);
    if (!Number.isFinite(initial_quantity) || initial_quantity < 0) {
      errors.push({ row: rowNum, message: "initial_quantity must be a non-negative number" });
      continue;
    }

    const status = pick(r, "status") || "active";
    if (!VALID_STATUSES.has(status)) {
      errors.push({ row: rowNum, message: `invalid status: '${status}'` });
      continue;
    }

    const packed_for_year_raw = pick(r, "packed_for_year");
    const cost_raw = pick(r, "cost");
    const parsed: ParsedRow = {
      id: id || undefined,
      item_name,
      variety,
      initial_quantity,
      quantity_unit,
      packed_for_year: packed_for_year_raw ? parseInt(packed_for_year_raw, 10) : null,
      purchase_date: parseDate(pick(r, "purchase_date")),
      supplier: pick(r, "supplier") || null,
      cost: cost_raw ? parseFloat(cost_raw) : null,
      status,
      notes: pick(r, "notes") || null,
    };

    const row = {
      farm_id: farm.id,
      item_id,
      variety: parsed.variety,
      initial_quantity: parsed.initial_quantity,
      quantity_unit: parsed.quantity_unit,
      packed_for_year: parsed.packed_for_year,
      purchase_date: parsed.purchase_date,
      supplier: parsed.supplier,
      cost: parsed.cost,
      status: parsed.status,
      notes: parsed.notes,
    };

    if (parsed.id) {
      const { error } = await (admin as any).from("seeds").update(row).eq("id", parsed.id);
      if (error) { errors.push({ row: rowNum, message: error.message }); continue; }
      updated++;
    } else {
      const { error } = await (admin as any).from("seeds").insert(row);
      if (error) { errors.push({ row: rowNum, message: error.message }); continue; }
      imported++;
    }
  }

  return NextResponse.json({ imported, updated, errors });
}
```

- [ ] **Step 3: Build check + commit**

```bash
npm run build
git add src/app/api/seeds/export/ src/app/api/import/seeds-csv/
git commit -m "feat(api): CSV export + import for seeds

Matches items/expenses/deliveries pattern. Upserts by id; matches catalog
by case-insensitive item_name. Sowings and germ tests are not in the CSV.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: List page `/admin/seeds`

**Files:**
- Create: `src/app/admin/seeds/page.tsx`
- Create: `src/app/admin/seeds/SeedsClient.tsx`
- Create: `src/components/admin/seeds/SeedRow.tsx`

- [ ] **Step 1: Write the server page**

Create `src/app/admin/seeds/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { SEEDS_ENABLED } from "@/lib/constants";
import { SeedsClient } from "./SeedsClient";
import type { SeedWithItem } from "@/types";

export const dynamic = "force-dynamic";

export default async function SeedsPage() {
  if (!SEEDS_ENABLED) redirect("/admin/dashboard");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") redirect("/");

  const admin = createAdminClient();
  const { data: seedsRaw } = await (admin as any)
    .from("seeds_with_on_hand")
    .select("*, item:items(id, name, category)")
    .order("variety");
  const seeds = (seedsRaw ?? []) as SeedWithItem[];

  const activeCount = seeds.filter((s) => s.status === "active").length;
  const lowCount = seeds.filter((s) => s.is_low && s.status !== "discarded").length;
  const exhaustedCount = seeds.filter((s) => s.status === "exhausted" || s.on_hand <= 0).length;
  const currentYear = new Date().getFullYear();
  const oldCount = seeds.filter(
    (s) => s.packed_for_year != null && s.packed_for_year <= currentYear - 2 && s.status !== "discarded",
  ).length;

  const subtitle =
    `${activeCount} active · ${lowCount} low` + (oldCount > 0 ? ` · ${oldCount} old seed` : "");

  return (
    <main className="pb-24">
      <EditorialHero
        eyebrow="Inventory"
        title="Seeds"
        subtitle={subtitle}
        flower="fennel"
        backHref="/admin/dashboard"
      />
      <div className="px-4 py-6 max-w-3xl mx-auto">
        <SeedsClient
          initialSeeds={seeds}
          counts={{ active: activeCount, low: lowCount, exhausted: exhaustedCount, old: oldCount }}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Write the client component (filter + list + create modal)**

Create `src/app/admin/seeds/SeedsClient.tsx`:

```typescript
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SEED_STATUSES, SEED_STATUS_LABELS, type SeedStatus } from "@/lib/constants";
import type { SeedWithItem } from "@/types";
import { SeedRow } from "@/components/admin/seeds/SeedRow";

interface Props {
  initialSeeds: SeedWithItem[];
  counts: { active: number; low: number; exhausted: number; old: number };
}

type StatusFilter = "all" | SeedStatus;

export function SeedsClient({ initialSeeds, counts }: Props) {
  const [seeds] = useState<SeedWithItem[]>(initialSeeds);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [oldOnly, setOldOnly] = useState(false);

  const currentYear = new Date().getFullYear();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return seeds.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (oldOnly) {
        if (s.packed_for_year == null) return false;
        if (s.packed_for_year > currentYear - 2) return false;
      }
      if (!q) return true;
      return (
        s.variety.toLowerCase().includes(q) ||
        (s.item?.name?.toLowerCase().includes(q) ?? false) ||
        (s.supplier?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [seeds, search, statusFilter, oldOnly, currentYear]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <Stat label="Active" value={counts.active} />
        <Stat label="Low" value={counts.low} tone={counts.low > 0 ? "amber" : "neutral"} />
        <Stat label="Exhausted" value={counts.exhausted} tone="neutral" />
        <Stat label="Old seed" value={counts.old} tone={counts.old > 0 ? "red" : "neutral"} />
      </div>

      <div className="flex gap-2">
        <input
          type="search"
          placeholder="Search variety, crop, supplier..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-farm-muted/30 rounded-md text-sm"
        />
        <Link
          href="/admin/seeds/new"
          className="px-4 py-2 bg-farm-green text-white rounded-md text-sm font-medium whitespace-nowrap"
        >
          + Add seed
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap">
        <FilterChip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>All</FilterChip>
        {SEED_STATUSES.map((s) => (
          <FilterChip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
            {SEED_STATUS_LABELS[s]}
          </FilterChip>
        ))}
        <FilterChip active={oldOnly} onClick={() => setOldOnly((v) => !v)}>Old seed only</FilterChip>
      </div>

      <div className="divide-y divide-farm-muted/20">
        {filtered.length === 0 ? (
          <p className="text-center py-12 text-farm-muted text-sm">No seeds match these filters.</p>
        ) : (
          filtered.map((seed) => <SeedRow key={seed.id} seed={seed} currentYear={currentYear} />)
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "amber" | "red" }) {
  const colorClass = tone === "amber" ? "text-amber-700" : tone === "red" ? "text-red-700" : "text-farm-dark";
  return (
    <div className="border border-farm-muted/20 rounded-md py-2">
      <div className={`text-lg font-semibold ${colorClass}`}>{value}</div>
      <div className="text-farm-muted">{label}</div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium min-h-[44px] sm:min-h-0 transition-colors ${
        active ? "bg-farm-green text-white" : "bg-farm-cream text-farm-dark border border-farm-muted/30"
      }`}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 3: Write the row component**

Create `src/components/admin/seeds/SeedRow.tsx`:

```typescript
import Link from "next/link";
import type { SeedWithItem } from "@/types";
import { SEED_STATUS_LABELS } from "@/lib/constants";

interface Props {
  seed: SeedWithItem;
  currentYear: number;
}

export function SeedRow({ seed, currentYear }: Props) {
  const exhausted = seed.on_hand <= 0;
  const ageBadge = packedForBadge(seed.packed_for_year, currentYear);

  return (
    <Link
      href={`/admin/seeds/${seed.id}`}
      className={`flex items-center gap-3 py-3 px-1 min-h-[44px] ${exhausted ? "opacity-50" : ""}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-farm-dark truncate">{seed.variety}</span>
          {ageBadge}
          {seed.is_low && !exhausted && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Low</span>
          )}
          {exhausted && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-farm-muted/20 text-farm-muted">Exhausted</span>
          )}
        </div>
        <div className="text-xs text-farm-muted truncate">
          {seed.item?.name ?? "(crop unlinked)"}
          {seed.latest_germ_pct != null && ` · ${seed.latest_germ_pct}% germ`}
        </div>
      </div>
      <div className="text-right text-sm">
        <div className="font-medium text-farm-dark">
          {formatQuantity(seed.on_hand)} {seed.quantity_unit}
        </div>
        <div className="text-[10px] text-farm-muted">{SEED_STATUS_LABELS[seed.status]}</div>
      </div>
    </Link>
  );
}

function formatQuantity(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, "");
}

function packedForBadge(year: number | null, currentYear: number) {
  if (year == null) return null;
  if (year >= currentYear) return null;
  if (year === currentYear - 1) {
    return <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Last year</span>;
  }
  return <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-800">Old seed</span>;
}
```

- [ ] **Step 4: Build check + commit**

```bash
npm run build
git add src/app/admin/seeds/page.tsx src/app/admin/seeds/SeedsClient.tsx src/components/admin/seeds/SeedRow.tsx
git commit -m "feat(admin): /admin/seeds list page with filters

Server-fetched seeds + client-side filtering. Status chips, search, and
'old seed only' toggle. Gated on SEEDS_ENABLED.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: Detail page `/admin/seeds/[seedId]`

**Files:**
- Create: `src/app/admin/seeds/[seedId]/page.tsx`
- Create: `src/app/admin/seeds/[seedId]/SeedDetailClient.tsx`
- Create: `src/components/admin/seeds/SeedForm.tsx`

- [ ] **Step 1: Write the server page**

Create `src/app/admin/seeds/[seedId]/page.tsx`:

```typescript
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { SEEDS_ENABLED } from "@/lib/constants";
import { SeedDetailClient } from "./SeedDetailClient";
import type { SeedWithItem, SeedSowingWithPlanting, SeedGerminationTestRow } from "@/types";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ seedId: string }>;
}

export default async function SeedDetailPage({ params }: Props) {
  if (!SEEDS_ENABLED) redirect("/admin/dashboard");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") redirect("/");

  const { seedId } = await params;
  const admin = createAdminClient();

  const { data: seedRaw } = await (admin as any)
    .from("seeds_with_on_hand")
    .select("*, item:items(id, name, category)")
    .eq("id", seedId)
    .single();
  if (!seedRaw) notFound();
  const seed = seedRaw as SeedWithItem;

  const [{ data: sowingsRaw }, { data: testsRaw }, { data: plantingsRaw }] = await Promise.all([
    (admin as any)
      .from("seed_sowings")
      .select("*, planting:plantings(id, crop_name, variety, sow_date)")
      .eq("seed_id", seedId)
      .order("sown_on", { ascending: false }),
    (admin as any)
      .from("seed_germination_tests")
      .select("*")
      .eq("seed_id", seedId)
      .order("tested_on", { ascending: false }),
    (admin as any)
      .from("plantings")
      .select("id, crop_name, variety, sow_date, status, item_id")
      .eq("planting_stock", "seeds")
      .order("sow_date", { ascending: false })
      .limit(100),
  ]);

  // Filter plantings to those matching this seed's item, with all-plantings fallback
  const plantings = (plantingsRaw ?? []) as Array<{
    id: string; crop_name: string; variety: string | null; sow_date: string | null;
    status: string; item_id: string | null;
  }>;
  const matchingPlantings = plantings.filter((p) => p.item_id === seed.item_id);
  const plantingOptions = matchingPlantings.length > 0 ? matchingPlantings : plantings;

  return (
    <main className="pb-24">
      <EditorialHero
        eyebrow={seed.item?.name ?? "Seed"}
        title={seed.variety}
        subtitle={seed.supplier ? `from ${seed.supplier}` : undefined}
        flower="fennel"
        backHref="/admin/seeds"
      />
      <div className="px-4 py-6 max-w-3xl mx-auto">
        <SeedDetailClient
          seed={seed}
          sowings={(sowingsRaw ?? []) as SeedSowingWithPlanting[]}
          germTests={(testsRaw ?? []) as SeedGerminationTestRow[]}
          plantingOptions={plantingOptions}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Write the form component**

Create `src/components/admin/seeds/SeedForm.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  SEED_STATUSES,
  SEED_STATUS_LABELS,
  SEED_QUANTITY_UNIT_SUGGESTIONS,
} from "@/lib/constants";
import type { SeedWithItem } from "@/types";

interface Props {
  seed: SeedWithItem;
}

export function SeedForm({ seed }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    variety: seed.variety,
    initial_quantity: seed.initial_quantity,
    quantity_unit: seed.quantity_unit,
    packed_for_year: seed.packed_for_year ?? "",
    purchase_date: seed.purchase_date ?? "",
    supplier: seed.supplier ?? "",
    cost: seed.cost ?? "",
    status: seed.status,
    notes: seed.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/seeds/${seed.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variety: form.variety,
        initial_quantity: Number(form.initial_quantity),
        quantity_unit: form.quantity_unit,
        packed_for_year: form.packed_for_year === "" ? null : Number(form.packed_for_year),
        purchase_date: form.purchase_date || null,
        supplier: form.supplier || null,
        cost: form.cost === "" ? null : Number(form.cost),
        status: form.status,
        notes: form.notes || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Save failed");
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4 bg-farm-cream/40 p-4 rounded-md border border-farm-muted/20">
      <Field label="Variety">
        <input
          type="text" required value={form.variety}
          onChange={(e) => setForm({ ...form, variety: e.target.value })}
          className="input"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Initial quantity">
          <input
            type="number" min="0" step="0.01" required
            value={form.initial_quantity}
            onChange={(e) => setForm({ ...form, initial_quantity: e.target.value as unknown as number })}
            className="input"
          />
        </Field>
        <Field label="Unit">
          <input
            type="text" required list="seed-unit-suggestions" value={form.quantity_unit}
            onChange={(e) => setForm({ ...form, quantity_unit: e.target.value })}
            className="input"
          />
          <datalist id="seed-unit-suggestions">
            {SEED_QUANTITY_UNIT_SUGGESTIONS.map((u) => <option key={u} value={u} />)}
          </datalist>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Packed-for year">
          <input
            type="number" min="2000" max="2100" value={form.packed_for_year}
            onChange={(e) => setForm({ ...form, packed_for_year: e.target.value })}
            className="input" placeholder="e.g. 2026"
          />
        </Field>
        <Field label="Purchase date">
          <input
            type="date" value={form.purchase_date}
            onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
            className="input"
          />
        </Field>
      </div>

      <Field label="Supplier">
        <input
          type="text" value={form.supplier}
          onChange={(e) => setForm({ ...form, supplier: e.target.value })}
          className="input" placeholder="e.g. Johnny's, Baker Creek"
        />
      </Field>

      <Field label="Cost (USD)">
        <input
          type="number" min="0" step="0.01" value={form.cost}
          onChange={(e) => setForm({ ...form, cost: e.target.value as unknown as number })}
          className="input"
        />
      </Field>

      <Field label="Status">
        <select
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
          className="input"
        >
          {SEED_STATUSES.map((s) => <option key={s} value={s}>{SEED_STATUS_LABELS[s]}</option>)}
        </select>
      </Field>

      <Field label="Notes">
        <textarea
          rows={3} value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="input"
        />
      </Field>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        type="submit" disabled={saving}
        className="w-full bg-farm-green text-white py-2 rounded-md font-medium min-h-[44px] disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>

      <style jsx>{`
        :global(.input) {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid rgb(0 0 0 / 0.15);
          border-radius: 0.375rem;
          font-size: 0.875rem;
          background: white;
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-farm-muted uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}
```

- [ ] **Step 3: Write the detail client (wires form + history lists + modal triggers)**

Create `src/app/admin/seeds/[seedId]/SeedDetailClient.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SeedWithItem, SeedSowingWithPlanting, SeedGerminationTestRow } from "@/types";
import { SeedForm } from "@/components/admin/seeds/SeedForm";
import { LogSowingModal } from "@/components/admin/seeds/LogSowingModal";
import { LogGermTestModal } from "@/components/admin/seeds/LogGermTestModal";

interface Props {
  seed: SeedWithItem;
  sowings: SeedSowingWithPlanting[];
  germTests: SeedGerminationTestRow[];
  plantingOptions: Array<{ id: string; crop_name: string; variety: string | null; sow_date: string | null }>;
}

export function SeedDetailClient({ seed, sowings, germTests, plantingOptions }: Props) {
  const router = useRouter();
  const [sowingModalOpen, setSowingModalOpen] = useState(false);
  const [germModalOpen, setGermModalOpen] = useState(false);

  async function deleteSowing(id: string) {
    if (!confirm("Delete this sowing record?")) return;
    const res = await fetch(`/api/seeds/${seed.id}/sowings/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }
  async function deleteGermTest(id: string) {
    if (!confirm("Delete this germination test?")) return;
    const res = await fetch(`/api/seeds/${seed.id}/germ-tests/${id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }
  async function deleteSeed() {
    if (!confirm("Delete this seed entry?")) return;
    const res = await fetch(`/api/seeds/${seed.id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/seeds");
    else {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Delete failed");
    }
  }

  const formatQuantity = (n: number) =>
    Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");

  return (
    <div className="space-y-6">
      <section className="bg-white border border-farm-muted/20 rounded-md p-4 text-center">
        <div className="text-xs text-farm-muted uppercase tracking-wide">On hand</div>
        <div className="text-3xl font-semibold text-farm-dark">
          {formatQuantity(seed.on_hand)} <span className="text-base font-normal">{seed.quantity_unit}</span>
        </div>
        {seed.latest_germ_pct != null && (
          <div className="text-xs text-farm-muted mt-1">
            Last germ test: {seed.latest_germ_pct}% on {seed.latest_germ_tested_on}
          </div>
        )}
      </section>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setSowingModalOpen(true)}
          className="bg-farm-green text-white py-3 rounded-md font-medium min-h-[44px]"
        >
          Log sowing
        </button>
        <button
          onClick={() => setGermModalOpen(true)}
          className="bg-farm-dark text-white py-3 rounded-md font-medium min-h-[44px]"
        >
          Log germ test
        </button>
      </div>

      <SeedForm seed={seed} />

      <section>
        <h2 className="text-sm font-semibold text-farm-muted uppercase tracking-wide mb-2">
          Sowing history ({sowings.length})
        </h2>
        {sowings.length === 0 ? (
          <p className="text-sm text-farm-muted">No sowings logged yet.</p>
        ) : (
          <ul className="divide-y divide-farm-muted/20">
            {sowings.map((s) => (
              <li key={s.id} className="py-2 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-farm-dark">
                    {formatQuantity(s.amount_used)} {seed.quantity_unit} on {s.sown_on}
                  </div>
                  <div className="text-xs text-farm-muted">
                    {s.planting ? `Planting: ${s.planting.crop_name}${s.planting.variety ? ` — ${s.planting.variety}` : ""}` : "No planting linked"}
                    {s.notes ? ` · ${s.notes}` : ""}
                  </div>
                </div>
                <button onClick={() => deleteSowing(s.id)} className="text-xs text-red-700 px-2 py-1 min-h-[44px]">
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-farm-muted uppercase tracking-wide mb-2">
          Germination tests ({germTests.length})
        </h2>
        {germTests.length === 0 ? (
          <p className="text-sm text-farm-muted">No germ tests logged yet.</p>
        ) : (
          <ul className="divide-y divide-farm-muted/20">
            {germTests.map((t) => (
              <li key={t.id} className="py-2 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-farm-dark">
                    {t.germination_pct}% on {t.tested_on}
                    {t.seeds_tested != null && ` (${t.seeds_tested} tested)`}
                  </div>
                  {t.notes && <div className="text-xs text-farm-muted">{t.notes}</div>}
                </div>
                <button onClick={() => deleteGermTest(t.id)} className="text-xs text-red-700 px-2 py-1 min-h-[44px]">
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="pt-4 border-t border-farm-muted/20">
        {sowings.length === 0 ? (
          <button onClick={deleteSeed} className="w-full text-red-700 text-sm py-2 min-h-[44px]">
            Delete seed entry
          </button>
        ) : (
          <p className="text-xs text-farm-muted text-center">
            Set status to “Discarded” above to archive this seed without losing its sowing history.
          </p>
        )}
      </section>

      {sowingModalOpen && (
        <LogSowingModal
          seedId={seed.id}
          quantityUnit={seed.quantity_unit}
          plantingOptions={plantingOptions}
          onClose={() => setSowingModalOpen(false)}
          onSaved={() => { setSowingModalOpen(false); router.refresh(); }}
        />
      )}
      {germModalOpen && (
        <LogGermTestModal
          seedId={seed.id}
          onClose={() => setGermModalOpen(false)}
          onSaved={() => { setGermModalOpen(false); router.refresh(); }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Build check + commit**

```bash
npm run build
git add src/app/admin/seeds/\[seedId\]/ src/components/admin/seeds/SeedForm.tsx
git commit -m "feat(admin): seed detail page with edit form and history lists

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 10: Sowing and germ-test modals

**Files:**
- Create: `src/components/admin/seeds/LogSowingModal.tsx`
- Create: `src/components/admin/seeds/LogGermTestModal.tsx`

- [ ] **Step 1: Write the sowing modal**

Create `src/components/admin/seeds/LogSowingModal.tsx`:

```typescript
"use client";

import { useState } from "react";

interface Props {
  seedId: string;
  quantityUnit: string;
  plantingOptions: Array<{ id: string; crop_name: string; variety: string | null; sow_date: string | null }>;
  onClose: () => void;
  onSaved: () => void;
  defaultPlantingId?: string;
}

export function LogSowingModal({ seedId, quantityUnit, plantingOptions, onClose, onSaved, defaultPlantingId }: Props) {
  const [amount, setAmount] = useState("");
  const [plantingId, setPlantingId] = useState(defaultPlantingId ?? "");
  const [sownOn, setSownOn] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/seeds/${seedId}/sowings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount_used: Number(amount),
        planting_id: plantingId || null,
        sown_on: sownOn,
        notes: notes || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Save failed");
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-md w-full max-w-md p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-farm-dark">Log sowing</h2>
          <button onClick={onClose} className="text-farm-muted min-h-[44px] min-w-[44px]">✕</button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-farm-muted uppercase tracking-wide">
              Amount ({quantityUnit})
            </span>
            <input
              type="number" min="0" step="0.01" required value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-farm-muted/30 rounded-md text-sm mt-1"
              autoFocus
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-farm-muted uppercase tracking-wide">Planting (optional)</span>
            <select
              value={plantingId}
              onChange={(e) => setPlantingId(e.target.value)}
              className="w-full px-3 py-2 border border-farm-muted/30 rounded-md text-sm mt-1 bg-white"
            >
              <option value="">— none —</option>
              {plantingOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.crop_name}{p.variety ? ` (${p.variety})` : ""}{p.sow_date ? ` · ${p.sow_date}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-farm-muted uppercase tracking-wide">Sown on</span>
            <input
              type="date" required value={sownOn}
              onChange={(e) => setSownOn(e.target.value)}
              className="w-full px-3 py-2 border border-farm-muted/30 rounded-md text-sm mt-1"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-farm-muted uppercase tracking-wide">Notes</span>
            <textarea
              rows={2} value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-farm-muted/30 rounded-md text-sm mt-1"
            />
          </label>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button
            type="submit" disabled={saving}
            className="w-full bg-farm-green text-white py-2 rounded-md font-medium min-h-[44px] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Log sowing"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the germ test modal**

Create `src/components/admin/seeds/LogGermTestModal.tsx`:

```typescript
"use client";

import { useState } from "react";

interface Props {
  seedId: string;
  onClose: () => void;
  onSaved: () => void;
}

export function LogGermTestModal({ seedId, onClose, onSaved }: Props) {
  const [pct, setPct] = useState("");
  const [seedsTested, setSeedsTested] = useState("");
  const [testedOn, setTestedOn] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/seeds/${seedId}/germ-tests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        germination_pct: Number(pct),
        seeds_tested: seedsTested ? Number(seedsTested) : null,
        tested_on: testedOn,
        notes: notes || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Save failed");
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-md w-full max-w-md p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-farm-dark">Log germination test</h2>
          <button onClick={onClose} className="text-farm-muted min-h-[44px] min-w-[44px]">✕</button>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-farm-muted uppercase tracking-wide">Germination %</span>
            <input
              type="number" min="0" max="100" step="1" required value={pct}
              onChange={(e) => setPct(e.target.value)}
              className="w-full px-3 py-2 border border-farm-muted/30 rounded-md text-sm mt-1"
              autoFocus
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-farm-muted uppercase tracking-wide">Seeds tested (optional)</span>
            <input
              type="number" min="1" step="1" value={seedsTested}
              onChange={(e) => setSeedsTested(e.target.value)}
              className="w-full px-3 py-2 border border-farm-muted/30 rounded-md text-sm mt-1"
              placeholder="e.g. 20"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-farm-muted uppercase tracking-wide">Tested on</span>
            <input
              type="date" required value={testedOn}
              onChange={(e) => setTestedOn(e.target.value)}
              className="w-full px-3 py-2 border border-farm-muted/30 rounded-md text-sm mt-1"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-farm-muted uppercase tracking-wide">Notes</span>
            <textarea
              rows={2} value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-farm-muted/30 rounded-md text-sm mt-1"
            />
          </label>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button
            type="submit" disabled={saving}
            className="w-full bg-farm-green text-white py-2 rounded-md font-medium min-h-[44px] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Log germ test"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build check + commit**

```bash
npm run build
git add src/components/admin/seeds/LogSowingModal.tsx src/components/admin/seeds/LogGermTestModal.tsx
git commit -m "feat(admin): log sowing + germ test modals

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 11: Add-seed flow (`/admin/seeds/new`)

**Files:**
- Create: `src/app/admin/seeds/new/page.tsx`
- Create: `src/app/admin/seeds/new/NewSeedClient.tsx`

- [ ] **Step 1: Write the server page**

Create `src/app/admin/seeds/new/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { SEEDS_ENABLED } from "@/lib/constants";
import { NewSeedClient } from "./NewSeedClient";

export const dynamic = "force-dynamic";

export default async function NewSeedPage() {
  if (!SEEDS_ENABLED) redirect("/admin/dashboard");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") redirect("/");

  const admin = createAdminClient();
  const { data: items } = await (admin as any)
    .from("items").select("id, name, category")
    .eq("is_archived", false)
    .order("category").order("name");

  return (
    <main className="pb-24">
      <EditorialHero
        eyebrow="Inventory"
        title="Add Seed"
        flower="dill"
        backHref="/admin/seeds"
      />
      <div className="px-4 py-6 max-w-3xl mx-auto">
        <NewSeedClient items={(items ?? []) as Array<{ id: string; name: string; category: string }>} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Write the client form**

Create `src/app/admin/seeds/new/NewSeedClient.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SEED_QUANTITY_UNIT_SUGGESTIONS, SEED_STATUSES, SEED_STATUS_LABELS } from "@/lib/constants";

interface Props {
  items: Array<{ id: string; name: string; category: string }>;
}

export function NewSeedClient({ items }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    item_id: "",
    variety: "",
    initial_quantity: "",
    quantity_unit: "packets",
    packed_for_year: String(new Date().getFullYear()),
    purchase_date: "",
    supplier: "",
    cost: "",
    status: "active" as (typeof SEED_STATUSES)[number],
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/seeds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item_id: form.item_id,
        variety: form.variety,
        initial_quantity: Number(form.initial_quantity),
        quantity_unit: form.quantity_unit,
        packed_for_year: form.packed_for_year === "" ? null : Number(form.packed_for_year),
        purchase_date: form.purchase_date || null,
        supplier: form.supplier || null,
        cost: form.cost === "" ? null : Number(form.cost),
        status: form.status,
        notes: form.notes || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Save failed");
      return;
    }
    const { seed } = await res.json();
    router.push(`/admin/seeds/${seed.id}`);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="text-xs font-medium text-farm-muted uppercase tracking-wide">Crop</span>
        <select
          required value={form.item_id}
          onChange={(e) => setForm({ ...form, item_id: e.target.value })}
          className="w-full px-3 py-2 border border-farm-muted/30 rounded-md text-sm mt-1 bg-white"
        >
          <option value="">— choose —</option>
          {items.map((it) => (
            <option key={it.id} value={it.id}>{it.name} ({it.category})</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-medium text-farm-muted uppercase tracking-wide">Variety</span>
        <input
          type="text" required value={form.variety}
          onChange={(e) => setForm({ ...form, variety: e.target.value })}
          className="w-full px-3 py-2 border border-farm-muted/30 rounded-md text-sm mt-1"
          placeholder="e.g. Genovese, Cherokee Purple"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-farm-muted uppercase tracking-wide">Quantity</span>
          <input
            type="number" min="0" step="0.01" required value={form.initial_quantity}
            onChange={(e) => setForm({ ...form, initial_quantity: e.target.value })}
            className="w-full px-3 py-2 border border-farm-muted/30 rounded-md text-sm mt-1"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-farm-muted uppercase tracking-wide">Unit</span>
          <input
            type="text" required list="seed-unit-suggestions" value={form.quantity_unit}
            onChange={(e) => setForm({ ...form, quantity_unit: e.target.value })}
            className="w-full px-3 py-2 border border-farm-muted/30 rounded-md text-sm mt-1"
          />
          <datalist id="seed-unit-suggestions">
            {SEED_QUANTITY_UNIT_SUGGESTIONS.map((u) => <option key={u} value={u} />)}
          </datalist>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-farm-muted uppercase tracking-wide">Packed for</span>
          <input
            type="number" min="2000" max="2100" value={form.packed_for_year}
            onChange={(e) => setForm({ ...form, packed_for_year: e.target.value })}
            className="w-full px-3 py-2 border border-farm-muted/30 rounded-md text-sm mt-1"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-farm-muted uppercase tracking-wide">Purchased</span>
          <input
            type="date" value={form.purchase_date}
            onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
            className="w-full px-3 py-2 border border-farm-muted/30 rounded-md text-sm mt-1"
          />
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-farm-muted uppercase tracking-wide">Supplier</span>
        <input
          type="text" value={form.supplier}
          onChange={(e) => setForm({ ...form, supplier: e.target.value })}
          className="w-full px-3 py-2 border border-farm-muted/30 rounded-md text-sm mt-1"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-farm-muted uppercase tracking-wide">Cost (USD)</span>
        <input
          type="number" min="0" step="0.01" value={form.cost}
          onChange={(e) => setForm({ ...form, cost: e.target.value })}
          className="w-full px-3 py-2 border border-farm-muted/30 rounded-md text-sm mt-1"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-farm-muted uppercase tracking-wide">Status</span>
        <select
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
          className="w-full px-3 py-2 border border-farm-muted/30 rounded-md text-sm mt-1 bg-white"
        >
          {SEED_STATUSES.map((s) => <option key={s} value={s}>{SEED_STATUS_LABELS[s]}</option>)}
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-medium text-farm-muted uppercase tracking-wide">Notes</span>
        <textarea
          rows={3} value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="w-full px-3 py-2 border border-farm-muted/30 rounded-md text-sm mt-1"
        />
      </label>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <button
        type="submit" disabled={saving}
        className="w-full bg-farm-green text-white py-3 rounded-md font-medium min-h-[44px] disabled:opacity-50"
      >
        {saving ? "Saving…" : "Create seed"}
      </button>
    </form>
  );
}
```

- [ ] **Step 3: Build check + commit**

```bash
npm run build
git add src/app/admin/seeds/new/
git commit -m "feat(admin): /admin/seeds/new add-seed page

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 12: Data import/export page

**Files:**
- Create: `src/app/admin/seeds/data/page.tsx`
- Create: `src/app/admin/seeds/data/SeedsDataClient.tsx`

- [ ] **Step 1: Write the server page**

Create `src/app/admin/seeds/data/page.tsx`:

```typescript
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { SEEDS_ENABLED } from "@/lib/constants";
import { SeedsDataClient } from "./SeedsDataClient";

export const dynamic = "force-dynamic";

export default async function SeedsDataPage() {
  if (!SEEDS_ENABLED) redirect("/admin/dashboard");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") redirect("/");

  const admin = createAdminClient();
  const [{ count: totalCount }, { count: activeCount }] = await Promise.all([
    (admin as any).from("seeds").select("*", { count: "exact", head: true }),
    (admin as any).from("seeds").select("*", { count: "exact", head: true }).eq("status", "active"),
  ]);

  return (
    <main className="pb-24">
      <header className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/admin/seeds" className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 text-white/70 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="page-title">Seeds · Data</h1>
        </div>
      </header>

      <EditorialHero
        eyebrow="Inventory"
        title="Import & Export"
        subtitle="Round-trip your seed inventory through CSV."
        flower="chamomile"
        backHref="/admin/seeds"
      />

      <div className="px-4 py-6 max-w-3xl mx-auto">
        <SeedsDataClient totalCount={totalCount ?? 0} activeCount={activeCount ?? 0} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Write the client component**

Create `src/app/admin/seeds/data/SeedsDataClient.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  totalCount: number;
  activeCount: number;
}

interface ImportResult {
  imported: number;
  updated: number;
  errors: Array<{ row: number; message: string }>;
}

export function SeedsDataClient({ totalCount, activeCount }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"export" | "import">("export");
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runImport() {
    if (!file) return;
    setImporting(true);
    setError(null);
    setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/import/seeds-csv", { method: "POST", body: fd });
    setImporting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Import failed");
      return;
    }
    const data = (await res.json()) as ImportResult;
    setResult(data);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 text-center text-xs">
        <div className="border border-farm-muted/20 rounded-md py-2">
          <div className="text-lg font-semibold">{totalCount}</div>
          <div className="text-farm-muted">Total</div>
        </div>
        <div className="border border-farm-muted/20 rounded-md py-2">
          <div className="text-lg font-semibold">{activeCount}</div>
          <div className="text-farm-muted">Active</div>
        </div>
      </div>

      <div className="flex border-b border-farm-muted/20">
        <button
          onClick={() => setTab("export")}
          className={`flex-1 py-2 text-sm font-medium min-h-[44px] ${tab === "export" ? "text-farm-green border-b-2 border-farm-green" : "text-farm-muted"}`}
        >
          Export
        </button>
        <button
          onClick={() => setTab("import")}
          className={`flex-1 py-2 text-sm font-medium min-h-[44px] ${tab === "import" ? "text-farm-green border-b-2 border-farm-green" : "text-farm-muted"}`}
        >
          Import
        </button>
      </div>

      {tab === "export" ? (
        <div className="space-y-3">
          <p className="text-sm text-farm-muted">
            Downloads every seed (including discarded). Edit in a spreadsheet and re-import to update.
            The <code className="text-xs">id</code> column is the upsert key — leave blank on new rows.
          </p>
          <a
            href="/api/seeds/export"
            className="block w-full bg-farm-green text-white py-3 rounded-md font-medium text-center min-h-[44px]"
          >
            Download CSV
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-farm-muted">
            CSV columns:{" "}
            <code className="text-xs">id, item_name, variety, initial_quantity, quantity_unit, packed_for_year, purchase_date, supplier, cost, status, notes</code>.
            Unknown <code className="text-xs">item_name</code> values are reported as errors — add the item to the catalog first.
          </p>
          <input
            type="file" accept=".csv,.xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
          <button
            onClick={runImport} disabled={!file || importing}
            className="w-full bg-farm-green text-white py-3 rounded-md font-medium min-h-[44px] disabled:opacity-50"
          >
            {importing ? "Importing…" : "Import"}
          </button>
          {error && <p className="text-sm text-red-700">{error}</p>}
          {result && (
            <div className="bg-farm-cream/40 p-3 rounded-md text-sm space-y-2">
              <div>
                <strong>{result.imported}</strong> new · <strong>{result.updated}</strong> updated
                {result.errors.length > 0 && <> · <strong className="text-red-700">{result.errors.length}</strong> errors</>}
              </div>
              {result.errors.length > 0 && (
                <ul className="text-xs space-y-1 max-h-48 overflow-y-auto">
                  {result.errors.map((e, i) => (
                    <li key={i}>Row {e.row}: {e.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Build check + commit**

```bash
npm run build
git add src/app/admin/seeds/data/
git commit -m "feat(admin): /admin/seeds/data CSV import/export page

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 13: Dashboard card + planting linkage

**Files:**
- Modify: `src/app/admin/dashboard/page.tsx`
- Modify: planting detail page (locate via grep)

- [ ] **Step 1: Add the Seeds card to the dashboard's Farm Management group**

Open `src/app/admin/dashboard/page.tsx`. Locate the "Farm Management" group's `cards` array (around line 117). Add a Seeds entry right after Crop Plan. Import `SEEDS_ENABLED` at the top of the file.

Concretely, change:

```typescript
{ href: "/admin/items", title: "Items", description: "Catalog & photos", flower: "nasturtium" },
{ href: "/admin/crop-plan", title: "Crop Plan", description: "Seasonal schedule", flower: "squash-bud" },
{ href: "/admin/labor", title: "Labor", description: "Track hours", flower: "lavender" },
```

To:

```typescript
{ href: "/admin/items", title: "Items", description: "Catalog & photos", flower: "nasturtium" },
{ href: "/admin/crop-plan", title: "Crop Plan", description: "Seasonal schedule", flower: "squash-bud" },
...(SEEDS_ENABLED ? [{ href: "/admin/seeds", title: "Seeds", description: "Variety inventory", flower: "fennel" } as const] : []),
{ href: "/admin/labor", title: "Labor", description: "Track hours", flower: "lavender" },
```

And add at the top of the file (next to other lib imports):

```typescript
import { SEEDS_ENABLED } from "@/lib/constants";
```

If the surrounding code uses a more typed shape than the inline literal (e.g. a typed array), wrap the splice in a way that satisfies that type — the card array element shape is `{ href: string; title: string; description: string; flower: string }`. Cast if needed: `as { href: string; title: string; description: string; flower: string }`.

- [ ] **Step 2: Locate the planting detail page**

Run: `find src/app/admin/crop-plan -name "page.tsx"` (or grep)

Expected: locates the planting detail page (likely `src/app/admin/crop-plan/plantings/[id]/page.tsx` or similar). Note the exact path.

```bash
ls -la src/app/admin/crop-plan/
```

- [ ] **Step 3: Add the optional seed picker + "Log sowing of this seed" shortcut to the planting form/detail**

In the planting form (likely a client component near the planting detail page), add (if not already present) a Seed picker:

```typescript
// Add to the planting form's state
const [seedId, setSeedId] = useState<string | null>(initialPlanting.seed_id ?? null);

// Add to the props/server load: fetch active seeds for this item_id
//   const { data: activeSeeds } = await (admin as any)
//     .from("seeds")
//     .select("id, variety")
//     .eq("status", "active")
//     .eq("item_id", planting.item_id);
//
// Pass `activeSeeds` to the client form as a prop.

// In the form JSX, conditional on planting_stock === "seeds":
{form.planting_stock === "seeds" && SEEDS_ENABLED && (
  <label className="block">
    <span className="text-xs font-medium text-farm-muted uppercase tracking-wide">Seed (optional)</span>
    <select
      value={seedId ?? ""}
      onChange={(e) => setSeedId(e.target.value || null)}
      className="w-full px-3 py-2 border border-farm-muted/30 rounded-md text-sm mt-1 bg-white"
    >
      <option value="">— none —</option>
      {activeSeeds.map((s) => (
        <option key={s.id} value={s.id}>{s.variety}</option>
      ))}
    </select>
  </label>
)}

// Include seed_id in the PATCH/POST body when saving the planting.
```

And, on the planting detail VIEW (not form), if `planting.seed_id` is set and `SEEDS_ENABLED`:

```typescript
{SEEDS_ENABLED && planting.seed_id && (
  <button
    onClick={() => setLogSowingFor(planting.seed_id)}
    className="bg-farm-green text-white py-2 px-4 rounded-md text-sm font-medium min-h-[44px]"
  >
    Log sowing of this seed
  </button>
)}

// And render <LogSowingModal /> with defaultPlantingId={planting.id}.
```

This is intentionally light-touch and additive — the exact integration code depends on the planting page structure at implementation time. If the planting page is too large to safely modify in one task, defer this integration to a follow-up task and ship Tasks 1–12 + 14 first. **Do not block the rollout on this.**

- [ ] **Step 4: Build check + commit**

```bash
npm run build
git add src/app/admin/dashboard/page.tsx src/app/admin/crop-plan/
git commit -m "feat(admin): seeds dashboard card + optional planting linkage

Both gated on SEEDS_ENABLED — invisible until the flag is flipped.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 14: Manual verification + flip the flag

**Files:**
- Modify: `src/lib/constants.ts` (flag flip)
- Possibly modify: `tests/smoke.spec.ts` (optional smoke check)

- [ ] **Step 1: Confirm migration 046 ran in production**

Before touching the flag, verify with Micheal that `046_seed_inventory.sql` was executed in the Supabase SQL editor. Check by running this SELECT in the dashboard:

```sql
SELECT count(*) FROM seeds;
SELECT count(*) FROM seed_sowings;
SELECT count(*) FROM seed_germination_tests;
SELECT count(*) FROM seeds_with_on_hand;
SELECT column_name FROM information_schema.columns WHERE table_name='plantings' AND column_name='seed_id';
```

Expected: all five queries return successfully (count = 0 for the first four, one row for the last). If any error, the migration didn't run completely.

- [ ] **Step 2: Run local dev and smoke-test the feature manually**

Run: `npm run dev`

Walk through this checklist on `localhost:3000` (admin login):
- `/admin/dashboard` does NOT yet show the Seeds card (flag still false)
- Temporarily flip `SEEDS_ENABLED` to `true` in a scratch edit (do NOT commit yet)
- Reload dashboard → Seeds card appears
- Tap → `/admin/seeds` loads, empty state visible
- "+ Add seed" → fill form (pick any item, variety "Test", 5 packets, 2026, etc.) → submit
- Redirected to detail page; on_hand = 5
- "Log sowing" → 2 packets, no planting, today, submit
- Page refreshes; on_hand = 3, sowing visible in history
- "Log germ test" → 85%, 20 tested, today, submit
- Germ test visible in history; row card shows 85% germ
- `/admin/seeds/data` → click "Download CSV" → CSV downloads with the seed
- Edit the CSV (change quantity to 10) → re-upload → result shows "1 updated"
- Back on detail → on_hand recomputed to 8 (10 initial − 2 sown)
- Delete the test seed (after deleting its sowing first, OR set status='discarded')

If any step fails, do NOT proceed to Step 3 — fix the bug, commit, retest.

- [ ] **Step 3: Revert the scratch flip if it's still active**

If you modified `constants.ts` during testing, ensure the file is clean.

Run: `git status` and `git diff src/lib/constants.ts`

Expected: no changes. If there are, revert with `git checkout src/lib/constants.ts`.

- [ ] **Step 4: (Optional) Add a smoke test entry**

Check `tests/smoke.spec.ts` exists and inspect its pattern:

```bash
ls tests/ && head -50 tests/smoke.spec.ts
```

If it covers other admin pages (items, expenses, deliveries), add an analogous check that `/admin/seeds` returns 200 (or 307 if not logged in — match the existing pattern). If the smoke suite isn't set up for authenticated admin pages, skip this step.

- [ ] **Step 5: Flip the flag and ship**

Edit `src/lib/constants.ts`:

```typescript
export const SEEDS_ENABLED = true;
```

Run: `npm run build`
Expected: clean build.

- [ ] **Step 6: Commit and push**

```bash
git add src/lib/constants.ts
git commit -m "$(cat <<'EOF'
feat(seeds): flip SEEDS_ENABLED to true — feature is live

Migration 046 confirmed run in production. All seed inventory routes,
pages, and dashboard card are now visible to admin.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
git push origin main
```

Watch Vercel for a clean deploy. If anything breaks in prod, immediately revert by setting the flag back to `false` and pushing — the data is safe (migration stays, no destructive operations).

---

## Cross-Task Conventions Reminder

- Every API route checks `auth.users` + `profiles.role === 'admin'` before any DB call.
- Use `(supabase as any)` casts where generated types lag — this is standard in the codebase.
- `createAdminClient()` is server-only — never imported in client components.
- Run `npm run build` before every commit.
- Conventional commit prefixes: `feat:`, `fix:`, `chore:`, `docs:`.
- Trailer: `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`.
- Mobile-first — every interactive element ≥ 44×44px.
- Brand palette only — `farm-green`, `farm-cream`, `farm-dark`, `farm-muted`, plus amber/red for warnings.

## Spec Coverage Check

| Spec section | Implemented in task(s) |
|---|---|
| Architecture & routes | 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 |
| Migration 046 (schema + view + planting FK) | 1 |
| Types + feature flag | 2 |
| `/admin/seeds` list page | 8 |
| `/admin/seeds/[id]` detail with edit + history | 9, 10 |
| `/admin/seeds/new` add flow | 11 |
| `/admin/seeds/data` import/export | 7, 12 |
| Sowing log API + UI | 5, 9, 10 |
| Germination test API + UI | 6, 9, 10 |
| Status/warnings/computed state | view in 1, rendered in 8 + 9 |
| Planting linkage (`plantings.seed_id` + picker + shortcut) | 1 (FK), 13 (UI) |
| Rollout via `SEEDS_ENABLED` | 2 (flag), 8/9/11/12 (gates), 14 (flip) |
| Build verification gate | every task step |
