import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { SendDigestButton } from "./SendDigestButton";
import { RefreshButton } from "./RefreshButton";
import { WeatherWidget } from "@/components/shared/WeatherWidget";
import { SEEDS_ENABLED } from "@/lib/constants";
import { listTodayTasks } from "@/lib/tasks/queries";
import { TodayWidget } from "@/components/admin/tasks/TodayWidget";
import type { FarmTask } from "@/types/database";
import { formatCurrencyWhole } from "@/lib/utils";

interface DashCard {
  href: string;
  title: string;
  description: string;
  flower: string; // brand flower illustration filename (without .png)
}

// Force the page to re-render on every request so the random KPI flowers
// (and live stats) refresh each time, instead of being cached.
export const dynamic = "force-dynamic";

// Curated pool of compact, watermark-friendly flowers for the 4 KPI tiles.
// Each refresh picks 4 distinct ones at random.
const KPI_FLOWER_POOL = [
  "calendula", "marigold", "marigold-2", "gem-marigold", "gem-marigold-2",
  "borage", "borage-2", "bachelor-button",
  "pansy", "pansy-2", "chive-blossom", "chive-blossom-2",
  "chive-blossom-3", "allium",
  "chamomile", "chamomile-2", "alyssum",
  "buttercup", "california-poppy",
  "squash-blossom", "squash-bud", "nasturtium-2",
];

