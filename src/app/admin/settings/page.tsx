import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { adminNavFor } from "@/lib/admin-nav";

// Cards come from the shared admin directory so this hub, the dashboard and
// BottomNav's sheet never drift apart.
const NAV_CARDS = adminNavFor("settings").find((s) => s.key === "settings")?.links ?? [];

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="pb-24">
      <header className="page-header">
        <h1 className="page-title">Settings</h1>
      </header>
      <EditorialHero
        eyebrow="Configuration"
        title="Settings"
        subtitle="App config, users, integrations"
        flower="fennel"
        backHref="/admin/dashboard"
      />

      <div className="px-4 py-6 space-y-3">
        {NAV_CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="flex items-center justify-between card-interactive px-4 py-4"
          >
            <div>
              <p className="text-sm font-semibold text-farm-dark">{card.label}</p>
              <p className="text-xs text-farm-muted mt-0.5">{card.description}</p>
            </div>
            <svg className="w-5 h-5 text-farm-muted/60 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>
    </main>
  );
}
