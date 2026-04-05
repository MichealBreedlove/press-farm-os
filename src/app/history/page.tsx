import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/utils";
import Link from "next/link";

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: restaurantUser } = await supabase
    .from("restaurant_users")
    .select("restaurant_id, restaurants(id, name)")
    .eq("user_id", user.id)
    .single();

  const restaurantId = restaurantUser?.restaurant_id;

  const { data: orders } = restaurantId
    ? await supabase
        .from("orders")
        .select(`
          id, delivery_date, status, submitted_at, freeform_notes,
          order_items(id, quantity_requested, availability_items(items(name, unit_type)))
        `)
        .eq("restaurant_id", restaurantId)
        .order("delivery_date", { ascending: false })
        .limit(20)
    : { data: null };

  const restaurant = restaurantUser?.restaurants as { name: string } | null;

  const statusColor: Record<string, string> = {
    draft: "text-gray-400 bg-gray-50",
    submitted: "text-blue-600 bg-blue-50",
    in_progress: "text-yellow-700 bg-yellow-50",
    fulfilled: "text-green-700 bg-green-50",
    cancelled: "text-red-600 bg-red-50",
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Order History</h1>
            {restaurant && <p className="text-sm text-gray-500">{restaurant.name}</p>}
          </div>
          <Link href="/order" className="text-sm text-farm-green font-medium">
            New Order
          </Link>
        </div>
      </header>

      <div className="px-4 py-4 space-y-3">
        {!orders?.length && (
          <div className="text-center text-gray-400 text-sm py-16">
            <p className="text-3xl mb-3">📋</p>
            <p>No orders yet.</p>
          </div>
        )}

        {orders?.map((order) => {
          const itemCount = order.order_items?.length ?? 0;
          const status = order.status as string;
          return (
            <Link
              key={order.id}
              href={`/history/${order.id}`}
              className="block bg-white rounded-2xl border border-gray-100 px-4 py-4 active:bg-gray-50"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{formatDate(order.delivery_date)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{itemCount} item{itemCount !== 1 ? "s" : ""}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${statusColor[status] ?? "text-gray-500 bg-gray-50"}`}>
                  {status.replace("_", " ")}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
