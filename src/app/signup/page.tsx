import { createAdminClient } from "@/lib/supabase/admin";
import { SignupForm } from "./SignupForm";

/**
 * /signup — Public chef self-signup. Mirrors the /login layout. Unlike the
 * admin Users picker (which hides Events because chefs there assign to a real
 * restaurant and events surface everywhere via is_event_item), Events is a
 * valid signup target — the Events team places their own orders for flowers,
 * branches, and other event items.
 */
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const admin = createAdminClient();
  const { data: restaurants } = await (admin as any)
    .from("restaurants")
    .select("id, name")
    .order("name");

  return <SignupForm restaurants={restaurants ?? []} />;
}
