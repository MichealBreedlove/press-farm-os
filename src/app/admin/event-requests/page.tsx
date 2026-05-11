import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { EventRequestsClient } from "./EventRequestsClient";

/**
 * /admin/event-requests — Admin review queue for advance event requests
 * filed by chefs. Accept auto-creates the order line.
 */
export default async function AdminEventRequestsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((profile as any)?.role !== "admin") redirect("/order");

  const admin = createAdminClient();
  const { data: rowsRaw } = await (admin as any)
    .from("event_requests")
    .select(
      "id, restaurant_id, chef_id, item_id, quantity, unit, needed_by_date, event_name, notes, status, admin_response, responded_at, created_at, restaurant:restaurants(id, name), chef:profiles!event_requests_chef_id_fkey(id, full_name), item:items(id, name, category, unit_type)",
    )
    .order("needed_by_date", { ascending: true })
    .order("created_at", { ascending: false });

  const rows = (rowsRaw ?? []).map((r: any) => ({
    id: r.id,
    restaurant_name: r.restaurant?.name ?? "(restaurant)",
    chef_name: r.chef?.full_name ?? "(chef)",
    item_name: r.item?.name ?? "(item)",
    quantity: Number(r.quantity),
    unit: r.unit,
    needed_by_date: r.needed_by_date,
    event_name: r.event_name,
    notes: r.notes,
    status: r.status as "pending" | "accepted" | "declined" | "fulfilled",
    admin_response: r.admin_response,
    responded_at: r.responded_at,
    created_at: r.created_at,
  }));

  const pending = rows.filter((r) => r.status === "pending");
  const responded = rows.filter((r) => r.status !== "pending");

  return (
    <main className="pb-24">
      <header className="page-header">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/dashboard"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 text-farm-muted"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="page-title">Event Requests</h1>
        </div>
      </header>

      <EditorialHero
        eyebrow="Advance Orders"
        title="Event Requests"
        subtitle={`${pending.length} pending · ${responded.length} responded`}
        flower="marigold"
        backHref="/admin/dashboard"
      />

      <div className="px-4 py-6 max-w-3xl mx-auto">
        <EventRequestsClient pending={pending} responded={responded} />
      </div>
    </main>
  );
}
