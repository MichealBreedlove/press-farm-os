import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * /events — retired chef request flow.
 *
 * Events now work two ways (Micheal, 2026-09-15):
 *   - The Events account places real orders on /events/order (event name,
 *     event date, delivery date). Gated to the shared `events` restaurant.
 *   - Press / Under-Study chefs mark lines "For an event" on their normal
 *     /order form.
 *
 * The old admin-approved request queue that lived here is gone; this route
 * just sends each account to the right form so bookmarks keep working.
 * Past requests remain visible on /admin/event-requests.
 */
export default async function EventsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await (supabase as any)
    .from("restaurant_users")
    .select("restaurants(slug)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (membership?.restaurants?.slug === "events") redirect("/events/order");
  redirect("/order");
}
