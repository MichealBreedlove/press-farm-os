import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { formatDeliveryDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ date: string }>;
}

/**
 * /admin/orders/[date]/notifications — Receiver-notify history for a date.
 *
 * Reverse-chronological list of every "Finish & Send to Receiver" event
 * for this delivery date. Each row shows the timestamp, who sent it, the
 * status snapshot at the moment of send, and the recipient outcomes.
 *
 * The audit log itself (receiver_notify_log) is written by POST
 * /api/receiver/notify; this page is the read-only browse view.
 */
export default async function NotificationHistoryPage({ params }: Props) {
  const { date } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const admin = createAdminClient();

  // All notify events for this date, newest first
  const { data: logs } = await (admin as any)
    .from("receiver_notify_log")
    .select(`
      id, sent_at, recipients_count, succeeded_count, failed_count,
      fulfilled_orders_count, ready_count, short_count, pending_count, extra_count,
      sender:profiles!receiver_notify_log_sent_by_fkey ( id, full_name )
    `)
    .eq("delivery_date", date)
    .order("sent_at", { ascending: false });

  const events = (logs ?? []) as any[];

  return (
    <main className="pb-24">
      <header className="page-header">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/orders/${date}`}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 text-white/70 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="page-title">Notifications</h1>
        </div>
      </header>

      <EditorialHero
        eyebrow={formatDeliveryDate(date)}
        title="Notification History"
        subtitle={`${events.length} send${events.length === 1 ? "" : "s"} for this date`}
        flower="lavender"
        backHref={`/admin/orders/${date}`}
      />

      <div className="px-4 py-6 max-w-3xl mx-auto">
        {events.length === 0 ? (
          <div className="text-center py-12 bg-white border border-farm-dark/5 rounded-2xl shadow-sm">
            <img
              src="/assets/pressfarm/flowers/lavender.png"
              alt=""
              aria-hidden="true"
              className="mx-auto h-20 w-auto mb-4 opacity-90"
            />
            <p className="font-display text-lg text-farm-dark">No notifications sent yet</p>
            <p className="text-sm text-farm-muted mt-1.5 max-w-sm mx-auto leading-relaxed">
              When you tap <strong>Finish &amp; Send to Receiver</strong> on this date&apos;s orders, each send will be logged here.
            </p>
            <Link
              href={`/admin/orders/${date}`}
              className="inline-flex items-center mt-5 px-4 py-2.5 rounded-xl bg-farm-green text-white text-sm font-semibold hover:bg-farm-dark transition-colors"
            >
              ← Back to orders
            </Link>
          </div>
        ) : (
          <ol className="space-y-3">
            {events.map((evt, i) => (
              <li key={evt.id} className="bg-white border border-farm-dark/5 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-farm-dark/5 bg-farm-cream/40 flex items-baseline justify-between gap-3">
                  <div>
                    <p className="font-display text-base text-farm-dark">
                      {new Date(evt.sent_at).toLocaleString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="text-xs text-farm-muted mt-0.5">
                      Sent by {evt.sender?.full_name ?? "—"}
                    </p>
                  </div>
                  {/* Most-recent label only on the top row */}
                  {i === 0 && (
                    <span className="text-[9px] tracking-[0.18em] uppercase bg-farm-green/15 text-farm-green px-2 py-0.5 rounded-full font-semibold">
                      Most Recent
                    </span>
                  )}
                </div>

                <div className="px-5 py-4 space-y-3">
                  {/* Recipient outcomes */}
                  <div className="flex items-baseline gap-3 text-sm">
                    <span className="font-semibold text-farm-green">
                      {evt.succeeded_count} sent
                    </span>
                    {evt.failed_count > 0 && (
                      <span className="font-semibold text-red-700">
                        {evt.failed_count} failed
                      </span>
                    )}
                    <span className="text-farm-muted text-xs">
                      to {evt.recipients_count} receiver{evt.recipients_count === 1 ? "" : "s"}
                    </span>
                  </div>

                  {/* Status snapshot at time of send */}
                  <div className="grid grid-cols-4 gap-2">
                    <Snap label="Ready" value={evt.ready_count} color="bg-farm-green" />
                    <Snap label="Short" value={evt.short_count} color="bg-pf-master-orange" />
                    <Snap label="Pending" value={evt.pending_count} color="bg-amber-500" />
                    <Snap label="Extra" value={evt.extra_count} color="bg-pf-master-blue" />
                  </div>

                  {evt.fulfilled_orders_count > 0 && (
                    <p className="text-[11px] text-farm-muted italic">
                      Closed {evt.fulfilled_orders_count} order{evt.fulfilled_orders_count === 1 ? "" : "s"} as part of this send.
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </main>
  );
}

function Snap({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-farm-cream/40 rounded-lg px-2 py-2 text-center">
      <div className="flex items-center justify-center gap-1.5">
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${color}`} aria-hidden="true" />
        <span className="font-display text-lg text-farm-dark leading-none">{value}</span>
      </div>
      <p className="text-[9px] tracking-[0.18em] uppercase text-farm-muted mt-1">{label}</p>
    </div>
  );
}
