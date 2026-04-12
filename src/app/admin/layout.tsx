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
      {/* Brand badge — fixed position, same spot on every page */}
      <a
        href="/admin/dashboard"
        className="fixed top-3 right-3 z-20 flex items-center gap-1.5 opacity-85 hover:opacity-100 transition-opacity min-h-0 min-w-0"
      >
        <span
          className="text-lg text-white/70 tracking-[0.15em] uppercase"
          style={{ fontFamily: "'BankGothic Lt BT', 'Bank Gothic', Arial, sans-serif" }}
        >
          PRESS FARM
        </span>
        <img src="/icon-192.png" alt="Press Farm" width={22} height={22} className="rounded-full" />
      </a>
      {/* Main content — padded bottom for bottom nav */}
      <div className="pb-20">{children}</div>
      <BottomNav />
    </div>
  );
}
