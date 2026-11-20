import { createAdminClient } from "@/lib/supabase/admin";
import { EditorialHero } from "@/components/shared/EditorialHero";
import { ProductionView } from "@/components/shared/ProductionView";
import {
  loadMicrogreenStatus,
  loadOrderableMicrogreens,
  loadProductionSummary,
} from "@/lib/liaison/server";
import { todayPacific } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * /liaison/production — how much product the farm brought in and what it
 * was worth: this month, last month, year to date, by restaurant, the top
 * items, the latest drop-offs, and the microgreens on hand. Numbers come
 * from logged deliveries (not orders), so they match the farm's books.
 */
export default async function LiaisonProductionPage() {
  const admin = createAdminClient();
  const today = todayPacific();
  const [p, micro, orderable] = await Promise.all([
    loadProductionSummary(admin, today),
    loadMicrogreenStatus(admin),
    loadOrderableMicrogreens(admin, today),
  ]);

  return (
    <main id="main" className="min-h-screen pb-28 bg-farm-cream">
      <EditorialHero
        eyebrow="Farm Liaison"
        title="Production"
        subtitle="What the farm delivered, in product and in dollars"
        flower="pea-flower"
        backHref="/liaison"
      />

      <ProductionView p={p} micro={micro} orderable={orderable} />
    </main>
  );
}
