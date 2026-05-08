import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  let body = `Hello Chef ,\n\nHere's the timesheet for week of ${weekLabel}\n\n`;

  // Group entries by date
  const byDate: Record<string, any[]> = {};
  for (const e of entries) {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  }

  for (const [date, workers] of Object.entries(byDate).sort()) {
    const d = new Date(date + "T12:00:00");
    const dateLabel = `${d.getMonth() + 1}/${d.getDate()}`;
    for (const w of workers) {
      const range = formatTimeRange(w);
      const tail = range ?? `${w.hours}h`;
      const noteSuffix = w.notes ? ` - ${w.notes}` : "";
      body += `${dateLabel} ${w.worker_name} ${tail}${noteSuffix}\n`;
    }
  }

  body += `\nBest Regards\nMicheal Breedlove`;

  // Send via Resend
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { FROM_ADDRESSES } = await import("@/lib/constants");
    await resend.emails.send({
      from: FROM_ADDRESSES.timesheet,
      to: toEmail,
      subject: `Timesheet for week of ${weekLabel}`,
      text: body,
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
