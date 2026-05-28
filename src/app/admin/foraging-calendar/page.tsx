import { EditorialHero } from "@/components/shared/EditorialHero";
import { ForagingCalendarClient } from "./ForagingCalendarClient";
import { countByCategory, itemsInPeak, MONTH_LABELS } from "@/lib/foraging-calendar-data";

export const dynamic = "force-dynamic";

export default function ForagingCalendarPage() {
  const month = new Date().getMonth() + 1; // 1–12
  const counts = countByCategory();
  const inPeak = itemsInPeak(month);

  return (
    <main className="pb-24">
      <header className="page-header">
        <h1 className="page-title">Foraging Calendar</h1>
        <p className="text-sm text-white/60">Wild harvest reference, North Bay</p>
      </header>
      <EditorialHero
        eyebrow="Field Reference"
        title="Foraging Calendar"
        subtitle={`Seasonal wild-food guide for the Napa / North Bay region. ${MONTH_LABELS[month - 1]} brings ${inPeak.length} ${inPeak.length === 1 ? "harvest" : "harvests"} at peak.`}
        flower="green-leaf"
        backHref="/admin/dashboard"
      />
      <ForagingCalendarClient
        currentMonth={month}
        counts={counts}
        inPeakNow={inPeak}
      />
    </main>
  );
}
