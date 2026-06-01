import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { CalendarView } from "@/components/admin/microgreens/CalendarView";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const admin = createAdminClient();
  const today = new Date();
  const back = new Date(today.getTime() - 45 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const fwd  = new Date(today.getTime() + 60 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const { data } = await admin
    .from("microgreen_batches")
    .select(`
      *,
      crop:microgreen_crops(
        name, variety,
        presoak_hours, presprout_hours,
        blackout_days, ideal_harvest_day,
        harvest_min_days, harvest_max_days,
        is_continuous_harvest, productive_life_days
      )
    `)
    .gte("sow_date", back).lte("planned_harvest_date", fwd);

  return (
    <main className="pb-24">
      <EditorialHero eyebrow="Microgreens" title="Calendar" backHref="/admin/microgreens" />
      <div className="px-4 max-w-4xl mx-auto">
        <CalendarView batches={data ?? []} />
      </div>
    </main>
  );
}
