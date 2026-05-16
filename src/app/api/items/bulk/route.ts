import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BULK_ACTIONS = [
  "archive",
  "unarchive",
  "delete",
  "flag-event",
  "unflag-event",
  "flag-press-bar",
  "unflag-press-bar",
] as const;
type BulkAction = (typeof BULK_ACTIONS)[number];

/**
 * POST /api/items/bulk
 * Body: { ids: string[], action: BulkAction }
 * Admin only.
 *
 * archive/unarchive: bulk UPDATE items.is_archived. Returns { updated }.
 *
 * flag-event/unflag-event: bulk UPDATE items.is_event_item. The flag
 * drives the receiver dashboard's "For Events" section grouping — when
 * cleared, the item shows in the regular section again. Returns { updated }.
 *
 * flag-press-bar/unflag-press-bar: bulk UPDATE items.is_press_bar_item.
 * Mirrors flag-event for the Press Bar menu placement (migration 028).
 * Returns { updated }.
 *
 * delete: hard DELETE per row. Postgres FK constraints reject deletes
 * for items referenced by order_items (via availability_items) or
 * price_catalog — those are returned in `failed` so the client can
 * offer to archive them instead. Items with only delivery_items /
 * availability_items / price_history references DO delete (their
 * dependent rows cascade), which is destructive — the UI guards this
 * behind an explicit confirmation. Returns { deleted, failed }.
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

  let body: { ids?: unknown; action?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "ids must be a non-empty string array" }, { status: 400 });
  }

  const action = body.action as BulkAction;
  if (!BULK_ACTIONS.includes(action)) {
    return NextResponse.json({ error: `action must be one of: ${BULK_ACTIONS.join(", ")}` }, { status: 400 });
  }

  const admin = createAdminClient();

  if (action === "archive" || action === "unarchive") {
    const { data, error } = await (admin as any)
      .from("items")
      .update({ is_archived: action === "archive" })
      .in("id", ids)
      .select("id");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ updated: (data ?? []).length });
  }

  if (action === "flag-event" || action === "unflag-event") {
    const { data, error } = await (admin as any)
      .from("items")
      .update({ is_event_item: action === "flag-event" })
      .in("id", ids)
      .select("id");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ updated: (data ?? []).length });
  }

  if (action === "flag-press-bar" || action === "unflag-press-bar") {
    const { data, error } = await (admin as any)
      .from("items")
      .update({ is_press_bar_item: action === "flag-press-bar" })
      .in("id", ids)
      .select("id");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ updated: (data ?? []).length });
  }

  // ── action === "delete" ──────────────────────────────────────────
  // Look up names up-front so the per-item failure list is human-readable.
  const { data: nameRows } = await (admin as any)
    .from("items")
    .select("id, name")
    .in("id", ids);
  const nameById = new Map<string, string>(
    (nameRows ?? []).map((r: any) => [r.id, r.name]),
  );

  // Per-item DELETE — bulk .in() would roll back the whole batch on the
  // first FK violation, so we issue one statement per id and capture
  // each result. Concurrency-capped at 8 to be a polite Supabase
  // citizen for very large batches.
  const CONCURRENCY = 8;
  const deletedIds: string[] = [];
  const failed: Array<{ id: string; name: string; reason: string }> = [];

  let cursor = 0;
  async function worker() {
    while (cursor < ids.length) {
      const my = cursor++;
      const id = ids[my];
      try {
        const { error } = await (admin as any).from("items").delete().eq("id", id);
        if (error) {
          // Translate the foreign-key error into something user-readable.
          const msg = String(error.message ?? "").toLowerCase();
          let reason = error.message ?? "Delete failed";
          if (msg.includes("foreign key")) {
            if (msg.includes("order_items")) {
              reason = "referenced by past orders";
            } else if (msg.includes("price_catalog")) {
              reason = "referenced by saved prices";
            } else if (msg.includes("availability_items")) {
              reason = "referenced by availability";
            } else {
              reason = "referenced by other records";
            }
          }
          failed.push({ id, name: nameById.get(id) ?? "(unknown)", reason });
        } else {
          deletedIds.push(id);
        }
      } catch (err: any) {
        failed.push({
          id,
          name: nameById.get(id) ?? "(unknown)",
          reason: err?.message ?? "Delete exception",
        });
      }
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, ids.length) }, () => worker());
  await Promise.all(workers);

  return NextResponse.json({ deleted: deletedIds.length, failed });
}
