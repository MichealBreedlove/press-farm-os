import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PacksClient } from "./PacksClient";
import { EditorialHero } from "@/components/shared/EditorialHero";

export default async function PacksPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: packs } = await (admin as any).from("pack_inventory").select("*").order("display_name");

  return (
    <main className="pb-24">
      <header className="page-header">
        <h1 className="page-title">Pack Manager</h1>
        <p className="text-xs text-white/60">Container inventory & reorder alerts</p>
      </header>
      <EditorialHero
        eyebrow="Farm Management"
        title="Pack Manager"
        subtitle="Container inventory + usage"
        flower="fairy-vetch"
        backHref="/admin/dashboard"
      />
      <div className="px-4 py-6">
        <PacksClient initialPacks={packs ?? []} />
      </div>
    </main>
  );
}
