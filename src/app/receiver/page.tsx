import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { SignOutButton } from "@/components/shared/SignOutButton";
import { formatDeliveryDate } from "@/lib/utils";
import { ReceiverClient } from "./ReceiverClient";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ date?: string }>;
}

/**
 * /receiver — Receiver-side dashboard.
 *
 * Shows today's deliveries (or any selected date) grouped by restaurant.
 * For each ordered line item, computes its state:
 *   - READY  : ordered + delivered same qty
 *   - SHORT  : ordered + delivered less
 *   - PENDING: ordered + nothing delivered yet (delivery hasn't been logged)
 *   - EXTRA  : delivered but never ordered
 *
 * Event items (items.is_event_item = true) are flagged separately so the
 * receiver can set them aside for special-occasion use.
 */
export default async function ReceiverPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Verify role
  const { data: profile } = await (supabase as any)
    .from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!profile) redirect("/login");
  if (profile.role !== "receiver" && profile.role !== "admin") {
    // Chefs land back on their order portal; admins still get to peek.
    redirect("/order");
  }

  const { date: dateParam } = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const selected = (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) ? dateParam : today;

  // Use admin client for the data join — receivers have RLS read access but
  // it's simpler to assemble cross-restaurant data through the admin client.
  const admin = createAdminClient();

  // Recent + upcoming dates for the picker (last 7 days + next 7 days)
  const { data: recentDates } = await (admin as any)
    .from("delivery_dates")
    .select("date, day_of_week, ordering_open")
    .gte("date", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
    .lte("date", new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10))
    .order("date", { ascending: true });

  // Restaurants (excluding the legacy Events row — events are now a tag on items)
  const { data: restaurants } = await (admin as any)
    .from("restaurants")
    .select("id, name")
    .not("name", "ilike", "%event%")
    .order("name");

  const restaurantList: { id: string; name: string }[] = restaurants ?? [];

  // Orders for selected date — need the order_items joined with availability_items → items
  const { data: orders } = await (admin as any)
    .from("orders")
    .select(`
      id, restaurant_id, delivery_date, status, freeform_notes,
      order_items (
        id, quantity_requested, quantity_fulfilled, is_shorted, shortage_reason,
        availability_item_id,
        availability_items (
          id, item_id,
          items ( id, name, category, unit_type, image_url, is_event_item )
        )
      )
    `)
    .eq("delivery_date", selected);

  // Deliveries + delivery_items for the same date
  const { data: deliveries } = await (admin as any)
    .from("deliveries")
    .select(`
      id, restaurant_id, delivery_date, status, total_value,
      delivery_items (
        id, item_id, quantity, unit, unit_price, line_total,
        items ( id, name, category, unit_type, image_url, is_event_item )
      )
    `)
    .eq("delivery_date", selected);

  // Most recent notify event for this date — drives the "last notified at"
  // caption under the editorial hero so receivers know whether the data
  // they're seeing is post-finish or still in-progress.
  const { data: lastNotifyRaw } = await (admin as any)
    .from("receiver_notify_log")
    .select("sent_at")
    .eq("delivery_date", selected)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastNotifiedAt = (lastNotifyRaw as { sent_at: string } | null)?.sent_at ?? null;

  return (
    <main className="min-h-screen pb-24 bg-farm-cream">
      <header className="page-header">
        <h1 className="page-title">Receiving</h1>
        <p className="text-xs text-white/60">{profile.full_name ?? "Receiver"}</p>
      </header>

      <EditorialHero
        eyebrow="Today's Receiving"
        title={formatDeliveryDate(selected)}
        subtitle="What's coming in across all restaurants"
        flower="green-leaf"
      />

      <div className="px-4 py-6 max-w-3xl mx-auto">
        {/* "Last notified" timestamp — tells the receiver whether the
            current dashboard reflects the post-pick state (admin hit
            Finish & Send) or is still mid-pick. */}
        {lastNotifiedAt && (
          <p className="text-[11px] tracking-[0.18em] uppercase text-farm-muted text-center mb-4">
            Notified {new Date(lastNotifiedAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        )}

        <ReceiverClient
          selectedDate={selected}
          dates={(recentDates ?? []).map((d: any) => ({
            date: d.date,
            day: d.day_of_week,
            isToday: d.date === today,
            isPast: d.date < today,
          }))}
          restaurants={restaurantList}
          orders={orders ?? []}
          deliveries={deliveries ?? []}
        />

        {/* Archive shortcut — older deliveries beyond the 7-day picker */}
        <div className="mt-8">
          <a
            href="/receiver/archive"
            className="block w-full min-h-[48px] rounded-xl border border-farm-dark/10 bg-white text-sm font-medium text-farm-dark/85 hover:border-farm-green hover:text-farm-green transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            View Past Deliveries
          </a>
        </div>

        {/* Sign out — same card pattern used on /admin/settings */}
        <div className="mt-6">
          <p className="section-eyebrow text-farm-muted mb-2">Account</p>
          <SignOutButton />
        </div>
      </div>
    </main>
  );
}
