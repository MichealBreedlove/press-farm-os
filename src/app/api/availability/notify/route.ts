import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDeliveryDate } from "@/lib/utils";
import { sendAvailabilityPublishedEmail } from "@/lib/email";

/**
 * POST /api/availability/notify — Send availability email to all chefs
 * Body: { delivery_date: string }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { delivery_date } = await request.json();
  if (!delivery_date) {
    return NextResponse.json({ error: "delivery_date required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: restaurants } = await (admin as any)
    .from("restaurants")
    .select("id, name");

  const { data: availItems } = await (admin as any)
    .from("availability_items")
    .select("restaurant_id, status")
    .eq("delivery_date", delivery_date)
    .neq("status", "unavailable");

  // Items with seasonal status get called out at the bottom of the email.
  const { data: seasonItems } = await (admin as any)
    .from("items")
    .select("name, season_status, season_note")
    .in("season_status", ["ending_soon", "coming_soon"]);

  const endingSoon = (seasonItems ?? []).filter((i: any) => i.season_status === "ending_soon");
  const comingSoon = (seasonItems ?? []).filter((i: any) => i.season_status === "coming_soon");

  const { data: restaurantUsers } = await (admin as any)
    .from("restaurant_users")
    .select("user_id, restaurant_id");

  const { data: profiles } = await (admin as any)
    .from("profiles")
    .select("id, full_name, role")
    .eq("role", "chef")
    .eq("is_active", true);

  const formattedDate = formatDeliveryDate(delivery_date);
  let emailsSent = 0;

  for (const chefProfile of profiles ?? []) {
    const { data: authUser } = await admin.auth.admin.getUserById(chefProfile.id);
    const email = authUser?.user?.email;
    if (!email) continue;

    const ru = (restaurantUsers ?? []).find((r: any) => r.user_id === chefProfile.id);
    if (!ru) continue;

    const restaurant = (restaurants ?? []).find((r: any) => r.id === ru.restaurant_id);
    if (!restaurant) continue;

    const itemCount = (availItems ?? []).filter(
      (ai: any) => ai.restaurant_id === restaurant.id,
    ).length;

    try {
      await sendAvailabilityPublishedEmail({
        toEmail: email,
        chefName: chefProfile.full_name ?? "Chef",
        restaurantName: restaurant.name,
        deliveryDate: formattedDate,
        itemCount,
        seasonal: { endingSoon, comingSoon },
      });
      emailsSent++;
    } catch (err) {
      console.error(`[EMAIL] Failed to send availability-published to ${email}:`, err);
    }
  }

  return NextResponse.json({ success: true, emailsSent });
}
