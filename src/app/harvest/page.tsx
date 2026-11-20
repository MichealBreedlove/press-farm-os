import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { aggregateHarvest, type HarvestOrder } from "@/lib/harvest";
import { addDaysISO, todayPacific } from "@/lib/utils";
import { HarvestClient, type HarvestExtra } from "./HarvestClient";
import type { FarmHandTask } from "./FarmTasks";
import { listTodayTasks, listUpcomingTasks, listCompletedTasks } from "@/lib/tasks/queries";
import type { FarmTask } from "@/types/database";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ date?: string; tab?: string }>;
}

/**
 * /harvest — Farm Hand portal (the `harvester` role).
 *
 * The single screen a farm-hand account sees, in two tabs:
 *   - Harvest: the combined cross-restaurant pick list for a delivery date
 *     (same roll-up as the top of /admin/orders/[date], via
 *     src/lib/harvest.ts) plus the ability to add extra items to a delivery.
 *   - Tasks: every open farm task (due now / coming up / recently finished)
 *     with its photos; a farm hand can mark a task finished or undo that.
 * Bilingual English/Spanish — the language toggle lives in the client
 * component and persists per device.
 *
 * Deliberately excludes prices, chef notes, order status, and every other
 * admin surface — the crew sees what to pick and what needs doing, nothing
 * more. Tasks are created and edited on /admin/tasks.
 */
