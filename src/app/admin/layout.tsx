import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/admin/BottomNav";
import type { Profile } from "@/types";

/**
 * Admin layout — wraps all /admin/* pages.
 * Auth check: redirects non-admins to /order, unauthenticated to /login.
 * Includes BottomNav client component for tab navigation.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileRaw } = await (supabase as any)
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();
  const profile = profileRaw as Pick<Profile, "role" | "is_active"> | null;

  if (!profile || profile.role !== "admin" || !profile.is_active) {
    redirect("/order");
  }

  return (
    <div className="min-h-screen bg-farm-cream">
      {/* Main content — padded bottom for bottom nav */}
      <div className="pb-20">{children}</div>
      <BottomNav />
    </div>
  );
}
