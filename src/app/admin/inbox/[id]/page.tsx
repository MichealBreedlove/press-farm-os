import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { InboxActions } from "./InboxActions";
import { TaskDraftCard } from "@/components/admin/tasks/TaskDraftCard";
import type { InboxTaskDraft } from "@/types/database";

export const dynamic = "force-dynamic";

interface MessageRow {
  id: string;
  from_email: string;
  from_name: string | null;
  to_email: string;
  subject: string | null;
  text_body: string | null;
  html_body: string | null;
  status: "unread" | "read" | "archived";
  extraction_status: "pending" | "done" | "failed" | "skipped";
  extraction_error: string | null;
  received_at: string;
  in_reply_to: string | null;
  matched_user_id: string | null;
  matched_restaurant_id: string | null;
}

interface SuggestionRow {
  id: string;
  text: string;
  status: string;
  created_at: string;
}

function fallbackTextFromHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/ /g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default async function InboxDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: msgData, error } = await (admin as any)
    .from("inbound_messages")
    .select(
      "id, from_email, from_name, to_email, subject, text_body, html_body, status, extraction_status, extraction_error, received_at, in_reply_to, matched_user_id, matched_restaurant_id",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error || !msgData) notFound();
  const msg = msgData as MessageRow;

  // Auto-mark as read on view (don't overwrite archived)
  if (msg.status === "unread") {
    await (admin as any)
      .from("inbound_messages")
      .update({ status: "read" })
      .eq("id", msg.id);
  }

  // Restaurant name for header
  let restaurantName: string | null = null;
  if (msg.matched_restaurant_id) {
    const { data: r } = await (admin as any)
      .from("restaurants")
      .select("name")
      .eq("id", msg.matched_restaurant_id)
      .maybeSingle();
    restaurantName = r?.name ?? null;
  }

  // Extracted suggestions linked to this message
  const { data: sData } = await (admin as any)
    .from("suggestions")
    .select("id, text, status, created_at")
    .eq("inbound_message_id", msg.id)
    .order("created_at", { ascending: true });
  const suggestions = (sData ?? []) as SuggestionRow[];

  // Pending task drafts proposed for this email. Tolerant: migration 062
  // may not be applied yet — return [] so the page still renders.
  let drafts: InboxTaskDraft[] = [];
  try {
    const { data: dData } = await (admin as any)
      .from("inbox_task_drafts")
      .select("*")
      .eq("inbound_message_id", msg.id)
      .in("status", ["pending", "edited"])
      .order("created_at", { ascending: true });
    drafts = (dData ?? []) as InboxTaskDraft[];
  } catch {
    // migration 062 not applied
  }

  const bodyText = msg.text_body?.trim() || (msg.html_body ? fallbackTextFromHtml(msg.html_body) : "");
  const senderName = msg.from_name?.trim() || msg.from_email;
  const mailtoSubject = encodeURIComponent(
    msg.subject?.toLowerCase().startsWith("re:") ? msg.subject : `Re: ${msg.subject ?? ""}`,
  );
  const mailtoHref = `mailto:${msg.from_email}?subject=${mailtoSubject}`;

  return (
    <main className="pb-24">
      <header className="page-header">
        <div className="flex items-center gap-3">
          <a href="/admin/inbox" className="text-white/70 hover:text-white min-h-0 min-w-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <h1 className="page-title">Reply</h1>
        </div>
      </header>

      <EditorialHero
        eyebrow="Inbox"
        title={msg.subject?.trim() || "(no subject)"}
        subtitle={`From ${senderName}${restaurantName ? ` · ${restaurantName}` : ""} · ${new Date(
          msg.received_at,
        ).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`}
        backHref="/admin/inbox"
      />

      <div className="px-4 py-5 max-w-3xl mx-auto space-y-4">
        {/* Sender details + actions */}
        <div className="card p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <div className="text-sm text-farm-dark font-medium truncate">{senderName}</div>
              <div className="text-xs text-farm-muted truncate">{msg.from_email}</div>
              {!msg.matched_user_id && (
                <div className="text-xs text-amber-700 mt-1">
                  Unknown sender — not matched to a chef profile
                </div>
              )}
            </div>
            <InboxActions
              messageId={msg.id}
              status={msg.status}
              extractionStatus={msg.extraction_status}
            />
          </div>
          <a
            href={mailtoHref}
            className="btn-secondary w-full text-center inline-block"
          >
            Reply in your mail client
          </a>
        </div>

        {/* Reply body */}
        <div className="card p-4">
          <div className="text-[10px] uppercase tracking-wider text-farm-muted mb-2">Message</div>
          {bodyText ? (
            <pre className="whitespace-pre-wrap text-sm text-farm-dark font-sans leading-relaxed">
              {bodyText}
            </pre>
          ) : (
            <div className="text-sm text-farm-muted italic">(empty body)</div>
          )}
        </div>

        {/* Extracted suggestions */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] uppercase tracking-wider text-farm-muted">
              Extracted Item Requests
            </div>
            <div className="text-[10px] text-farm-muted">
              Status: <span className="font-medium">{msg.extraction_status}</span>
            </div>
          </div>

          {msg.extraction_status === "pending" && (
            <div className="text-sm text-farm-muted italic">
              Running extraction… refresh in a moment.
            </div>
          )}

          {msg.extraction_status === "failed" && (
            <div className="text-sm text-amber-700">
              Extraction failed
              {msg.extraction_error ? (
                <div className="text-xs text-amber-700/80 mt-1 font-mono">{msg.extraction_error}</div>
              ) : null}
              <div className="mt-2 text-xs text-farm-muted">
                Use the &ldquo;Re-run&rdquo; button above to try again.
              </div>
            </div>
          )}

          {msg.extraction_status === "skipped" && (
            <div className="text-sm text-farm-muted italic">
              No items extracted ({msg.extraction_error ?? "skipped"}).
            </div>
          )}

          {msg.extraction_status === "done" && suggestions.length === 0 && (
            <div className="text-sm text-farm-muted italic">
              No item requests detected in this reply.
            </div>
          )}

          {suggestions.length > 0 && (
            <ul className="space-y-2">
              {suggestions.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start gap-2 text-sm text-farm-dark border-l-2 border-farm-green/40 pl-3"
                >
                  <span className="flex-1">{s.text}</span>
                  <span className="text-[10px] uppercase tracking-wider text-farm-muted">
                    {s.status}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {suggestions.length > 0 && (
            <div className="mt-3 pt-3 border-t border-pf-master-gold/15 text-xs">
              <Link
                href="/admin/settings/suggestions"
                className="text-pf-master-gold hover:text-pf-master-gold/80"
              >
                Open suggestion box →
              </Link>
            </div>
          )}
        </div>

        {/* Proposed tasks — LLM-generated growing schedules awaiting your
            review. Confirming a card materializes the schedule into
            farm_tasks rows. */}
        {drafts.length > 0 && (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] uppercase tracking-wider text-farm-muted">
                Proposed Tasks
              </div>
              <Link
                href="/admin/tasks?tab=drafts"
                className="text-[11px] text-pf-master-gold hover:text-pf-master-gold/80"
              >
                All drafts →
              </Link>
            </div>
            <div className="space-y-3">
              {drafts.map((d) => (
                <TaskDraftCard key={d.id} draft={d} />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
