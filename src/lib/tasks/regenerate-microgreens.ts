/**
 * Materialize the microgreens sow plan into farm_tasks rows.
 *
 * Pattern: idempotent upsert by generator_key + supersede pass.
 *   - Each SowTask / AdvanceTask / HarvestTask from computeSowPlan() maps to
 *     a stable generator_key. INSERT ... ON CONFLICT DO NOTHING means the
 *     same crop+date never produces two rows.
 *   - After upsert, we collect every key produced this run. Any open task
 *     with source='microgreens-auto' whose key is NOT in this set is marked
 *     status='superseded' so demand changes propagate.
 *
 * Idempotent: safe to run hourly. Volume is small (Press Farm has ~10 crops
 * × ~5 deliveries in horizon = ~50 sow tasks max). No batching needed.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { computeSowPlan } from "@/lib/microgreens/sowPlan";
import { PLAN_HORIZON_DAYS } from "@/lib/microgreens/constants";
import type {
  AdvanceTask,
  HarvestTask,
  SowTask,
} from "@/lib/microgreens/types";
import { todayIso } from "./dates";

type AdminClient = ReturnType<typeof createAdminClient>;

interface TaskRow {
  farm_id: string;
  title: string;
  description: string | null;
  type: "sow" | "harvest" | "maintenance";
  source: "microgreens-auto";
  source_ref: Record<string, unknown>;
  generator_key: string;
  due_date: string;
  priority: 1 | 2;
  status: "open";
  microgreen_crop_id: string | null;
  microgreen_batch_id: string | null;
  item_id: string | null;
}

function sowTaskRow(farmId: string, task: SowTask, today: string): TaskRow {
  const summary = task.expected_demands
    .map((d) => `${d.quantity} ${d.unit.toUpperCase()}`)
    .join(" + ");
  return {
    farm_id: farmId,
    title: `Sow ${task.trays_to_sow} tray${task.trays_to_sow === 1 ? "" : "s"} ${task.crop.name}`,
    description: `For delivery ${task.delivery_date}. Demand: ${summary || "trays-only"}.${
      task.missing_yield_config ? " ⚠ Missing yield_per_tray config." : ""
    }`,
    type: "sow",
    source: "microgreens-auto",
    source_ref: {
      crop_id: task.crop.id,
      delivery_date: task.delivery_date,
      trays_to_sow: task.trays_to_sow,
      trays_needed: task.trays_needed,
      trays_in_flight: task.trays_in_flight,
      expected_demands: task.expected_demands,
    },
    generator_key: `mg:sow:${task.crop.id}:${task.delivery_date}`,
    due_date: task.sow_date,
    priority: task.sow_date <= today ? 1 : 2,
    status: "open",
    microgreen_crop_id: task.crop.id,
    microgreen_batch_id: null,
    item_id: task.crop.item_id,
  };
}

function advanceTaskRow(farmId: string, task: AdvanceTask, today: string): TaskRow {
  return {
    farm_id: farmId,
    title: `Move ${task.crop.name} tray ${task.tray.tray_label} → ${task.to_status}`,
    description: `Transition from ${task.from_status} to ${task.to_status}.`,
    type: "maintenance",
    source: "microgreens-auto",
    source_ref: {
      tray_id: task.tray.id,
      from_status: task.from_status,
      to_status: task.to_status,
    },
    generator_key: `mg:advance:${task.tray.id}:${task.to_status}`,
    due_date: today,
    priority: 1,
    status: "open",
    microgreen_crop_id: task.crop.id,
    microgreen_batch_id: task.tray.batch_id,
    item_id: task.crop.item_id,
  };
}

function harvestTaskRow(farmId: string, task: HarvestTask, today: string): TaskRow {
  return {
    farm_id: farmId,
    title: `Harvest ${task.crop.name} tray ${task.tray.tray_label}`,
    description:
      task.kind === "continuous-ongoing"
        ? "Continuous harvest — ongoing cuts."
        : `Single-cut harvest. ${task.days_since_sow}d since sow.`,
    type: "harvest",
    source: "microgreens-auto",
    source_ref: {
      tray_id: task.tray.id,
      kind: task.kind,
      days_since_sow: task.days_since_sow,
    },
    generator_key: `mg:harvest:${task.tray.id}:${task.tray.sow_date}`,
    due_date: today,
    priority: 1,
    status: "open",
    microgreen_crop_id: task.crop.id,
    microgreen_batch_id: task.tray.batch_id,
    item_id: task.crop.item_id,
  };
}

export interface RegenerateResult {
  generated: number;
  inserted: number;
  superseded: number;
}

export async function regenerateMicrogreensTasks(
  admin: AdminClient,
  farmId: string,
  now: Date = new Date(),
): Promise<RegenerateResult> {
  const today = todayIso(now);
  const horizonDate = new Date(now.getTime() + PLAN_HORIZON_DAYS * 24 * 3600 * 1000);
  const horizonIso = todayIso(horizonDate);
  const lookbackStart = new Date(now.getTime() - 60 * 24 * 3600 * 1000);
  const lookbackIso = todayIso(lookbackStart);

  const [crops, demand, batches, trays, deliveryDates, history] = await Promise.all([
    (admin as any).from("microgreen_crops").select("*").eq("is_active", true),
    (admin as any).from("microgreen_demand").select("*"),
    (admin as any).from("microgreen_batches").select("*"),
    (admin as any).from("microgreen_trays").select("*"),
    (admin as any)
      .from("delivery_dates")
      .select("date")
      .gte("date", today)
      .lte("date", horizonIso),
    (admin as any)
      .from("delivery_items")
      .select("item_id, quantity_oz, deliveries!inner(delivery_date)")
      .gte("deliveries.delivery_date", lookbackIso),
  ]);

  const historicalDeliveryItems = (history.data ?? [])
    .map((row: any) => ({
      item_id: row.item_id,
      quantity_oz: Number(row.quantity_oz ?? 0),
      delivery_date: row.deliveries?.delivery_date,
    }))
    .filter((r: any) => r.delivery_date);

  const plan = computeSowPlan({
    crops: crops.data ?? [],
    demand: demand.data ?? [],
    batches: batches.data ?? [],
    trays: trays.data ?? [],
    deliveryDates: (deliveryDates.data ?? []).map((d: any) => d.date),
    historicalDeliveryItems,
    now,
  });

  const rows: TaskRow[] = [];
  for (const t of [...plan.sow_today, ...plan.overdue.sow]) {
    rows.push(sowTaskRow(farmId, t, today));
  }
  for (const t of [...plan.advance_today, ...plan.overdue.advance]) {
    rows.push(advanceTaskRow(farmId, t, today));
  }
  for (const t of [...plan.harvest_today, ...plan.overdue.harvest]) {
    rows.push(harvestTaskRow(farmId, t, today));
  }

  // Upsert each row. ON CONFLICT DO NOTHING via generator_key UNIQUE means
  // re-running cron doesn't duplicate. We don't bulk-upsert here because
  // Supabase's onConflict + ignoreDuplicates needs the unique-constraint name
  // to match exactly, and we want simple semantics.
  let inserted = 0;
  if (rows.length > 0) {
    const { data: insertedRows, error } = await (admin as any)
      .from("farm_tasks")
      .upsert(rows, { onConflict: "generator_key", ignoreDuplicates: true })
      .select("id");
    if (error) {
      console.error("[TASKS] microgreens upsert failed", error);
    } else {
      inserted = insertedRows?.length ?? 0;
    }
  }

  // Supersession: any open microgreens-auto task whose generator_key wasn't
  // produced this run is now stale.
  const activeKeys = rows.map((r) => r.generator_key);
  let superseded = 0;
  if (activeKeys.length > 0) {
    const { data: supRows, error: supErr } = await (admin as any)
      .from("farm_tasks")
      .update({
        status: "superseded",
        superseded_at: new Date().toISOString(),
        superseded_reason: "no longer in sow plan",
      })
      .eq("source", "microgreens-auto")
      .eq("status", "open")
      .not("generator_key", "in", `(${activeKeys.join(",")})`)
      .select("id");
    if (supErr) {
      console.error("[TASKS] microgreens supersede failed", supErr);
    } else {
      superseded = supRows?.length ?? 0;
    }
  } else {
    // No active sow plan output at all → supersede every open microgreens-auto task.
    const { data: supRows, error: supErr } = await (admin as any)
      .from("farm_tasks")
      .update({
        status: "superseded",
        superseded_at: new Date().toISOString(),
        superseded_reason: "sow plan empty",
      })
      .eq("source", "microgreens-auto")
      .eq("status", "open")
      .select("id");
    if (!supErr) superseded = supRows?.length ?? 0;
  }

  return { generated: rows.length, inserted, superseded };
}
