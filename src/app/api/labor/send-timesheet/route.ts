import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/labor/send-timesheet — Send weekly timesheet to supervisor
 * Reads email_labor_report from farm_settings
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

  // Build the timesheet body
  let body = `Hello Chef,\n\nHere's the timesheet for week of ${weekLabel}\n\n`;

  // Group entries by date
  const byDate: Record<string, { worker: string; hours: number; notes: string | null }[]> = {};
  for (const e of entries) {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push({ worker: e.worker_name, hours: e.hours, notes: e.notes });
  }

  for (const [date, workers] of Object.entries(byDate).sort()) {
    const d = new Date(date + "T12:00:00");
    const dateLabel = `${d.getMonth() + 1}/${d.getDate()}`;
    for (const w of workers) {
      body += `${dateLabel} ${w.worker} ${w.hours}h${w.notes ? ` - ${w.notes}` : ""}\n`;
    }
  }

  body += `\nBest Regards,\nMicheal Breedlove`;

  // Send via Resend
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: "Press Farm <orders@pressfarm.app>",
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
