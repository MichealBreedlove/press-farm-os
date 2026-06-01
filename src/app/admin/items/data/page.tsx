import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { DataClient } from "./DataClient";

export default async function ItemsDataPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if ((profile as any)?.role !== "admin") redirect("/");

  // Headline counts so the page feels grounded
  const admin = createAdminClient();
  const [{ count: activeCount }, { count: archivedCount }] = await Promise.all([
    admin.from("items").select("*", { count: "exact", head: true }).eq("is_archived", false),
    admin.from("items").select("*", { count: "exact", head: true }).eq("is_archived", true),
  ]);

  return (
    <main className="pb-24">
      <header className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/admin/items" className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 text-white/70 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="page-title">Catalog · Data</h1>
        </div>
      </header>

      <EditorialHero
        eyebrow="Farm Management"
        title="Import & Export"
        subtitle="Bulk-edit your catalog in a spreadsheet, then bring it back."
        flower="dill"
        backHref="/admin/items"
      />

      <div className="px-4 py-6 max-w-3xl mx-auto">
        <DataClient activeCount={activeCount ?? 0} archivedCount={archivedCount ?? 0} />
      </div>
    </main>
  );
}
