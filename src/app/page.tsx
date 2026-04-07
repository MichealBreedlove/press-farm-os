import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Root page: redirect to the appropriate portal based on user role.
 * - Admin → /admin/orders
 * - Chef → /order
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

  if ((profile as any)?.role === "admin") {
    redirect("/admin/orders");
  }

  redirect("/order");
}
