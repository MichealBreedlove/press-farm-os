import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { NewTaskForm } from "@/components/admin/tasks/NewTaskForm";

export const dynamic = "force-dynamic";

export default async function NewTaskPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const { data: items } = await (admin as any)
    .from("items")
    .select("id, name")
    .eq("is_archived", false)
    .order("name", { ascending: true });

  return (
    <div className="min-h-screen">
      <EditorialHero
        eyebrow="Operations"
        title="New task"
        subtitle="Add a one-off task — not part of a recurring schedule"
        flower="borage-2"
        backHref="/admin/tasks"
      />
      <div className="max-w-md mx-auto px-4 py-6">
        <NewTaskForm items={items ?? []} />
      </div>
    </div>
  );
}
