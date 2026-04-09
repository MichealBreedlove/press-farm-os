import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { NotesClient } from "./NotesClient";

export default async function AdminNotesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Notes are stored in a simple table — for now we'll use farm_expenses description
  // as a proxy, but ideally we'd have a notes table. Let's check if one exists.
  // For MVP, we'll create a client-side notes system using localStorage + future DB table.

  return (
    <main className="pb-24">
      <header className="page-header">
        <h1 className="page-title">Notes & Observations</h1>
        <p className="text-sm text-white/60">Track what you see in the field</p>
      </header>
      <div className="px-4 py-6">
        <NotesClient />
      </div>
    </main>
  );
}
