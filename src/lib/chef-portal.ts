import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Role gate for the chef portal (/order, /calendar, /history, /events).
 *
 * The middleware only checks for a session. Without this, a receiver or
 * harvester who types /history lands on a "No restaurant found" dead end
 * instead of their own home. Chefs and admins (who may peek) pass through;
 * everyone else is sent where they belong.
 */
export async function gateChefPortal(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  switch (profile?.role) {
    case "receiver":
      redirect("/receiver");
    case "harvester":
      redirect("/harvest");
    default:
      return; // chef, admin, or no profile yet (page handles the rest)
  }
}
