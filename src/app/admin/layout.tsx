import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BottomNav } from "@/components/admin/BottomNav";
import type { Profile } from "@/types";

/**
 * Count unread inbound replies for the BottomNav badge.
 *
 * Wrapped in try/catch because migration 047 introduces this table — if it
 * hasn't been applied yet, the count query throws and we return 0 rather
 * than blowing up every admin page.
 */
async function getInboxUnreadCount(
  admin: ReturnType<typeof createAdminClient>,
): Promise<number> {
  try {
    const { count, error } = await (admin as any)
      .from("inbound_messages")
      .select("id", { count: "exact", head: true })
      .eq("status", "unread");
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

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

  const admin = createAdminClient();
  const inboxUnreadCount = await getInboxUnreadCount(admin);

  return (
    <div className="min-h-screen bg-farm-cream">
      {/* Main content — padded bottom for bottom nav */}
      <div className="pb-20">{children}</div>
      <BottomNav inboxUnreadCount={inboxUnreadCount} />
    </div>
  );
}
