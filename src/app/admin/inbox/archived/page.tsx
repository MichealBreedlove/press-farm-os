import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { Archive } from "lucide-react";
import { RestoreButton } from "./RestoreButton";

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
          <h1 className="page-title">Archived</h1>
        </div>
      </header>

      <EditorialHero
        eyebrow="Inbox"
        title="Archived"
        subtitle="Triaged replies. Open one to re-read, or restore it to the inbox."
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
                <li key={m.id} className="card px-4 py-3 flex items-center gap-3">
                  <Link
                    href={`/admin/inbox/${m.id}`}
                    className="block flex-1 min-w-0 opacity-70 hover:opacity-100 transition-opacity"
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
                  <RestoreButton messageId={m.id} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
