import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { NotesClient } from "./NotesClient";
import { EditorialHero } from "@/components/shared/EditorialHero";

export default async function AdminNotesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: notes } = await (admin as any)
    .from("farm_notes")
    .select("id, date, text, category")
    .order("date", { ascending: false });

  return (
    <main className="pb-24">
      <header className="page-header">
        <h1 className="page-title">Notes & Observations</h1>
        <p className="text-sm text-white/60">Track what you see in the field</p>
      </header>
      <EditorialHero
        eyebrow="Farm Management"
        title="Field Journal"
        subtitle="Quick observations from the rows"
        flower="viola"
        backHref="/admin/dashboard"
      />
      <div className="px-4 py-6">
        <NotesClient initialNotes={notes ?? []} />
      </div>
    </main>
  );
}
