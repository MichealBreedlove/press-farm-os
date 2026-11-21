import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Role gate for the chef portal (/order, /calendar, /history, /events).
 *
 * The middleware only checks for a session. Without this, a receiver or
 * harvester who types /history lands on a "No restaurant found" dead end
 * instead of their own home. Chefs, the Farm Liaison (who orders under
 * Press) and admins (who may peek) pass through; everyone else is sent where
 * they belong. Returns the role so the layout can pick the right bottom nav.
 */
export async function gateChefPortal(): Promise<string | null> {
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
    case "head_farmhand":
      redirect("/farm-tasks");
    default:
      // chef, liaison, admin, or no profile yet (page handles the rest)
      return (profile?.role as string | undefined) ?? null;
  }
}
