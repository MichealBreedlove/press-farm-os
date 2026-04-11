import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const season = url.searchParams.get("season") ?? new Date().getFullYear().toString();

  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("plantings")
    .select("*, items(name, image_url, category, unit_type)")
    .eq("season", parseInt(season))
    .order("crop_name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const admin = createAdminClient();
  const { data, error } = await (admin as any)
    .from("plantings")
    .insert(body)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-generate tasks from planting dates
  if (data) {
    const tasks: { planting_id: string; task_type: string; title: string; due_date: string }[] = [];
    const p = data;

    if (p.sow_date) {
      const bedPrepDate = new Date(p.sow_date + "T12:00:00");
      bedPrepDate.setDate(bedPrepDate.getDate() - 7);
      tasks.push({ planting_id: p.id, task_type: "bed_prep", title: `Bed Prep: ${p.crop_name}`, due_date: bedPrepDate.toISOString().split("T")[0] });
      tasks.push({ planting_id: p.id, task_type: "sow", title: `Sow: ${p.crop_name}${p.variety ? ` (${p.variety})` : ""}`, due_date: p.sow_date });
    }

    if (p.harvest_start) {
      if (p.sow_date) {
        const mid = new Date((new Date(p.sow_date + "T12:00:00").getTime() + new Date(p.harvest_start + "T12:00:00").getTime()) / 2);
        tasks.push({ planting_id: p.id, task_type: "cultivate", title: `Cultivating: ${p.crop_name}`, due_date: mid.toISOString().split("T")[0] });
      }
      tasks.push({ planting_id: p.id, task_type: "harvest", title: `Harvest: ${p.crop_name}`, due_date: p.harvest_start });
    }

    if (p.harvest_end || p.termination_date) {
      tasks.push({ planting_id: p.id, task_type: "terminate", title: `Terminate: ${p.crop_name}`, due_date: p.termination_date ?? p.harvest_end });
    }

    if (tasks.length > 0) {
      await (admin as any).from("planting_tasks").insert(tasks);
    }
  }

  return NextResponse.json({ data });
}
