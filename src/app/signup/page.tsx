import { createAdminClient } from "@/lib/supabase/admin";
import { SignupForm } from "./SignupForm";

/**
 * /signup — Public chef self-signup. Mirrors the /login layout. The restaurant
 * picker hides the legacy "Events" pseudo-restaurant — events appear on every
 * chef's order form via the is_event_item flag, no assignment needed.
 */
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const admin = createAdminClient();
  const { data: restaurants } = await (admin as any)
    .from("restaurants")
    .select("id, name")
    .not("name", "ilike", "%event%")
    .order("name");

  return <SignupForm restaurants={restaurants ?? []} />;
}
