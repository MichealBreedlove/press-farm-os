import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { Mail, MailOpen, Archive, Sprout } from "lucide-react";

export const dynamic = "force-dynamic";

interface InboundRow {
  id: string;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  text_body: string | null;
  status: "unread" | "read" | "archived";
  extraction_status: "pending" | "done" | "failed" | "skipped";
  received_at: string;
  matched_restaurant_id: string | null;
}

interface SuggestionCount {
  inbound_message_id: string;
  count: number;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.round((now - then) / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function truncate(s: string | null, n: number): string {
  if (!s) return "";
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > n ? `${clean.slice(0, n - 1)}…` : clean;
}

export default async function InboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: messagesData } = await admin
    .from("inbound_messages")
    .select(
      "id, from_email, from_name, subject, text_body, status, extraction_status, received_at, matched_restaurant_id",
    )
    .neq("status", "archived")
    .order("received_at", { ascending: false })
    .limit(200);

  const messages = (messagesData ?? []) as InboundRow[];

  // Restaurants for matched-restaurant display
  const restaurantIds = Array.from(
    new Set(messages.map((m) => m.matched_restaurant_id).filter(Boolean)),
  ) as string[];
  let restaurantMap = new Map<string, string>();
  if (restaurantIds.length > 0) {
    const { data: rData } = await admin
      .from("restaurants")
      .select("id, name")
      .in("id", restaurantIds);
    restaurantMap = new Map((rData ?? []).map((r: { id: string; name: string }) => [r.id, r.name]));
  }

  // Suggestions counts per inbound message (only for messages on this page)
  const messageIds = messages.map((m) => m.id);
  let suggestionCounts = new Map<string, number>();
  if (messageIds.length > 0) {
    const { data: sData } = await admin
      .from("suggestions")
      .select("inbound_message_id")
      .in("inbound_message_id", messageIds);
    for (const row of (sData ?? []) as { inbound_message_id: string }[]) {
      suggestionCounts.set(
        row.inbound_message_id,
        (suggestionCounts.get(row.inbound_message_id) ?? 0) + 1,
      );
    }
  }

  // Stat strip
  const unreadCount = messages.filter((m) => m.status === "unread").length;
  const withRequests = messages.filter((m) => (suggestionCounts.get(m.id) ?? 0) > 0).length;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const thisMonth = messages.filter((m) => new Date(m.received_at) >= monthStart).length;

  return (
    <main className="pb-24">
      <header className="page-header">
        <div className="flex items-center gap-3">
          <a href="/admin/dashboard" className="text-white/70 hover:text-white min-h-0 min-w-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <h1 className="page-title">Chef Inbox</h1>
        </div>
      </header>

      <EditorialHero
        eyebrow="Replies From Chefs"
        title="Chef Inbox"
        subtitle="Messages chefs send back. Item requests get auto-extracted into the suggestion box."
        flower="bachelor-button"
        backHref="/admin/dashboard"
      />

      {/* Stat strip */}
      <div className="px-4 py-4 border-b border-pf-master-gold/15 bg-white">
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-2xl font-display text-farm-dark">{unreadCount}</div>
            <div className="text-[10px] uppercase tracking-wider text-farm-muted mt-0.5">Unread</div>
          </div>
          <div>
            <div className="text-2xl font-display text-farm-dark">{thisMonth}</div>
            <div className="text-[10px] uppercase tracking-wider text-farm-muted mt-0.5">This Month</div>
          </div>
          <div>
            <div className="text-2xl font-display text-farm-dark">{withRequests}</div>
            <div className="text-[10px] uppercase tracking-wider text-farm-muted mt-0.5">With Items</div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 max-w-3xl mx-auto">
        {messages.length === 0 ? (
          <div className="text-center py-16">
            <img
              src="/assets/pressfarm/flowers/bachelor-button.png"
              alt=""
              aria-hidden="true"
              className="mx-auto h-24 w-auto mb-4 opacity-60"
            />
            <h3 className="text-base font-semibold text-farm-dark">No replies yet</h3>
            <p className="text-sm text-farm-muted mt-1.5 max-w-sm mx-auto">
              When a chef replies to any Press Farm email, it lands here.
            </p>
            <p className="text-xs text-farm-muted/70 mt-3">
              Replies route to <code className="text-pf-master-gold">replies@pressfarm.io</code>.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {messages.map((m) => {
              const requestCount = suggestionCounts.get(m.id) ?? 0;
              const isUnread = m.status === "unread";
              const senderName = m.from_name?.trim() || m.from_email;
              const restaurant = m.matched_restaurant_id
                ? restaurantMap.get(m.matched_restaurant_id)
                : null;
              const Icon = isUnread ? Mail : MailOpen;
              return (
                <li key={m.id}>
                  <Link
                    href={`/admin/inbox/${m.id}`}
                    className={`block card px-4 py-3 transition-colors ${
                      isUnread ? "border-l-4 border-l-farm-green" : "opacity-80"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon
                        className={`w-4 h-4 flex-shrink-0 mt-1 ${
                          isUnread ? "text-farm-green" : "text-farm-muted"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span
                            className={`text-sm truncate ${
                              isUnread ? "font-semibold text-farm-dark" : "text-farm-dark"
                            }`}
                          >
                            {senderName}
                          </span>
                          {restaurant && (
                            <span className="text-xs text-farm-muted truncate">· {restaurant}</span>
                          )}
                          <span className="text-xs text-farm-muted/60 ml-auto flex-shrink-0">
                            {formatRelative(m.received_at)}
                          </span>
                        </div>
                        <div className="text-sm text-farm-dark/80 truncate mb-0.5">
                          {m.subject?.trim() || "(no subject)"}
                        </div>
                        <div className="text-xs text-farm-muted line-clamp-2">
                          {truncate(m.text_body, 180)}
                        </div>
                        {requestCount > 0 && (
                          <div className="flex items-center gap-1.5 mt-2 text-xs text-farm-green">
                            <Sprout className="w-3 h-3" />
                            <span>
                              {requestCount} item request{requestCount === 1 ? "" : "s"} →
                              suggestions
                            </span>
                          </div>
                        )}
                        {m.extraction_status === "failed" && (
                          <div className="text-xs text-amber-700 mt-1">
                            Extraction failed — open to re-run
                          </div>
                        )}
                        {m.extraction_status === "pending" && (
                          <div className="text-xs text-farm-muted/70 mt-1 italic">
                            Extracting items…
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <div className="text-center mt-6">
          <Link
            href="/admin/inbox/archived"
            className="text-xs text-farm-muted hover:text-farm-dark inline-flex items-center gap-1.5"
          >
            <Archive className="w-3.5 h-3.5" />
            View archived
          </Link>
        </div>
      </div>
    </main>
  );
}
