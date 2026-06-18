import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDeliveryDate, todayPacific } from "@/lib/utils";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { AdminOrderEditor, type EditorLine, type CatalogItem, type DeliveryDateOption } from "./AdminOrderEditor";

interface PageProps {
  params: Promise<{ date: string; orderId: string }>;
}

/**
 * /admin/orders/[date]/[orderId]/edit — Admin full order editor.
 *
 * Loads any restaurant's order (service-role, RLS-bypassing), the catalog for
 * the add-item picker, and the list of delivery dates for the date selector,
 * then hands off to the interactive client editor. The matching PUT route at
 * /api/orders/[orderId]/edit applies the changes (date move + merge, line
 * qty edits, removals, additions, notes).
 */
export default async function AdminOrderEditPage({ params }: PageProps) {
  const { date, orderId } = await params;
  const admin = createAdminClient();

  const today = todayPacific();

  const [{ data: order }, { data: catalogRaw }, { data: datesRaw }] = await Promise.all([
    (admin as any)
      .from("orders")
      .select(
        `
        id, delivery_date, status, freeform_notes,
        restaurant:restaurants(id, name),
        order_items(
          id, quantity_requested, unit_type, size_label, color_key, menu_section,
          availability_item:availability_items(
            id, item:items(id, name, category, unit_type)
          )
        )
      `,
      )
      .eq("id", orderId)
      .single(),
    (admin as any)
      .from("items")
      .select("id, name, category, unit_type, default_price, unit_prices")
      .eq("is_archived", false)
      .order("name"),
    // Delivery dates for the move picker: a small window around today plus the
    // order's own date (which may be in the past for a historical edit).
    (admin as any)
      .from("delivery_dates")
      .select("date, day_of_week, ordering_open")
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(60),
  ]);

  if (!order) notFound();

  const lines: EditorLine[] = (order.order_items ?? []).map((oi: any) => {
    const item = oi.availability_item?.item;
    const unit =
      (oi.unit_type ?? "").trim() ||
      String(item?.unit_type ?? "")
        .split(",")
        .map((u: string) => u.trim())
        .filter(Boolean)[0] ||
      "";
    return {
      id: oi.id,
      itemName: item?.name ?? "Unknown item",
      category: item?.category ?? "other",
      unit,
      sizeLabel: oi.size_label ?? null,
      isEvent: oi.menu_section === "events",
      quantity: Number(oi.quantity_requested ?? 0),
    };
  });

  const catalog: CatalogItem[] = (catalogRaw ?? []).map((it: any) => ({
    id: it.id,
    name: it.name,
    category: it.category,
    unit_type: it.unit_type ?? "",
    default_price: it.default_price ?? null,
    unit_prices: it.unit_prices ?? null,
  }));

  // Always include the order's own date so a historical/past order can keep it.
  const dateSet = new Map<string, DeliveryDateOption>();
  dateSet.set(order.delivery_date, {
    date: order.delivery_date,
    label: formatDeliveryDate(order.delivery_date),
    orderingOpen: true,
  });
  for (const d of datesRaw ?? []) {
    dateSet.set(d.date, {
      date: d.date,
      label: formatDeliveryDate(d.date),
      orderingOpen: !!d.ordering_open,
    });
  }
  const deliveryDates = Array.from(dateSet.values()).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <main className="min-h-screen bg-farm-cream pb-44">
      <EditorialHero
        eyebrow={order.restaurant?.name ?? "Order"}
        title="Edit Order"
        subtitle={`${formatDeliveryDate(order.delivery_date)} · ${order.status}`}
        flower="squash-blossom"
        backHref={`/admin/orders/${date}`}
      />

      <div className="px-4 py-6 max-w-2xl mx-auto">
        <AdminOrderEditor
          orderId={order.id}
          sourceDate={date}
          restaurantName={order.restaurant?.name ?? "Restaurant"}
          currentDate={order.delivery_date}
          initialNotes={order.freeform_notes ?? ""}
          initialLines={lines}
          catalog={catalog}
          deliveryDates={deliveryDates}
        />
      </div>
    </main>
  );
}
