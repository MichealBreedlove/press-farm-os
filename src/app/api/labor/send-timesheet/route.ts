import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import LaborTimesheet from "@/emails/labor-timesheet";

/**
 * POST /api/labor/send-timesheet — Send weekly timesheet to supervisor
 * Reads email_labor_report from farm_settings.
 *
 * Email format (one line per entry):
 *   4/17 Nick 6:30 - 10:00, 10:30 - 3:00       (clock-times entry, with lunch)
 *   4/17 Nick 6:30 - 3:00                       (clock-times entry, no lunch)
 *   4/17 Nick 8h                                (legacy hours-only entry)
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { week_start, entries } = await request.json();

  const admin = createAdminClient();

  // Get supervisor email from settings
  const { data: settings } = await (admin as any)
    .from("farm_settings")
    .select("value")
    .eq("key", "email_labor_report")
    .single();

  const toEmail = settings?.value;
  if (!toEmail) {
    return NextResponse.json({ error: "No labor report email configured. Go to Settings → Email Settings." }, { status: 400 });
  }

  // Format the week label
  const weekDate = new Date(week_start + "T12:00:00");
  const weekLabel = `${weekDate.getMonth() + 1}/${weekDate.getDate()}`;

  // Group entries by date (sorted ascending) so the email lists 5/12 before 5/13.
  const byDate: Record<string, any[]> = {};
  for (const e of entries) {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  }

  const days = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, workers]) => {
      const d = new Date(date + "T12:00:00");
      const dateLabel = `${d.getMonth() + 1}/${d.getDate()}`;
      return {
        dateLabel,
        workers: workers.map((w: any) => {
          const range = formatTimeRange(w);
          const tail = range ?? `${w.hours}h`;
          return { name: w.worker_name, tail, notes: w.notes ?? null };
        }),
      };
    });

  // Plain-text fallback for clients that strip styling.
  let fallbackText = `Hello Chef ,\n\nHere's the timesheet for week of ${weekLabel}\n\n`;
  for (const day of days) {
    for (const w of day.workers) {
      const noteSuffix = w.notes ? ` - ${w.notes}` : "";
      fallbackText += `${day.dateLabel} ${w.name} ${w.tail}${noteSuffix}\n`;
    }
  }
  fallbackText += `\nBest Regards\nMicheal Breedlove`;

  // Send via Resend
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { FROM_ADDRESSES } = await import("@/lib/constants");
    const reactEl = LaborTimesheet({
      weekLabel,
      days,
      signOff: "Micheal Breedlove",
    }) as React.ReactElement;

    await resend.emails.send({
      from: FROM_ADDRESSES.timesheet,
      to: toEmail,
      subject: `Timesheet for week of ${weekLabel}`,
      text: fallbackText,
      react: reactEl,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[EMAIL] Timesheet send error:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}

/**
 * Build the "6:30 - 10:00, 10:30 - 3:00" range from a labor entry,
 * or null if the entry doesn't have clock times (legacy hours-only).
 * Times are 12-hour without AM/PM to match the example email format.
 */
function formatTimeRange(entry: any): string | null {
  if (!entry.time_in || !entry.time_out) return null;
  const inT = fmtTime(entry.time_in);
  const outT = fmtTime(entry.time_out);
  if (entry.lunch_out && entry.lunch_in) {
    return `${inT} - ${fmtTime(entry.lunch_out)}, ${fmtTime(entry.lunch_in)} - ${outT}`;
  }
  return `${inT} - ${outT}`;
}

function fmtTime(value: string): string {
  const m = value.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return value;
  const h24 = parseInt(m[1], 10);
  const mm = m[2];
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mm}`;
}
