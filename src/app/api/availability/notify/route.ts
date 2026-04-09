import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDeliveryDate } from "@/lib/utils";

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

  // Get all restaurants and their availability item counts
  const { data: restaurants } = await (admin as any)
    .from("restaurants")
    .select("id, name");

  // Get availability items for this date
  const { data: availItems } = await (admin as any)
    .from("availability_items")
    .select("restaurant_id, status")
    .eq("delivery_date", delivery_date)
    .neq("status", "unavailable");

  // Get items with seasonal status for the email
  const { data: seasonItems } = await (admin as any)
    .from("items")
    .select("name, season_status, season_note")
    .in("season_status", ["ending_soon", "coming_soon"]);

  // Get all chef users with restaurant links
  const { data: restaurantUsers } = await (admin as any)
    .from("restaurant_users")
    .select("user_id, restaurant_id");

  // Get chef profiles
  const { data: profiles } = await (admin as any)
    .from("profiles")
    .select("id, full_name, role")
    .eq("role", "chef")
    .eq("is_active", true);

  const formattedDate = formatDeliveryDate(delivery_date);
  let emailsSent = 0;

  // Send email to each chef
  for (const chefProfile of profiles ?? []) {
    // Get chef's email from auth
    const { data: authUser } = await admin.auth.admin.getUserById(chefProfile.id);
    const email = authUser?.user?.email;
    if (!email) continue;

    // Get chef's restaurant
    const ru = (restaurantUsers ?? []).find((r: any) => r.user_id === chefProfile.id);
    if (!ru) continue;

    const restaurant = (restaurants ?? []).find((r: any) => r.id === ru.restaurant_id);
    if (!restaurant) continue;

    // Count available items for this restaurant
    const itemCount = (availItems ?? []).filter(
      (ai: any) => ai.restaurant_id === restaurant.id
    ).length;

    // Build seasonal items section
    const endingSoon = (seasonItems ?? []).filter((i: any) => i.season_status === "ending_soon");
    const comingSoon = (seasonItems ?? []).filter((i: any) => i.season_status === "coming_soon");

    let seasonSection = "";
    if (endingSoon.length > 0) {
      seasonSection += `\n\nEnding Soon:\n${endingSoon.map((i: any) => `- ${i.name}${i.season_note ? ` (${i.season_note})` : ""}`).join("\n")}`;
    }
    if (comingSoon.length > 0) {
      seasonSection += `\n\nComing Soon:\n${comingSoon.map((i: any) => `- ${i.name}${i.season_note ? ` (${i.season_note})` : ""}`).join("\n")}`;
    }

    // Send via Resend
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);

      await resend.emails.send({
        from: "Press Farm <orders@pressfarm.app>",
        to: email,
        subject: `New Availability — ${formattedDate}`,
        text: `Hi ${chefProfile.full_name},\n\nAvailability has been posted for ${restaurant.name} on ${formattedDate}. ${itemCount} items available.\n\nPlace your order at ${process.env.NEXT_PUBLIC_APP_URL}/order${seasonSection}\n\n— Press Farm`,
      });
      emailsSent++;
    } catch (err) {
      console.error(`[EMAIL] Failed to send to ${email}:`, err);
    }
  }

  return NextResponse.json({ success: true, emailsSent });
}
