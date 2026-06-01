import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { CatalogAuditClient } from "./CatalogAuditClient";

export default async function CatalogAuditPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { count: activeCount } = await admin
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("is_archived", false);

  return (
    <main className="pb-24">
      <header className="page-header">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/items"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 text-white/70 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="page-title">Catalog Audit</h1>
        </div>
      </header>
      <EditorialHero
        eyebrow="AI Review"
        title="Catalog Audit"
        subtitle={`Looks across ${activeCount ?? 0} active items for likely duplicates and parent/child grouping opportunities.`}
        flower="nasturtium"
        backHref="/admin/items"
      />
      <CatalogAuditClient itemCount={activeCount ?? 0} />
    </main>
  );
}
