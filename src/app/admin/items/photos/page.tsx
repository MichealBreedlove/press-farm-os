import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { PhotosManagerClient } from "./PhotosManagerClient";

export const dynamic = "force-dynamic";

/**
 * /admin/items/photos — Catalog photo library manager.
 *
 * Replaces the old static `public/items/` directory (which couldn't be
 * mutated at runtime). All catalog photos now live in Supabase Storage,
 * so admin can upload many at once, multi-select, and bulk-delete from
 * the browser without redeploying.
 *
 * Auth is admin-only. The page itself loads no photo data server-side —
 * the client fetches /api/photos so it can refresh after upload/delete
 * without a full page reload.
 */
export default async function AdminItemsPhotosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") redirect("/admin/dashboard");

  return (
    <main className="pb-24">
      <header className="page-header">
        <h1 className="page-title">Photo Library</h1>
      </header>
      <EditorialHero
        eyebrow="Item Catalog"
        title="Photo Library"
        subtitle="Upload many at once · multi-select to delete"
        flower="nasturtium"
        backHref="/admin/items"
      />

      <div className="px-4 py-4 max-w-3xl mx-auto">
        <PhotosManagerClient />
      </div>
    </main>
  );
}
