import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAnthropicClient, ANTHROPIC_KEY_MISSING_ERROR } from "@/lib/anthropic/client";
import { draftItemContent, type DraftItemOutput } from "@/lib/anthropic/draft-item";

// Per-batch ceiling. Vercel Pro caps at 60s by default; with up to 8
// parallel Haiku calls each averaging ~2s, 30 items per batch fits
// comfortably even with retries.
const MAX_BATCH = 30;
const CONCURRENCY = 8;

export const maxDuration = 60;

interface BulkRequest {
  itemIds?: string[];
}

interface ItemRow {
  id: string;
  name: string;
  category: string;
  variety: string | null;
  color: string | null;
  source: string | null;
  chef_notes: string | null;
  growing_notes: string | null;
  season_note: string | null;
  days_to_maturity: number | null;
  sun_requirement: string | null;
  sow_method: string | null;
  sow_depth: string | null;
  plant_spacing: string | null;
}

type Status = "updated" | "skipped" | "error";

interface ResultEntry {
  id: string;
  name: string;
  status: Status;
  updated_fields?: string[];
  skip_reason?: string;
  error?: string;
}

/**
 * POST /api/ai/bulk-fill-items
 *
 * Admin-only. Takes a batch of item IDs, drafts content for each via
 * Claude Haiku 4.5 in parallel (capped concurrency), and applies the
 * draft to ONLY the empty fields on each item — never overwrites
 * admin-entered values. Returns a per-item result list.
 *
 * Designed to be called repeatedly by the bulk-fill page in batches of
 * up to MAX_BATCH IDs at a time so the whole catalog can be processed
 * without exceeding the Vercel function timeout.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((profile as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: BulkRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ids = (body.itemIds ?? []).filter((id) => typeof id === "string" && id.length > 0);
  if (ids.length === 0) {
    return NextResponse.json({ error: "itemIds required" }, { status: 400 });
  }
  if (ids.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `Batch too large: ${ids.length} > ${MAX_BATCH}. Split into smaller batches.` },
      { status: 400 },
    );
  }

  const client = getAnthropicClient();
  if (!client) {
    return NextResponse.json({ error: ANTHROPIC_KEY_MISSING_ERROR }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data: itemRows } = await (admin as any)
    .from("items")
    .select(
      "id, name, category, variety, color, source, chef_notes, growing_notes, season_note, days_to_maturity, sun_requirement, sow_method, sow_depth, plant_spacing",
    )
    .in("id", ids);

  const items = (itemRows ?? []) as ItemRow[];

  // Process with bounded concurrency. Promise.all on the whole batch
  // would fire all 30 in parallel — Anthropic rate-limits that hard, and
  // a 429 cascade ruins the batch. CONCURRENCY = 8 is well within Haiku
  // tier limits and keeps per-batch wall time around 4-8 seconds.
  const results: ResultEntry[] = [];
  let cursor = 0;
  // Pass `client` in explicitly so TS's null-narrowing from the guard
  // above survives the async closure boundary.
  async function worker(c: NonNullable<ReturnType<typeof getAnthropicClient>>): Promise<void> {
    while (cursor < items.length) {
      const myIndex = cursor++;
      const item = items[myIndex];
      results[myIndex] = await processOne(c, admin, item);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => worker(client)),
  );

  // Items requested but not found (deleted / archived between batches)
  const foundIds = new Set(items.map((i) => i.id));
  for (const id of ids) {
    if (!foundIds.has(id)) {
      results.push({ id, name: "(not found)", status: "skipped", skip_reason: "Item not found" });
    }
  }

  const summary = {
    requested: ids.length,
    processed: items.length,
    updated: results.filter((r) => r.status === "updated").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errored: results.filter((r) => r.status === "error").length,
  };

  return NextResponse.json({ summary, results });
}

async function processOne(
  client: NonNullable<ReturnType<typeof getAnthropicClient>>,
  admin: ReturnType<typeof createAdminClient>,
  item: ItemRow,
): Promise<ResultEntry> {
  // Skip if every field is already filled — nothing to do, no AI call.
  const emptyFields = listEmptyFields(item);
  if (emptyFields.length === 0) {
    return {
      id: item.id,
      name: item.name,
      status: "skipped",
      skip_reason: "All fields already filled",
    };
  }

  let draft: DraftItemOutput;
  try {
    draft = await draftItemContent(client as any, {
      name: item.name,
      variety: item.variety,
      color: item.color,
      category: item.category,
      source: item.source,
    });
  } catch (err: any) {
    return {
      id: item.id,
      name: item.name,
      status: "error",
      error: err?.message ?? "AI request failed",
    };
  }

  // Build the PATCH payload — only fields that are currently empty AND
  // the model returned a non-empty value for. Mirrors the single-item
  // form's "fill empty only" behavior so admin-entered values never get
  // clobbered.
  const updates: Record<string, unknown> = {};
  const updatedFields: string[] = [];

  if (!item.chef_notes && draft.chef_notes) {
    updates.chef_notes = draft.chef_notes;
    updatedFields.push("chef_notes");
  }
  if (!item.growing_notes && draft.growing_notes) {
    updates.growing_notes = draft.growing_notes;
    updatedFields.push("growing_notes");
  }
  if (!item.season_note && draft.season_note) {
    updates.season_note = draft.season_note;
    updatedFields.push("season_note");
  }
  if (!item.days_to_maturity && draft.days_to_maturity > 0) {
    updates.days_to_maturity = draft.days_to_maturity;
    updatedFields.push("days_to_maturity");
  }
  if (!item.sun_requirement && draft.sun_requirement) {
    updates.sun_requirement = draft.sun_requirement;
    updatedFields.push("sun_requirement");
  }
  if (!item.sow_method && draft.sow_method) {
    updates.sow_method = draft.sow_method;
    updatedFields.push("sow_method");
  }
  if (!item.sow_depth && draft.sow_depth) {
    updates.sow_depth = draft.sow_depth;
    updatedFields.push("sow_depth");
  }
  if (!item.plant_spacing && draft.plant_spacing) {
    updates.plant_spacing = draft.plant_spacing;
    updatedFields.push("plant_spacing");
  }

  if (updatedFields.length === 0) {
    return {
      id: item.id,
      name: item.name,
      status: "skipped",
      skip_reason: "Model returned no values for empty fields",
    };
  }

  const { error } = await (admin as any)
    .from("items")
    .update(updates)
    .eq("id", item.id);

  if (error) {
    return {
      id: item.id,
      name: item.name,
      status: "error",
      error: `DB update failed: ${error.message}`,
    };
  }

  return {
    id: item.id,
    name: item.name,
    status: "updated",
    updated_fields: updatedFields,
  };
}

function listEmptyFields(item: ItemRow): string[] {
  const out: string[] = [];
  if (!item.chef_notes) out.push("chef_notes");
  if (!item.growing_notes) out.push("growing_notes");
  if (!item.season_note) out.push("season_note");
  if (!item.days_to_maturity) out.push("days_to_maturity");
  if (!item.sun_requirement) out.push("sun_requirement");
  if (!item.sow_method) out.push("sow_method");
  if (!item.sow_depth) out.push("sow_depth");
  if (!item.plant_spacing) out.push("plant_spacing");
  return out;
}
