import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Root page: redirect to the appropriate portal based on user role.
 * - Admin     → /admin/dashboard
 * - Receiver  → /receiver
 * - Harvester → /harvest
 * - Chef      → /order
 * - Unauthenticated → /login (handled by middleware)
 */
export default async function RootPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single() as any;

  const role = (profile as any)?.role;
  if (role === "admin") redirect("/admin/dashboard");
  if (role === "receiver") redirect("/receiver");
  if (role === "harvester") redirect("/harvest");

  // The Events team has its own ordering system. Route the shared Events
  // account (restaurant slug 'events') there instead of the chef order form.
  const { data: membership } = (await (supabase as any)
    .from("restaurant_users")
    .select("restaurants(slug)")
    .eq("user_id", user.id)
    .single()) as any;
  if (membership?.restaurants?.slug === "events") redirect("/events/order");

  redirect("/order");
}
