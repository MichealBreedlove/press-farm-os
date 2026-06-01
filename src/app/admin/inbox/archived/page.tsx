import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { Archive } from "lucide-react";

export const dynamic = "force-dynamic";

interface ArchivedRow {
  id: string;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  received_at: string;
}

export default async function ArchivedInboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data } = await admin
    .from("inbound_messages")
    .select("id, from_email, from_name, subject, received_at")
    .eq("status", "archived")
    .order("received_at", { ascending: false })
    .limit(500);

  const messages = (data ?? []) as ArchivedRow[];

  return (
    <main className="pb-24">
      <header className="page-header">
        <div className="flex items-center gap-3">
          <a href="/admin/inbox" className="text-white/70 hover:text-white min-h-0 min-w-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <h1 className="page-title">Archived</h1>
        </div>
      </header>

      <EditorialHero
        eyebrow="Inbox"
        title="Archived"
        subtitle="Triaged replies. Click through to re-read or restore."
        flower="bachelor-button"
        backHref="/admin/inbox"
      />

      <div className="px-4 py-4 max-w-3xl mx-auto">
        {messages.length === 0 ? (
          <div className="text-center py-16 text-sm text-farm-muted">
            <Archive className="w-8 h-8 mx-auto mb-3 opacity-50" />
            Nothing archived yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {messages.map((m) => {
              const senderName = m.from_name?.trim() || m.from_email;
              return (
                <li key={m.id}>
                  <Link
                    href={`/admin/inbox/${m.id}`}
                    className="block card px-4 py-3 opacity-70 hover:opacity-100 transition-opacity"
                  >
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className="text-sm text-farm-dark truncate">{senderName}</span>
                      <span className="text-xs text-farm-muted/60 ml-auto flex-shrink-0">
                        {new Date(m.received_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="text-sm text-farm-dark/70 truncate">
                      {m.subject?.trim() || "(no subject)"}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
