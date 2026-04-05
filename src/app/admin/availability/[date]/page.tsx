import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { formatDate } from "@/lib/utils";
import AvailabilityEditorClient from "./client";
import type { Database } from "@/types/database";

type DeliveryDateRow = Database["public"]["Tables"]["delivery_dates"]["Row"];

interface Props {
  params: Promise<{ date: string }>;
}

export default async function AvailabilityDatePage({ params }: Props) {
  const { date } = await params;
  const supabase = await createClient();
  const admin = createAdminClient();

  // Verify delivery date exists
  const { data: ddData } = await supabase
    .from("delivery_dates")
    .select("*")
    .eq("date", date)
    .single();

  if (!ddData) redirect("/admin/availability");

  const deliveryDate = ddData as DeliveryDateRow;

  // Get all active items
  const { data: items } = await admin
    .from("items")
    .select("*")
    .eq("is_archived", false)
    .order("category")
    .order("sort_order")
    .order("name");

  // Get all restaurants
  const { data: restaurants } = await admin
    .from("restaurants")
    .select("id, name, slug")
    .order("name");

  // Get existing availability for this date
  const { data: availability } = await admin
    .from("availability_items")
    .select("*")
    .eq("delivery_date", date);

  return (
    <main>
      <header className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 sticky top-0 z-10">
        <div className="flex items-center gap-2 mb-2">
          <a href="/admin/availability" className="text-farm-green text-sm">‹ Back</a>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold capitalize">
              {deliveryDate.day_of_week} · {formatDate(date)}
            </h1>
            <p className={`text-xs font-medium ${deliveryDate.ordering_open ? "text-green-600" : "text-gray-400"}`}>
              {deliveryDate.ordering_open ? "Ordering open" : "Ordering closed"}
            </p>
          </div>
        </div>
      </header>

      <AvailabilityEditorClient
        date={date}
        orderingOpen={deliveryDate.ordering_open}
        items={items ?? []}
        restaurants={restaurants ?? []}
        initialAvailability={availability ?? []}
      />
    </main>
  );
}
