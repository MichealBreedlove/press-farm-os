import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

/**
 * PATCH /api/availability/toggle — Toggle ordering_open on a delivery date (admin only)
 *
 * Body: { delivery_date_id: string, ordering_open: boolean }
 */
export async function PATCH(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify admin
  const { data: profileRaw } = await (supabase as any)
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();
  const profile = profileRaw as Pick<Profile, "role" | "is_active"> | null;
  if (!profile || profile.role !== "admin" || !profile.is_active) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { delivery_date_id: string; ordering_open: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { delivery_date_id, ordering_open } = body;
  if (!delivery_date_id || typeof ordering_open !== "boolean") {
    return NextResponse.json({ error: "Missing delivery_date_id or ordering_open" }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { data, error } = await (adminClient.from("delivery_dates") as any)
    .update({ ordering_open })
    .eq("id", delivery_date_id)
    .select()
    .single();

  if (error) {
    console.error("Toggle ordering error:", error);
    return NextResponse.json({ error: "Failed to toggle ordering" }, { status: 500 });
  }

  return NextResponse.json({ data, error: null });
}
