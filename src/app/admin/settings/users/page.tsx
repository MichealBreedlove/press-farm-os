import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UsersClient } from "./UsersClient";

export default async function AdminUsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const [{ data: profiles }, { data: authData }, { data: restaurantsRaw }] = await Promise.all([
    (admin as any)
      .from("profiles")
      .select("id, full_name, role, is_active, created_at, restaurant_users(restaurant_id, restaurants(name))")
      .order("created_at", { ascending: true }),
    admin.auth.admin.listUsers(),
    (admin as any).from("restaurants").select("id, name").order("name"),
  ]);

  const emailMap: Record<string, string> = {};
  for (const u of authData?.users ?? []) {
    emailMap[u.id] = u.email ?? "";
  }

  const users = (profiles ?? []).map((p: any) => ({
    id: p.id,
    full_name: p.full_name,
    email: emailMap[p.id] ?? "",
    role: p.role,
    is_active: p.is_active,
    restaurants: (p.restaurant_users ?? []).map((ru: any) => ru.restaurants?.name).filter(Boolean),
  }));

  return (
    <main className="pb-24">
      <header className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/settings"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 text-gray-500"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">Users</h1>
        </div>
      </header>

      <div className="px-4 py-6">
        <UsersClient
          users={users}
          restaurants={restaurantsRaw ?? []}
          currentUserId={user.id}
        />
      </div>
    </main>
  );
}