function pickKpiFlowers(): [string, string, string, string] {
  const shuffled = [...KPI_FLOWER_POOL].sort(() => Math.random() - 0.5);
  return [shuffled[0], shuffled[1], shuffled[2], shuffled[3]];
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];
  const currentMonth = today.slice(0, 7);
  const monthStart = `${currentMonth}-01`;
  const [y, m] = currentMonth.split("-").map(Number);
  const monthEnd = `${currentMonth}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;

  // Parallel data fetches for stats
  const [
    { count: pendingOrders },
    { count: pendingEventRequests },
    { data: nextDate },
    { data: monthDeliveries },
    { data: monthExpenses },
    { data: weekLabor },
    { data: offScheduleOrders },
  ] = await Promise.all([
    admin.from("orders").select("*", { count: "exact", head: true }).eq("status", "submitted"),
    admin.from("event_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("delivery_dates").select("date").gte("date", today).order("date", { ascending: true }).limit(1).single(),
    admin.from("deliveries").select("total_value").gte("delivery_date", monthStart).lte("delivery_date", monthEnd),
    admin.from("farm_expenses").select("amount").gte("date", monthStart).lte("date", monthEnd),
    admin.from("labor_entries").select("hours").gte("date", (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split("T")[0]; })()),
    // Off-schedule orders: any active order whose linked delivery_date
    // has day_of_week='custom' (anything not Thu/Sat/Mon, or an ad-hoc
    // date the chef opened from the order page). Limited to 20 most
    // recent — banner shows them all but caps the query for safety.
    admin
      .from("orders")
      .select("id, delivery_date, status, restaurant:restaurants(name), delivery_dates!inner(day_of_week)")
      .in("status", ["submitted", "in_progress", "fulfilled"])
      .eq("delivery_dates.day_of_week", "custom")
      .order("delivery_date", { ascending: true })
      .limit(20),
  ]);

  const nextDeliveryDate = nextDate?.date;
  const nextDeliveryLabel = nextDeliveryDate
    ? new Date(nextDeliveryDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : null;

  const monthRevenue = (monthDeliveries ?? []).reduce((s: number, d: any) => s + (d.total_value ?? 0), 0);
  const monthExpenseTotal = (monthExpenses ?? []).reduce((s: number, e: any) => s + (e.amount ?? 0), 0);
  const weekLaborHours = (weekLabor ?? []).reduce((s: number, l: any) => s + (l.hours ?? 0), 0);

  // Today's tasks for the widget. Tolerant: migration 062 may not be applied,
  // in which case listTodayTasks returns [] and the widget shows empty-state.
  let todayTasks: FarmTask[] = [];
  let taskItemNames: Record<string, string> = {};
  let taskCropNames: Record<string, string> = {};
  try {
    const { data: farmRow } = await admin.from("farms").select("id").limit(1).single();
    if (farmRow?.id) {
      todayTasks = await listTodayTasks(admin, farmRow.id);
      const itemIds = Array.from(new Set(todayTasks.map((t) => t.item_id).filter(Boolean) as string[]));
      const cropIds = Array.from(new Set(todayTasks.map((t) => t.microgreen_crop_id).filter(Boolean) as string[]));
      if (itemIds.length > 0) {
        const { data: items } = await admin.from("items").select("id, name").in("id", itemIds);
        taskItemNames = Object.fromEntries((items ?? []).map((r: any) => [r.id, r.name]));
      }
      if (cropIds.length > 0) {
        const { data: crops } = await admin
          .from("microgreen_crops")
          .select("id, name")
          .in("id", cropIds);
        taskCropNames = Object.fromEntries((crops ?? []).map((r: any) => [r.id, r.name]));
      }
    }
  } catch {
    // migration not applied — widget shows empty
  }

  // Each function gets a brand flower instead of a colored icon tile.
  // Mapping is loose-symbolic: signature crops for hero functions, supporting
  // botanicals for utility functions.
  const sections: { title: string; eyebrow: string; cards: DashCard[] }[] = [
    {
      title: "Daily Operations",
      eyebrow: "The day's work",
      cards: [
        { href: "/admin/orders", title: "Orders", description: `${pendingOrders ?? 0} pending`, flower: "squash-blossom" },
        { href: "/admin/availability", title: "Availability", description: "What's ready to harvest", flower: "calendula" },
        { href: "/admin/deliveries", title: "Deliveries", description: "Log & calendar", flower: "marigold" },
        { href: "/admin/calendar", title: "Calendar", description: "Month-at-a-glance", flower: "anise-hyssop" },
        {
          href: "/admin/event-requests",
          title: "Event Requests",
          description: (pendingEventRequests ?? 0) > 0
            ? `${pendingEventRequests} pending review`
            : "Advance order requests",
          flower: "borage",
        },
      ],
    },
    {
      title: "Farm Management",
      eyebrow: "Behind the harvest",
      cards: [
        { href: "/admin/items", title: "Items", description: "Catalog & photos", flower: "nasturtium" },
        { href: "/admin/crop-plan", title: "Crop Plan", description: "Seasonal schedule", flower: "squash-bud" },
        ...(SEEDS_ENABLED
          ? [{ href: "/admin/seeds", title: "Seeds", description: "On-hand inventory", flower: "calendula" }]
          : []),
        { href: "/admin/labor", title: "Labor", description: "Track hours", flower: "lavender" },
        { href: "/admin/expenses", title: "Expenses", description: "Track costs", flower: "chive-blossom" },
        { href: "/admin/notes", title: "Notes", description: "Field observations", flower: "pansy" },
        { href: "/admin/forecast", title: "Forecast", description: "Predict next harvest", flower: "bachelor-button" },
        { href: "/admin/foraging-calendar", title: "Foraging", description: "Wild harvest by season", flower: "green-leaf" },
      ],
    },
    {
      title: "Reports & Analytics",
      eyebrow: "By the numbers",
      cards: [
        { href: "/admin/reports", title: "Reports", description: "Revenue & P&L", flower: "green-leaf" },
        { href: "/admin/reports/executive", title: "Executive", description: "Print summary", flower: "gem-marigold" },
      ],
    },
    {
      title: "Settings",
      eyebrow: "Configuration",
      cards: [
        { href: "/admin/settings/users", title: "Users", description: "Manage accounts", flower: "pansy" },
        { href: "/admin/settings", title: "Settings", description: "App config", flower: "fennel" },
        { href: "/admin/ui-kit", title: "UI Kit", description: "Brand reference", flower: "allium" },
      ],
    },
  ];

  const monthName = new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long" });
  const todayDate = new Date();
  const dayOfWeek = todayDate.toLocaleDateString("en-US", { weekday: "long" });
  const monthDay = todayDate.toLocaleDateString("en-US", { month: "long", day: "numeric" });

  // Editorial subtitle that summarizes the day at a glance
  const subtitleParts: string[] = [];
  if (nextDeliveryLabel) subtitleParts.push(`Next delivery ${nextDeliveryLabel}`);
  if ((pendingOrders ?? 0) > 0) {
    subtitleParts.push(`${pendingOrders} order${pendingOrders === 1 ? "" : "s"} awaiting fulfillment`);
  }
  if (subtitleParts.length === 0) subtitleParts.push("All caught up");

  return (
    <main className="pb-24">
      <header className="page-header">
        <h1 className="page-title">Dashboard</h1>
      </header>

      {/* HERO — magazine-cover moment with weather */}
      <section className="px-5 pt-8 pb-6 bg-farm-cream/60 border-b border-pf-master-gold/20">
        <div className="flex items-start gap-4 max-w-3xl mx-auto">
          <div className="flex-1 min-w-0">
            <p
              className="text-[11px] tracking-[0.22em] uppercase text-pf-master-gold font-medium mb-2"
              style={{ fontFamily: "'Bank Gothic LT', 'BankGothic Lt BT', 'Bank Gothic', sans-serif" }}
            >
              {dayOfWeek} · {monthDay}
            </p>
            <h2 className="font-display text-3xl sm:text-4xl text-farm-dark leading-tight">
              Today at the Farm
            </h2>
            <p className="text-sm text-farm-muted mt-3 leading-relaxed max-w-md">
              {subtitleParts.join(" · ")}
            </p>
          </div>
          <div className="flex-shrink-0">
            <WeatherWidget />
          </div>
        </div>
        {/* Gold dot rule */}
        <div className="max-w-3xl mx-auto mt-6 flex items-center gap-2">
          <div className="flex-1 h-px bg-pf-master-gold/30" />
          <div className="w-1.5 h-1.5 rounded-full bg-pf-master-gold" />
          <div className="flex-1 h-px bg-pf-master-gold/30" />
        </div>
      </section>

      <div className="px-4 py-6 space-y-8 max-w-3xl mx-auto">

        {/* Today's tasks widget — operational pulse. Always visible (empty
            state when there's nothing due). Links to /admin/tasks. */}
        <TodayWidget
          tasks={todayTasks}
          itemNames={taskItemNames}
          cropNames={taskCropNames}
        />

        {/* Off-schedule orders banner — flagged when a chef ordered for
            a date outside the standard Thu/Sat/Mon schedule. Stays
            visible until those orders are fulfilled and the date
            falls out of the active set. */}
        {offScheduleOrders && offScheduleOrders.length > 0 && (
          <section className="bg-red-50 border-2 border-red-300 rounded-2xl px-5 py-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span aria-hidden="true" className="text-2xl leading-none flex-shrink-0">⚠️</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-red-800">
                  Off-schedule order{offScheduleOrders.length === 1 ? "" : "s"}
                </p>
                <p className="text-sm text-red-900 mt-1 leading-snug">
                  {offScheduleOrders.length} order{offScheduleOrders.length === 1 ? " was" : "s were"} placed outside the normal Thu / Sat / Mon delivery schedule.
                </p>
                <ul className="mt-3 space-y-1">
                  {offScheduleOrders.map((o: any) => {
                    const formatted = new Date(o.delivery_date + "T12:00:00").toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    });
                    return (
                      <li key={o.id}>
                        <a
                          href={`/admin/orders/${o.delivery_date}`}
                          className="inline-flex items-center gap-2 text-sm text-red-900 hover:underline"
                        >
                          <span className="font-semibold">{formatted}</span>
                          <span className="text-red-800/80">·</span>
                          <span>{(o.restaurant as any)?.name ?? "Restaurant"}</span>
                          <span className="text-[10px] tracking-wider uppercase text-red-800/70 px-1.5 py-0.5 rounded bg-red-100">
                            {o.status}
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* AT A GLANCE — KPI tiles */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="section-eyebrow with-flower text-farm-muted">{monthName} at a glance</p>
            <RefreshButton />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(() => {
              const [revFlower, expFlower, pendFlower, labFlower] = pickKpiFlowers();
              return (
                <>
                  <Link href={`/admin/deliveries?month=${currentMonth}`} className="card-interactive p-4 relative overflow-hidden">
                    <img src={`/assets/pressfarm/flowers/${revFlower}.png`} alt="" aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 w-24 h-24 opacity-25 pointer-events-none" />
                    <p className="text-xs text-farm-muted relative">{monthName} Revenue</p>
                    <p className="text-2xl font-bold text-farm-green mt-1 relative">{formatCurrencyWhole(monthRevenue)}</p>
                    <p className="text-[10px] text-farm-muted mt-1 relative">{(monthDeliveries ?? []).length} deliveries</p>
                  </Link>
                  <Link href={`/admin/expenses?month=${currentMonth}`} className="card-interactive p-4 relative overflow-hidden">
                    <img src={`/assets/pressfarm/flowers/${expFlower}.png`} alt="" aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 w-24 h-24 opacity-25 pointer-events-none" />
                    <p className="text-xs text-farm-muted relative">{monthName} Expenses</p>
                    <p className="text-2xl font-bold text-pf-master-orange mt-1 relative">{formatCurrencyWhole(monthExpenseTotal)}</p>
                    <p className="text-[10px] text-farm-muted mt-1 relative">{(monthExpenses ?? []).length} entries</p>
                  </Link>
                  <Link href="/admin/orders?status=submitted" className="card-interactive p-4 relative overflow-hidden">
                    <img src={`/assets/pressfarm/flowers/${pendFlower}.png`} alt="" aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 w-24 h-24 opacity-25 pointer-events-none" />
                    <p className="text-xs text-farm-muted relative">Pending Orders</p>
                    <p className="text-2xl font-bold text-farm-green mt-1 relative">{pendingOrders ?? 0}</p>
                    <p className="text-[10px] text-farm-muted mt-1 relative">awaiting fulfillment</p>
                  </Link>
                  <Link href="/admin/labor" className="card-interactive p-4 relative overflow-hidden">
                    <img src={`/assets/pressfarm/flowers/${labFlower}.png`} alt="" aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 w-24 h-24 opacity-25 pointer-events-none" />
                    <p className="text-xs text-farm-muted relative">Labor (7 days)</p>
                    <p className="text-2xl font-bold text-pf-master-violet mt-1 relative">{weekLaborHours.toFixed(1)}h</p>
                    <p className="text-[10px] text-farm-muted mt-1 relative">this week</p>
                  </Link>
                </>
              );
            })()}
          </div>
        </section>

        {/* Quick actions */}
        <SendDigestButton />

        {/* NAV CARDS — with flower illustrations instead of colored icon tiles */}
        {sections.map((section, idx) => (
          <section key={section.title}>
            <div className="mb-4">
              <p
                className="text-[10px] tracking-[0.22em] uppercase text-pf-master-gold mb-1"
                style={{ fontFamily: "'Bank Gothic LT', 'BankGothic Lt BT', 'Bank Gothic', sans-serif" }}
              >
                {section.eyebrow}
              </p>
              <h3 className="font-display text-xl text-farm-dark leading-tight">
                {section.title}
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {section.cards.map((card) => (
                <Link
                  key={card.href}
                  href={card.href}
                  className="card-interactive p-4 flex items-center gap-3 relative overflow-hidden"
                >
                  <div className="w-14 h-14 rounded-xl bg-farm-cream/60 border border-farm-dark/5 flex items-center justify-center flex-shrink-0">
                    <img
                      src={`/assets/pressfarm/flowers/${card.flower}.png`}
                      alt=""
                      aria-hidden="true"
                      className="w-11 h-11 object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-farm-dark">{card.title}</p>
                    <p className="text-[11px] text-farm-muted mt-0.5 leading-tight">{card.description}</p>
                  </div>
                </Link>
              ))}
            </div>
            {/* Section divider — gold dot rule between sections (not after last) */}
            {idx < sections.length - 1 && (
              <div className="mt-8 flex items-center gap-2 max-w-md mx-auto opacity-60">
                <div className="flex-1 h-px bg-pf-master-gold/25" />
                <div className="w-1 h-1 rounded-full bg-pf-master-gold" />
                <div className="flex-1 h-px bg-pf-master-gold/25" />
              </div>
            )}
          </section>
        ))}

        {/* Footer signature */}
        <footer className="pt-8 text-center">
          <div className="flex items-center justify-center gap-2 max-w-xs mx-auto">
            <div className="flex-1 h-px bg-pf-master-gold/30" />
            <div className="w-1.5 h-1.5 rounded-full bg-pf-master-gold" />
            <div className="flex-1 h-px bg-pf-master-gold/30" />
          </div>
          <p
            className="text-[10px] tracking-[0.28em] uppercase text-farm-muted/70 mt-3"
            style={{ fontFamily: "'Bank Gothic LT', 'BankGothic Lt BT', 'Bank Gothic', sans-serif" }}
          >
            Press Farm · Yountville · Est. 2024
          </p>
        </footer>
      </div>
    </main>
  );
}