export default async function HarvestPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role, is_active, full_name").eq("id", user.id).single();
  if (!profile) redirect("/login");
  // Harvesters (active) live here; admins can peek. Everyone else goes home.
  if (profile.role !== "admin" && !(profile.role === "harvester" && profile.is_active)) {
    redirect("/");
  }

  const { date: dateParam, tab: tabParam } = await searchParams;
  const today = todayPacific();

  const admin = createAdminClient();

  // Nearby delivery dates for the picker — a couple back (finish yesterday's
  // pick) plus the upcoming week.
  const { data: nearbyDates } = await (admin as any)
    .from("delivery_dates")
    .select("date")
    .gte("date", addDaysISO(todayPacific(), -2))
    .lte("date", addDaysISO(todayPacific(), 8))
    .order("date", { ascending: true });

  const dates: string[] = (nearbyDates ?? []).map((d: any) => d.date);
  const defaultDate = dates.find((d) => d >= today) ?? dates[dates.length - 1] ?? today;
  const selected = (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) ? dateParam : defaultDate;
  if (!dates.includes(selected)) dates.push(selected);
  dates.sort();

  // Orders for the selected date — just the fields the harvest roll-up needs
  // (no prices, no chef notes). Admin client: cross-restaurant by design.
  // Task windows are anchored to the PACIFIC date (the task helpers default
  // to the UTC date, which is already "tomorrow" by late afternoon here).
  const taskNow = new Date(`${today}T12:00:00Z`);
  const { data: farms } = await (admin as any).from("farms").select("id").limit(1);
  const farmId: string | undefined = farms?.[0]?.id;

  const [
    { data: ordersRaw },
    { data: deliveriesRaw },
    { data: catalogRaw },
    tasksToday,
    tasksUpcoming,
    tasksDone,
  ] = await Promise.all([
    (admin as any)
      .from("orders")
      .select(`
        id, status,
        restaurant:restaurants(id, name),
        order_items(
          id, quantity_requested, quantity_fulfilled, is_shorted, unit_type, size_label, color_key, variety_key, picked_at,
          availability_item:availability_items(
            item:items(id, name, category, unit_type)
          )
        )
      `)
      .eq("delivery_date", selected),
    // Bonus lines already logged for the date — the harvester's own "extras"
    // ledger, shown so they can see (and undo) what they've added.
    (admin as any)
      .from("deliveries")
      .select(`
        restaurant_id,
        delivery_items ( id, quantity, unit, is_bonus, items ( id, name ) )
      `)
      .eq("delivery_date", selected),
    // Catalog for the add-extra picker — names + units only, NO prices
    // (the extras API resolves pricing server-side).
    (admin as any)
      .from("items")
      .select("id, name, unit_type")
      .eq("is_archived", false)
      .order("name"),
    farmId ? listTodayTasks(admin, farmId, taskNow) : Promise.resolve([] as FarmTask[]),
    farmId ? listUpcomingTasks(admin, farmId, taskNow, 14) : Promise.resolve([] as FarmTask[]),
    farmId ? listCompletedTasks(admin, farmId, taskNow, 7) : Promise.resolve([] as FarmTask[]),
  ]);

  // Names for the task cards: linked crop / item, and who finished it.
  const allTasks = [...tasksToday, ...tasksUpcoming, ...tasksDone];
  const cropIds = Array.from(new Set(allTasks.map((t) => t.microgreen_crop_id).filter((v): v is string => !!v)));
  const completerIds = Array.from(new Set(tasksDone.map((t) => t.completed_by).filter((v): v is string => !!v)));
  const [{ data: cropRows }, { data: peopleRows }] = await Promise.all([
    cropIds.length > 0
      ? admin.from("microgreen_crops").select("id, name").in("id", cropIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    completerIds.length > 0
      ? admin.from("profiles").select("id, full_name").in("id", completerIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
  ]);
  const itemNameById = new Map<string, string>(((catalogRaw ?? []) as any[]).map((i) => [i.id, i.name]));
  const cropNameById = new Map<string, string>((cropRows ?? []).map((c) => [c.id, c.name]));
  const personNameById = new Map<string, string>(
    (peopleRows ?? []).filter((p) => p.full_name).map((p) => [p.id, p.full_name as string]),
  );
  // Only what the crew needs — no source refs, generator keys or notes.
  const toFarmHandTask = (t: FarmTask): FarmHandTask => ({
    id: t.id,
    title: t.title,
    title_es: t.title_es,
    description: t.description,
    description_es: t.description_es,
    type: t.type,
    due_date: t.due_date,
    due_time: t.due_time,
    priority: t.priority,
    photo_urls: t.photo_urls ?? [],
    completed_at: t.completed_at,
    completed_by_name: t.completed_by ? personNameById.get(t.completed_by) ?? null : null,
    subject:
      (t.microgreen_crop_id && cropNameById.get(t.microgreen_crop_id)) ||
      (t.item_id && itemNameById.get(t.item_id)) ||
      null,
  });

  const orders: any[] = ordersRaw ?? [];
  const agg = aggregateHarvest(orders as HarvestOrder[]);

  // restaurantId → orderId so the client can hit /api/orders/[orderId]/extras.
  const orderIdByRestaurant: Record<string, string> = {};
  for (const o of orders) {
    if (o.restaurant?.id && !orderIdByRestaurant[o.restaurant.id]) {
      orderIdByRestaurant[o.restaurant.id] = o.id;
    }
  }

  const extrasByRestaurant: Record<string, HarvestExtra[]> = {};
  for (const d of (deliveriesRaw ?? []) as any[]) {
    const lines = (d.delivery_items ?? [])
      .filter((di: any) => di.is_bonus && di.items)
      .map((di: any) => ({
        id: di.id,
        itemName: di.items.name,
        quantity: Number(di.quantity ?? 0),
        unit: String(di.unit ?? "").toUpperCase(),
      }));
    if (lines.length > 0) {
      extrasByRestaurant[d.restaurant_id] = [
        ...(extrasByRestaurant[d.restaurant_id] ?? []),
        ...lines,
      ];
    }
  }

  return (
    <HarvestClient
      date={selected}
      dates={dates}
      restaurants={agg.restaurantsInPlay.map((r) => ({
        ...r,
        orderId: orderIdByRestaurant[r.id] ?? null,
      }))}
      categories={agg.categories}
      containers={agg.containers}
      itemCount={agg.itemCount}
      extrasByRestaurant={extrasByRestaurant}
      catalog={(catalogRaw ?? []) as { id: string; name: string; unit_type: string }[]}
      initialTab={tabParam === "tasks" ? "tasks" : "harvest"}
      today={today}
      todayTasks={tasksToday.map(toFarmHandTask)}
      upcomingTasks={tasksUpcoming.map(toFarmHandTask)}
      doneTasks={tasksDone.map(toFarmHandTask)}
    />
  );
}
