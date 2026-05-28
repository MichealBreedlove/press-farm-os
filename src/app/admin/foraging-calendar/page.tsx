import { EditorialHero } from "@/components/shared/EditorialHero";
import { ForagingCalendarClient } from "./ForagingCalendarClient";
import { FORAGE_ITEMS } from "@/lib/foraging-calendar-data";

export const dynamic = "force-dynamic";

export default function ForagingCalendarPage() {
  const month = new Date().getMonth() + 1; // 1–12

  return (
    <main className="pb-24">
      <header className="page-header">
        <h1 className="page-title">Foraging Calendar</h1>
        <p className="text-sm text-white/60">Seasonal wild-food reference</p>
      </header>
      <EditorialHero
        eyebrow="Field Reference"
        title="Foraging Calendar"
        subtitle={`${FORAGE_ITEMS.length} wild-food species across the SF Bay Area — Marin, East Bay, Peninsula, and Santa Cruz Mountains.`}
        flower="green-leaf"
        backHref="/admin/dashboard"
      />
      <ForagingCalendarClient defaultMonth={month} />
    </main>
  );
}
